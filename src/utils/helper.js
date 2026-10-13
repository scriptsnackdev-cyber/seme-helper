import fs from "fs";
import { MessageFlags } from "discord.js";
import { getHelperSettings, getHelperAvatarPath } from "./db.js";

const webhookAvatars = new Map();
const helperWebhooks = new Map();

export function getReactionEmojiKey(emoji) {
  return emoji.id ?? emoji.name?.normalize("NFC").replace(/[\uFE0E\uFE0F]/g, "");
}

// Never log REST errors directly: they contain interaction/webhook tokens and payloads.
export function errorSummary(error) {
  return { name: error?.name ?? "Error", code: error?.code ?? "UNKNOWN" };
}

export async function respondToInteraction(interaction, payload) {
  const editPayload = { ...payload };
  delete editPayload.flags;
  const privateFollowUp = interaction.deferred && !interaction.ephemeral && (payload.flags & MessageFlags.Ephemeral);
  try {
    if (privateFollowUp) {
      const reply = await interaction.followUp(payload);
      await interaction.deleteReply().catch((error) => {
        console.warn("ลบข้อความรอคำสั่งไม่สำเร็จ:", errorSummary(error));
      });
      return reply;
    }
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(editPayload);
    }
    return await interaction.reply(payload);
  } catch (error) {
    // An edit is idempotent. Retry confirmation only, never the completed operation.
    if (!privateFollowUp && interaction.deferred && error.code !== 10062 && error.code !== 10015) {
      try {
        return await interaction.editReply(editPayload);
      } catch (retryError) {
        console.warn("ส่งผลลัพธ์คำสั่งไม่สำเร็จ:", errorSummary(retryError));
        return null;
      }
    }
    console.warn("ส่งผลลัพธ์คำสั่งไม่สำเร็จ:", errorSummary(error));
    return null;
  }
}

export async function deferCommand(interaction, isPrivate = true) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply(isPrivate ? { flags: MessageFlags.Ephemeral } : {});
  }
}

// Cache tokens only in memory. Serializing preparation also avoids duplicate webhook creation.
async function getHelperWebhook(channel, config = null, webhookId = null) {
  const isThread = channel.isThread?.() === true;
  const webhookChannel = isThread
    ? (channel.parent ?? await channel.guild.channels.fetch(channel.parentId))
    : channel;
  if (!webhookChannel?.fetchWebhooks) throw new Error("ห้องนี้ไม่รองรับ Helper Webhook");
  const botMember = webhookChannel.guild.members.me ?? await webhookChannel.guild.members.fetchMe();
  if (!webhookChannel.permissionsFor(botMember)?.has("ManageWebhooks")) {
    throw new Error("บอทต้องมีสิทธิ์ Manage Webhooks ในห้องนี้เพื่อใช้ชื่อ Helper");
  }
  if (isThread && !channel.permissionsFor(botMember)?.has("SendMessagesInThreads")) {
    throw new Error("บอทต้องมีสิทธิ์ Send Messages in Threads ในเธรดนี้");
  }

  const cacheKey = webhookId ?? webhookChannel.id;
  const task = (helperWebhooks.get(cacheKey) ?? Promise.resolve(null)).then(async (cached) => {
    let webhook = cached;
    if (!webhook) {
      const webhooks = await webhookChannel.fetchWebhooks();
      webhook = webhooks.find((item) => item.owner?.id === channel.client.user.id && item.token
        && (!webhookId || item.id === webhookId));
    }
    if (!config) {
      if (!webhook) throw new Error("ไม่พบ Webhook ของบอทที่ใช้ส่งข้อความนี้");
      return webhook;
    }

    const localAvatar = getHelperAvatarPath(webhookChannel.guild.id);
    const avatarVersion = localAvatar
      ? localAvatar + ":" + fs.statSync(localAvatar).mtimeMs
      : (config.avatar ?? null);
    const avatarChanged = !webhook || webhookAvatars.get(webhook.id) !== avatarVersion;
    const avatar = avatarChanged && localAvatar ? fs.readFileSync(localAvatar) : (config.avatar ?? null);
    if (!webhook) {
      webhook = await webhookChannel.createWebhook({ name: config.name, avatar, reason: "Seme Helper Persona Webhook" });
      webhookAvatars.set(webhook.id, avatarVersion);
    } else if (webhook.name !== config.name || avatarChanged) {
      webhook = await webhook.edit({ name: config.name, ...(avatarChanged ? { avatar } : {}) });
      webhookAvatars.set(webhook.id, avatarVersion);
    }
    return webhook;
  });
  helperWebhooks.set(cacheKey, task);
  try {
    const webhook = await task;
    helperWebhooks.set(webhook.id, task);
    return webhook;
  } catch (error) {
    if (helperWebhooks.get(cacheKey) === task) helperWebhooks.delete(cacheKey);
    throw error;
  }
}

function clearHelperWebhook(channel, webhookId) {
  const channelId = channel.isThread?.() ? channel.parentId : channel.id;
  helperWebhooks.delete(channelId);
  helperWebhooks.delete(webhookId);
  webhookAvatars.delete(webhookId);
}

export async function sendHelperMessage(channel, payload, guildId = null) {
  if (!channel?.send) throw new Error("ไม่พบห้องข้อความที่ส่งได้");
  const targetGuildId = guildId ?? channel.guild?.id;
  if (!targetGuildId) return await channel.send(payload);
  const config = getHelperSettings(targetGuildId);
  if (!config?.enabled) return await channel.send(payload);
  if (!config.name?.trim()) throw new Error("Helper เปิดอยู่แต่ไม่มีชื่อ กรุณาตั้งค่า /set helper setup ใหม่");

  const webhook = await getHelperWebhook(channel, config);
  const webhookPayload = { ...payload, username: config.name };
  delete webhookPayload.avatarURL;
  if (channel.isThread?.()) webhookPayload.threadId = channel.id;
  if (!getHelperAvatarPath(targetGuildId) && config.avatar?.startsWith("http")) {
    webhookPayload.avatarURL = config.avatar;
  }
  try {
    return await webhook.send(webhookPayload);
  } catch (error) {
    if (error.code === 10015) clearHelperWebhook(channel, webhook.id);
    if (!Number.isInteger(error.code) || (error.status ?? 400) >= 500) {
      const uncertain = new Error("การส่งข้อความอาจสำเร็จแล้ว แต่ยืนยันผลไม่ได้ กรุณาตรวจห้องก่อนลองใหม่", { cause: error });
      uncertain.deliveryUncertain = true;
      throw uncertain;
    }
    throw error;
  }
}

export async function editHelperMessage(message, payload) {
  if (!message.webhookId) return await message.edit(payload);
  const webhook = await getHelperWebhook(message.channel, null, message.webhookId);
  try {
    return await webhook.editMessage(message.id, {
      ...payload, ...(message.channel.isThread?.() ? { threadId: message.channelId } : {}),
    });
  } catch (error) {
    if (error.code === 10015) clearHelperWebhook(message.channel, webhook.id);
    throw error;
  }
}

export async function deleteHelperMessage(message) {
  if (!message.webhookId) return await message.delete();
  const webhook = await getHelperWebhook(message.channel, null, message.webhookId);
  try {
    return await webhook.deleteMessage(message.id, message.channel.isThread?.() ? message.channelId : undefined);
  } catch (error) {
    if (error.code === 10015) clearHelperWebhook(message.channel, webhook.id);
    throw error;
  }
}

export async function publishHelperResult(interaction, payload) {
  const message = await sendHelperMessage(interaction.channel, payload, interaction.guildId);
  await respondToInteraction(interaction, { content: "Success: ส่งผลลัพธ์เรียบร้อยแล้ว " + message.url });
  return message;
}
