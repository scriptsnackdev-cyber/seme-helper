import fs from "fs";
import { MessageFlags } from "discord.js";
import { getHelperSettings, getHelperAvatarPath } from "./db.js";

const webhookAvatars = new Map();

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

/**
 * ส่งข้อความไปยังห้องเป้าหมายด้วยตัวตนของ Helper ประจำเซิร์ฟเวอร์ (ผ่าน Webhook)
 * ใช้ channel.send() เมื่อไม่ได้เปิด Helper หรือ Discord ปฏิเสธ Webhook อย่างชัดเจน
 *
 * @param {import('discord.js').TextBasedChannel} channel - ห้องเป้าหมาย
 * @param {import('discord.js').MessageCreateOptions} payload - ข้อมูลข้อความ (content, embeds, files, components)
 * @param {string} [guildId] - ID ของเซิร์ฟเวอร์ (ไม่บังคับ)
 */
export async function sendHelperMessage(channel, payload, guildId = null) {
  if (!channel?.send) throw new Error("ไม่พบห้องข้อความที่ส่งได้");
  const targetGuildId = guildId ?? channel.guild?.id;

  if (!targetGuildId) {
    return await channel.send(payload);
  }

  const helperConfig = getHelperSettings(targetGuildId);

  // ถ้าไม่ได้เปิดใช้งาน หรือไม่ได้ตั้งชื่อ ให้ใช้ channel.send ตามปกติ
  if (!helperConfig || !helperConfig.enabled || !helperConfig.name) {
    return await channel.send(payload);
  }

  try {
    // ตรวจสอบสิทธิ์การจัดการ Webhook ของบอทในเซิร์ฟเวอร์
    const botMember = channel.guild?.members.me ?? (await channel.guild?.members.fetchMe().catch(() => null));
    if (botMember && !channel.permissionsFor(botMember)?.has("ManageWebhooks")) {
      return await channel.send(payload);
    }

    if (!channel.fetchWebhooks) {
      return await channel.send(payload);
    }

    const webhooks = await channel.fetchWebhooks().catch(() => null);
    let webhook = null;

    if (webhooks) {
      // ค้นหา Webhook ที่สร้างโดยบอทของเรา
      webhook = webhooks.find((w) => w.owner?.id === channel.client.user.id);
    }

    const localAvatar = getHelperAvatarPath(targetGuildId);
    const avatarVersion = localAvatar && fs.existsSync(localAvatar)
      ? `${localAvatar}:${fs.statSync(localAvatar).mtimeMs}`
      : (helperConfig.avatar ?? null);
    let avatarBuffer = null;
    if (localAvatar && fs.existsSync(localAvatar) && (!webhook || webhookAvatars.get(webhook.id) !== avatarVersion)) {
      avatarBuffer = fs.readFileSync(localAvatar);
    }

    // ถ้ายังไม่มี Webhook ในห้องนี้ ให้สร้างขึ้นใหม่
    if (!webhook) {
      webhook = await channel.createWebhook({
        name: helperConfig.name,
        avatar: avatarBuffer ?? helperConfig.avatar ?? undefined,
        reason: "Seme Helper Persona Webhook",
      });
      webhookAvatars.set(webhook.id, avatarVersion);
    } else if (webhook.name !== helperConfig.name || webhookAvatars.get(webhook.id) !== avatarVersion) {
      // ถ้ามี Webhook อยู่แล้ว แต่อาจจะมีการเปลี่ยนชื่อหรืออัปโหลดรูปภาพใหม่
      await webhook.edit({
        name: helperConfig.name,
        ...(webhookAvatars.get(webhook.id) !== avatarVersion
          ? { avatar: avatarBuffer ?? helperConfig.avatar ?? null }
          : {}),
      });
      webhookAvatars.set(webhook.id, avatarVersion);
    }

    // ส่งข้อความผ่าน Webhook พร้อมกำหนด username
    const webhookPayload = {
      ...payload,
      username: helperConfig.name,
    };

    // avatarURL ใน send() รับเฉพาะ URL (http/https) ที่ยังไม่หมดอายุเท่านั้น
    if (!localAvatar && helperConfig.avatar?.startsWith("http")) {
      webhookPayload.avatarURL = helperConfig.avatar;
    }

    return await webhook.send(webhookPayload);
  } catch (err) {
    // Only fall back for definite API rejection, not ambiguous delivery failures.
    if (!Number.isInteger(err.code) || (err.status ?? 500) >= 500) throw err;
    console.warn("ไม่สามารถส่งผ่าน Webhook ได้ ใช้ channel.send:", errorSummary(err));
    return await channel.send(payload);
  }
}
