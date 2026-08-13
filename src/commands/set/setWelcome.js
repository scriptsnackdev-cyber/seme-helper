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
    await interaction.reply({ content: "🟢 เปิดใช้งานระบบการ์ดต้อนรับเรียบร้อยแล้วค่ะ!", ephemeral: true });
  } else if (subcommand === "disable") {
    welcomeSettings.enabled = false;
    saveWelcomeSettings(guildId, welcomeSettings);
    await interaction.reply({ content: "🔴 ปิดใช้งานระบบการ์ดต้อนรับเรียบร้อยแล้วค่ะ", ephemeral: true });
  } else if (subcommand === "message") {
    const text = interaction.options.getString("text");
    welcomeSettings.message = text;
    saveWelcomeSettings(guildId, welcomeSettings);
    await interaction.reply({ content: `✅ บันทึกข้อความต้อนรับใหม่เรียบร้อยแล้ว:\n\`\`\`\n${text}\n\`\`\``, ephemeral: true });
  } else if (subcommand === "role") {
    const role = interaction.options.getRole("role");
    welcomeSettings.roleId = role.id;
    welcomeSettings.roleName = role.name;
    saveWelcomeSettings(guildId, welcomeSettings);
    await interaction.reply({ content: `✅ บันทึกยศสมาชิกใหม่อัตโนมัติเป็น **${role.name}** (<@&${role.id}>) เรียบร้อยแล้ว`, ephemeral: true });
  } else if (subcommand === "channel") {
    const channel = interaction.options.getChannel("channel");
    welcomeSettings.channelId = channel.id;
    welcomeSettings.channelName = channel.name;
    saveWelcomeSettings(guildId, welcomeSettings);
    await interaction.reply({ content: `✅ บันทึกห้องส่งข้อความต้อนรับเป็น **${channel.name}** (<#${channel.id}>) เรียบร้อยแล้ว`, ephemeral: true });
  } else if (subcommand === "image" || subcommand === "banner") {
    await interaction.deferReply({ ephemeral: true });
    const bannerAttachment = interaction.options.getAttachment("image");
    const bannerGifPath = path.join(DATABASE_DIR, guildId, "welcome", "banner.gif");
    const bannerWebpPath = path.join(DATABASE_DIR, guildId, "welcome", "banner.webp");
    const tempVideoPath = path.join(DATABASE_DIR, guildId, "welcome", "temp_input.mp4");

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

    await interaction.editReply({ content: "✅ อัปโหลดและตั้งค่ารูปภาพหรือวิดีโอแบนเนอร์เรียบร้อยแล้ว!" });
  } else if (subcommand === "remove-image" || subcommand === "default-banner") {
    const bannerGifPath = path.join(DATABASE_DIR, guildId, "welcome", "banner.gif");
    const bannerWebpPath = path.join(DATABASE_DIR, guildId, "welcome", "banner.webp");

    let deleted = false;
    if (fs.existsSync(bannerGifPath)) { fs.unlinkSync(bannerGifPath); deleted = true; }
    if (fs.existsSync(bannerWebpPath)) { fs.unlinkSync(bannerWebpPath); deleted = true; }

    if (deleted) {
      await interaction.reply({ content: "✅ รีเซ็ตกลับไปใช้แบนเนอร์เริ่มต้นเรียบร้อยแล้ว", ephemeral: true });
    } else {
      await interaction.reply({ content: "⚠️ คุณใช้แบนเนอร์เริ่มต้นอยู่แล้วค่ะ", ephemeral: true });
    }
  }
}
