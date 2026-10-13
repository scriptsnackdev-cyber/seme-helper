import { MessageFlags } from "discord.js";
import { respondToInteraction, deferCommand } from "../../utils/helper.js";
import fs from "fs";
import path from "path";
import { DATABASE_DIR, getWelcomeSettings, saveWelcomeSettings } from "../../utils/db.js";
import { convertMp4ToGif, downloadAndConvertToGif } from "../../utils/canvas.js";

export async function handleSetWelcomeCommands(interaction) {
  const { guildId } = interaction;
  const subcommand = interaction.options.getSubcommand();
  const welcomeSettings = getWelcomeSettings(guildId);

  if (subcommand === "enable") {
    welcomeSettings.enabled = true;
    saveWelcomeSettings(guildId, welcomeSettings);
    await respondToInteraction(interaction, { content: "🟢 เปิดใช้งานระบบการ์ดต้อนรับเรียบร้อยแล้วค่ะ!", flags: MessageFlags.Ephemeral });
  } else if (subcommand === "disable") {
    welcomeSettings.enabled = false;
    saveWelcomeSettings(guildId, welcomeSettings);
    await respondToInteraction(interaction, { content: "🔴 ปิดใช้งานระบบการ์ดต้อนรับเรียบร้อยแล้วค่ะ", flags: MessageFlags.Ephemeral });
  } else if (subcommand === "message") {
    const text = interaction.options.getString("text");
    welcomeSettings.message = text;
    saveWelcomeSettings(guildId, welcomeSettings);
    await respondToInteraction(interaction, { content: `✅ บันทึกข้อความต้อนรับใหม่เรียบร้อยแล้ว:\n\`\`\`\n${text}\n\`\`\``, flags: MessageFlags.Ephemeral });
  } else if (subcommand === "role") {
    const role = interaction.options.getRole("role");
    welcomeSettings.roleId = role.id;
    welcomeSettings.roleName = role.name;
    saveWelcomeSettings(guildId, welcomeSettings);
    await respondToInteraction(interaction, { content: `✅ บันทึกยศสมาชิกใหม่อัตโนมัติเป็น **${role.name}** (<@&${role.id}>) เรียบร้อยแล้ว`, flags: MessageFlags.Ephemeral });
  } else if (subcommand === "channel") {
    const channel = interaction.options.getChannel("channel");
    welcomeSettings.channelId = channel.id;
    welcomeSettings.channelName = channel.name;
    saveWelcomeSettings(guildId, welcomeSettings);
    await respondToInteraction(interaction, { content: `✅ บันทึกห้องส่งข้อความต้อนรับเป็น **${channel.name}** (<#${channel.id}>) เรียบร้อยแล้ว`, flags: MessageFlags.Ephemeral });
  } else if (subcommand === "image" || subcommand === "banner") {
    await deferCommand(interaction);
    const bannerAttachment = interaction.options.getAttachment("image");
    const bannerGifPath = path.join(DATABASE_DIR, guildId, "welcome", "banner.gif");
    const bannerWebpPath = path.join(DATABASE_DIR, guildId, "welcome", "banner.webp");
    const randomSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempVideoPath = path.join(DATABASE_DIR, guildId, "welcome", `temp_${randomSuffix}.mp4`);

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

    await respondToInteraction(interaction, { content: "✅ อัปโหลดและตั้งค่ารูปภาพหรือวิดีโอแบนเนอร์เรียบร้อยแล้ว!" });
  } else if (subcommand === "remove-image" || subcommand === "default-banner") {
    const bannerGifPath = path.join(DATABASE_DIR, guildId, "welcome", "banner.gif");
    const bannerWebpPath = path.join(DATABASE_DIR, guildId, "welcome", "banner.webp");

    let deleted = false;
    if (fs.existsSync(bannerGifPath)) { fs.unlinkSync(bannerGifPath); deleted = true; }
    if (fs.existsSync(bannerWebpPath)) { fs.unlinkSync(bannerWebpPath); deleted = true; }

    if (deleted) {
      await respondToInteraction(interaction, { content: "✅ รีเซ็ตกลับไปใช้แบนเนอร์เริ่มต้นเรียบร้อยแล้ว", flags: MessageFlags.Ephemeral });
    } else {
      await respondToInteraction(interaction, { content: "⚠️ คุณใช้แบนเนอร์เริ่มต้นอยู่แล้วค่ะ", flags: MessageFlags.Ephemeral });
    }
  } else if (subcommand === "remove-message" || subcommand === "reset-message") {
    if (welcomeSettings.message) {
      delete welcomeSettings.message;
      saveWelcomeSettings(guildId, welcomeSettings);
      await respondToInteraction(interaction, { content: "✅ รีเซ็ตข้อความต้อนรับกลับเป็นข้อความเริ่มต้นของระบบเรียบร้อยแล้วค่ะ", flags: MessageFlags.Ephemeral });
    } else {
      await respondToInteraction(interaction, { content: "⚠️ ปัจจุบันใช้งานข้อความต้อนรับเริ่มต้นของระบบอยู่แล้วค่ะ", flags: MessageFlags.Ephemeral });
    }
  } else if (subcommand === "remove-role" || subcommand === "reset-role") {
    if (welcomeSettings.roleId) {
      const oldRoleName = welcomeSettings.roleName || "ยศที่ตั้งไว้";
      delete welcomeSettings.roleId;
      delete welcomeSettings.roleName;
      saveWelcomeSettings(guildId, welcomeSettings);
      await respondToInteraction(interaction, { content: `✅ ยกเลิกการแจกยศสมาชิกใหม่อัตโนมัติ (${oldRoleName}) เรียบร้อยแล้วค่ะ`, flags: MessageFlags.Ephemeral });
    } else {
      await respondToInteraction(interaction, { content: "⚠️ ยังไม่ได้มีการตั้งค่ายศสมาชิกใหม่อัตโนมัติไว้ค่ะ", flags: MessageFlags.Ephemeral });
    }
  }
}
