import fs from "fs";
import path from "path";
import { MessageFlags, AttachmentBuilder, EmbedBuilder } from "discord.js";
import {
  DATABASE_DIR,
  getIntroSettings,
  saveIntroSettings,
  getIntroBannerPath,
} from "../../utils/db.js";
import { convertMp4ToGif, downloadAndConvertToGif } from "../../utils/canvas.js";
import { sendHelperMessage, respondToInteraction, deferCommand, errorSummary } from "../../utils/helper.js";

/**
 * ส่งข้อความ Sticky Template ไปยังห้องแนะนำตัว พร้อมลบข้อความเดิมออก
 * @param {import('discord.js').Guild} guild
 * @param {object} introSettings
 */
export async function postIntroStickyMessage(guild, introSettings) {
  if (!guild || !introSettings || !introSettings.enabled || !introSettings.channelId || !introSettings.message) {
    return null;
  }

  const channel = await guild.channels.fetch(introSettings.channelId).catch(() => null);
  if (!channel) return null;

  // 1. ลบข้อความ Sticky เดิมถ้ายังมีอยู่
  if (introSettings.lastMessageId) {
    try {
      const oldMsg = await channel.messages.fetch(introSettings.lastMessageId).catch(() => null);
      if (oldMsg) {
        await oldMsg.delete().catch(() => null);
      }
    } catch {
      // ignore
    }
  }

  // 2. เตรียมข้อมูลส่ง
  const sendOptions = { content: introSettings.message };
  const bannerInfo = getIntroBannerPath(guild.id);
  if (bannerInfo) {
    const attachment = new AttachmentBuilder(bannerInfo.path, { name: bannerInfo.filename });
    sendOptions.files = [attachment];
  }

  // 3. ส่งข้อความใหม่
  try {
    const sentMessage = await sendHelperMessage(channel, sendOptions, guild.id);
    if (sentMessage && sentMessage.id) {
      introSettings.lastMessageId = sentMessage.id;
      saveIntroSettings(guild.id, introSettings);
      return sentMessage;
    }
  } catch (err) {
    console.error("❌ [Intro Sticky] เกิดข้อผิดพลาดในการส่งข้อความเทมเพลต:", errorSummary(err));
  }
  return null;
}

export async function handleSetIntroCommands(interaction) {
  await deferCommand(interaction);
  const { guildId, guild } = interaction;
  const subcommand = interaction.options.getSubcommand();
  const introSettings = getIntroSettings(guildId);
  let stickyFailed = false;

  if (subcommand === "setup") {

    const channel = interaction.options.getChannel("channel");
    const messageText = interaction.options.getString("message");
    const bannerAttachment = interaction.options.getAttachment("banner");

    introSettings.enabled = true;
    introSettings.channelId = channel.id;
    introSettings.channelName = channel.name;
    introSettings.message = messageText;

    if (bannerAttachment) {
      const bannerGifPath = path.join(DATABASE_DIR, guildId, "intro", "banner.gif");
      const bannerWebpPath = path.join(DATABASE_DIR, guildId, "intro", "banner.webp");
      const randomSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const tempVideoPath = path.join(DATABASE_DIR, guildId, "intro", `temp_${randomSuffix}.mp4`);

      if (fs.existsSync(bannerGifPath)) fs.unlinkSync(bannerGifPath);
      if (fs.existsSync(bannerWebpPath)) fs.unlinkSync(bannerWebpPath);

      const contentType = bannerAttachment.contentType || "";
      const fileName = bannerAttachment.name.toLowerCase();
      const isVideo = contentType.startsWith("video/") || fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".webm");

      if (isVideo) {
        await convertMp4ToGif(bannerAttachment.url, bannerGifPath, tempVideoPath);
      } else {
        await downloadAndConvertToGif(bannerAttachment.url, bannerGifPath);
      }
    }

    saveIntroSettings(guildId, introSettings);

    // ส่งข้อความ Sticky แรกเริ่มลงห้อง
    stickyFailed = !await postIntroStickyMessage(guild, introSettings);

    await respondToInteraction(interaction, {
      content: (`✅ ตั้งค่าระบบเทมเพลตแนะนำตัวในห้อง **#${channel.name}** (<#${channel.id}>) เรียบร้อยแล้ว!\nบอทจะคอยปักเทมเพลตนี้ต่อท้ายทุกครั้งที่มีคนแนะนำตัวค่ะ`) + (stickyFailed ? "\nบันทึกการตั้งค่าแล้ว แต่ส่ง Sticky ไม่สำเร็จ กรุณาตรวจสิทธิ์ห้อง" : ""),
    });
  } else if (subcommand === "message") {
    const text = interaction.options.getString("text");
    introSettings.message = text;
    saveIntroSettings(guildId, introSettings);

    // อัปเดตข้อความในห้องทันทีถ้าเปิดใช้งานอยู่
    if (introSettings.enabled && introSettings.channelId) {
      stickyFailed = !await postIntroStickyMessage(guild, introSettings);
    }

    await respondToInteraction(interaction, {
      content: (`✅ อัปเดตข้อความเทมเพลตแนะนำตัวใหม่เรียบร้อยแล้ว:\n\`\`\`\n${text}\n\`\`\``) + (stickyFailed ? "\nบันทึกการตั้งค่าแล้ว แต่ส่ง Sticky ไม่สำเร็จ กรุณาตรวจสิทธิ์ห้อง" : ""),
      flags: MessageFlags.Ephemeral,
    });
  } else if (subcommand === "channel") {
    const channel = interaction.options.getChannel("channel");
    introSettings.channelId = channel.id;
    introSettings.channelName = channel.name;
    saveIntroSettings(guildId, introSettings);

    // ส่งเทมเพลตไปยังห้องใหม่
    if (introSettings.enabled && introSettings.message) {
      stickyFailed = !await postIntroStickyMessage(guild, introSettings);
    }

    await respondToInteraction(interaction, {
      content: (`✅ เปลี่ยนห้องเทมเพลตแนะนำตัวเป็น **#${channel.name}** (<#${channel.id}>) เรียบร้อยแล้วค่ะ`) + (stickyFailed ? "\nบันทึกการตั้งค่าแล้ว แต่ส่ง Sticky ไม่สำเร็จ กรุณาตรวจสิทธิ์ห้อง" : ""),
      flags: MessageFlags.Ephemeral,
    });
  } else if (subcommand === "banner") {
    await deferCommand(interaction);
    const bannerAttachment = interaction.options.getAttachment("image");
    const bannerGifPath = path.join(DATABASE_DIR, guildId, "intro", "banner.gif");
    const bannerWebpPath = path.join(DATABASE_DIR, guildId, "intro", "banner.webp");
    const randomSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempVideoPath = path.join(DATABASE_DIR, guildId, "intro", `temp_${randomSuffix}.mp4`);

    if (fs.existsSync(bannerGifPath)) fs.unlinkSync(bannerGifPath);
    if (fs.existsSync(bannerWebpPath)) fs.unlinkSync(bannerWebpPath);

    const contentType = bannerAttachment.contentType || "";
    const fileName = bannerAttachment.name.toLowerCase();
    const isVideo = contentType.startsWith("video/") || fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".webm");

    if (isVideo) {
      await convertMp4ToGif(bannerAttachment.url, bannerGifPath, tempVideoPath);
    } else {
      await downloadAndConvertToGif(bannerAttachment.url, bannerGifPath);
    }

    if (introSettings.enabled && introSettings.channelId && introSettings.message) {
      stickyFailed = !await postIntroStickyMessage(guild, introSettings);
    }

    await respondToInteraction(interaction, { content: "อัปเดตแบนเนอร์เรียบร้อยแล้ว" + (stickyFailed ? " แต่ส่ง Sticky ไม่สำเร็จ กรุณาตรวจสิทธิ์ห้อง" : "") });
  } else if (subcommand === "remove-banner") {
    const bannerGifPath = path.join(DATABASE_DIR, guildId, "intro", "banner.gif");
    const bannerWebpPath = path.join(DATABASE_DIR, guildId, "intro", "banner.webp");

    let deleted = false;
    if (fs.existsSync(bannerGifPath)) { fs.unlinkSync(bannerGifPath); deleted = true; }
    if (fs.existsSync(bannerWebpPath)) { fs.unlinkSync(bannerWebpPath); deleted = true; }

    if (deleted) {
      if (introSettings.enabled && introSettings.channelId && introSettings.message) {
        stickyFailed = !await postIntroStickyMessage(guild, introSettings);
      }
      await respondToInteraction(interaction, { content: ("✅ ลบแบนเนอร์ของเทมเพลตแนะนำตัวเรียบร้อยแล้วค่ะ") + (stickyFailed ? "\nบันทึกการตั้งค่าแล้ว แต่ส่ง Sticky ไม่สำเร็จ กรุณาตรวจสิทธิ์ห้อง" : ""), flags: MessageFlags.Ephemeral });
    } else {
      await respondToInteraction(interaction, { content: "ยังไม่มีการตั้งค่าแบนเนอร์ไว้ค่ะ", flags: MessageFlags.Ephemeral });
    }
  } else if (subcommand === "enable") {
    introSettings.enabled = true;
    saveIntroSettings(guildId, introSettings);
    if (introSettings.channelId && introSettings.message) {
      stickyFailed = !await postIntroStickyMessage(guild, introSettings);
    }
    await respondToInteraction(interaction, { content: ("🟢 เปิดใช้งานระบบเทมเพลตแนะนำตัวเรียบร้อยแล้วค่ะ!") + (stickyFailed ? "\nบันทึกการตั้งค่าแล้ว แต่ส่ง Sticky ไม่สำเร็จ กรุณาตรวจสิทธิ์ห้อง" : ""), flags: MessageFlags.Ephemeral });
  } else if (subcommand === "disable") {
    introSettings.enabled = false;
    saveIntroSettings(guildId, introSettings);
    await respondToInteraction(interaction, { content: "ปิดใช้งานระบบเทมเพลตแนะนำตัวเรียบร้อยแล้วค่ะ", flags: MessageFlags.Ephemeral });
  } else if (subcommand === "status") {
    const bannerInfo = getIntroBannerPath(guildId);
    const embed = new EmbedBuilder()
      .setTitle("📋 ข้อมูลการตั้งค่าระบบเทมเพลตแนะนำตัว (Intro Sticky)")
      .setColor(introSettings.enabled ? 0x57f287 : 0xed4245)
      .addFields(
        { name: "สถานะการทำงาน", value: introSettings.enabled ? "🟢 เปิดใช้งาน" : "🔴 ปิดใช้งาน", inline: true },
        { name: "ห้องแนะนำตัว", value: introSettings.channelId ? `<#${introSettings.channelId}>` : "ยังไม่ได้ตั้งค่า", inline: true },
        { name: "แบนเนอร์", value: bannerInfo ? "✅ มีการตั้งค่าแบนเนอร์" : "❌ ไม่มีแบนเนอร์", inline: true },
        { name: "ข้อความเทมเพลต", value: introSettings.message ? `\`\`\`\n${introSettings.message}\n\`\`\`` : "ยังไม่ได้ตั้งค่าข้อความ" }
      )
      .setFooter({ text: "ระบบ Sticky Intro Template" })
      .setTimestamp();

    await respondToInteraction(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
