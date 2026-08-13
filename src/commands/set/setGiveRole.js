import fs from "fs";
import path from "path";
import sharp from "sharp";
import { DATABASE_DIR } from "../../utils/db.js";
import { convertMp4ToGif, downloadAndConvertToGif } from "../../utils/canvas.js";

export async function handleSetGiveRoleCommands(interaction) {
  const { guildId } = interaction;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "image" || subcommand === "banner") {
    await interaction.deferReply({ ephemeral: true });
    const bannerAttachment = interaction.options.getAttachment("image");

    const bannerPngPath = path.join(DATABASE_DIR, guildId, "giverole", "banner.png");
    const bannerGifPath = path.join(DATABASE_DIR, guildId, "giverole", "banner.gif");
    const bannerWebpPath = path.join(DATABASE_DIR, guildId, "giverole", "banner.webp");
    const tempVideoPath = path.join(DATABASE_DIR, guildId, "giverole", "temp_input.mp4");

    if (fs.existsSync(bannerPngPath)) fs.unlinkSync(bannerPngPath);
    if (fs.existsSync(bannerGifPath)) fs.unlinkSync(bannerGifPath);
    if (fs.existsSync(bannerWebpPath)) fs.unlinkSync(bannerWebpPath);

    const contentType = bannerAttachment.contentType || "";
    const fileName = bannerAttachment.name.toLowerCase();
    const isVideo = contentType.startsWith("video/") || fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".webm");

    if (isVideo) {
      await convertMp4ToGif(bannerAttachment.url, bannerGifPath, tempVideoPath);
    } else if (contentType.includes("gif") || fileName.endsWith(".gif")) {
      await downloadAndConvertToGif(bannerAttachment.url, bannerGifPath);
    } else {
      const res = await fetch(bannerAttachment.url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        await sharp(buffer, { animated: false }).webp({ quality: 90 }).toFile(bannerWebpPath);
      }
    }

    await interaction.editReply({
      content: "✅ บันทึกรูปภาพหรือวิดีโอแบนเนอร์สำหรับคำสั่ง `/giverole` เรียบร้อยแล้วค่ะ!",
    });
  } else if (subcommand === "remove-image" || subcommand === "remove-banner") {
    const bannerPngPath = path.join(DATABASE_DIR, guildId, "giverole", "banner.png");
    const bannerGifPath = path.join(DATABASE_DIR, guildId, "giverole", "banner.gif");
    const bannerWebpPath = path.join(DATABASE_DIR, guildId, "giverole", "banner.webp");

    let deleted = false;
    if (fs.existsSync(bannerGifPath)) { fs.unlinkSync(bannerGifPath); deleted = true; }
    if (fs.existsSync(bannerPngPath)) { fs.unlinkSync(bannerPngPath); deleted = true; }
    if (fs.existsSync(bannerWebpPath)) { fs.unlinkSync(bannerWebpPath); deleted = true; }

    if (deleted) {
      await interaction.reply({ content: "✅ ลบแบนเนอร์ของคำสั่ง `/giverole` ออกเรียบร้อยแล้ว", ephemeral: true });
    } else {
      await interaction.reply({ content: "⚠️ เซิร์ฟเวอร์นี้ยังไม่ได้ตั้งค่าแบนเนอร์สำหรับ `/giverole`", ephemeral: true });
    }
  }
}
