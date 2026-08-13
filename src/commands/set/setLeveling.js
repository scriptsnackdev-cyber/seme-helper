import fs from "fs";
import path from "path";
import sharp from "sharp";
import { DATABASE_DIR, getLevelingSettings, saveLevelingSettings } from "../../utils/db.js";

export async function handleSetLevelingCommands(interaction) {
  const { guildId } = interaction;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "status") {
    const statusStr = interaction.options.getString("status");
    const channel = interaction.options.getChannel("channel");

    const enabled = statusStr === "enable";
    const levelingSettings = getLevelingSettings(guildId);
    levelingSettings.enabled = enabled;
    levelingSettings.channelId = channel ? channel.id : null;

    saveLevelingSettings(guildId, levelingSettings);

    const statusText = enabled ? "เปิดใช้งาน (Enable) 🟢" : "ปิดใช้งาน (Disable) 🔴";
    const channelText = channel ? `<#${channel.id}>` : "ช่องที่สมาชิกพิมพ์คุย";
    await interaction.reply({
      content: `✅ ตั้งค่าสถานะระบบ Level Up เรียบร้อยแล้ว!\n• **สถานะ:** ${statusText}\n• **ช่องแจ้งเตือน:** ${channelText}`,
      ephemeral: true,
    });
  } else if (subcommand === "image" || subcommand === "banner") {
    await interaction.deferReply({ ephemeral: true });
    const bannerAttachment = interaction.options.getAttachment("image");

    const bannerPngPath = path.join(DATABASE_DIR, guildId, "leveling", "banner.png");
    const bannerGifPath = path.join(DATABASE_DIR, guildId, "leveling", "banner.gif");
    const bannerWebpPath = path.join(DATABASE_DIR, guildId, "leveling", "banner.webp");

    if (fs.existsSync(bannerPngPath)) fs.unlinkSync(bannerPngPath);
    if (fs.existsSync(bannerGifPath)) fs.unlinkSync(bannerGifPath);
    if (fs.existsSync(bannerWebpPath)) fs.unlinkSync(bannerWebpPath);

    const contentType = bannerAttachment.contentType || "";
    const fileName = bannerAttachment.name.toLowerCase();
    const isVideo = contentType.startsWith("video/") || fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".webm");

    if (isVideo) {
      await interaction.editReply({
        content: "⚠️ ระบบแบนเนอร์ Level Up รองรับเฉพาะไฟล์รูปภาพ (PNG, JPG, WEBP) เท่านั้นครับ (ไม่รองรับวิดีโอ MOV/MP4)",
      });
      return;
    }

    const res = await fetch(bannerAttachment.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });

    if (!res.ok) {
      await interaction.editReply({ content: "❌ ไม่สามารถดาวน์โหลดรูปภาพได้" });
      return;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await sharp(buffer, { animated: false }).webp({ quality: 90 }).toFile(bannerWebpPath);

    await interaction.editReply({
      content: "✅ บันทึกรูปภาพแบนเนอร์ประจำการ์ด Level Up เรียบร้อยแล้ว! (แปลงเป็นไฟล์ภาพ WebP ประหยัดพื้นที่เรียบร้อย)",
    });
  } else if (subcommand === "remove-image" || subcommand === "remove-banner") {
    const bannerGifPath = path.join(DATABASE_DIR, guildId, "leveling", "banner.gif");
    const bannerPngPath = path.join(DATABASE_DIR, guildId, "leveling", "banner.png");
    const bannerWebpPath = path.join(DATABASE_DIR, guildId, "leveling", "banner.webp");

    let deleted = false;
    if (fs.existsSync(bannerGifPath)) { fs.unlinkSync(bannerGifPath); deleted = true; }
    if (fs.existsSync(bannerPngPath)) { fs.unlinkSync(bannerPngPath); deleted = true; }
    if (fs.existsSync(bannerWebpPath)) { fs.unlinkSync(bannerWebpPath); deleted = true; }

    if (deleted) {
      await interaction.reply({ content: "✅ ลบรูปภาพแบนเนอร์ Level Up ออกเรียบร้อยแล้ว", ephemeral: true });
    } else {
      await interaction.reply({ content: "⚠️ เซิร์ฟเวอร์นี้ยังไม่ได้ตั้งค่ารูปภาพแบนเนอร์ Level Up", ephemeral: true });
    }
  }
}
