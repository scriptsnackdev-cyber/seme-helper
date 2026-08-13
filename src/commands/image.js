import fs from "fs";
import path from "path";
import sharp from "sharp";
import { AttachmentBuilder } from "discord.js";
import { DATABASE_DIR, ensureGuildDatabase, getImageGalleryData, saveImageGalleryData } from "../utils/db.js";

function sanitizeFolderName(name) {
  return name.replace(/[\/\\:\*\?"<>\|]/g, "_").replace(/\.\./g, "_").trim();
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload);
    } else {
      return await interaction.reply(payload);
    }
  } catch (err) {
    if (err.code === 10062) return null;
    console.error("❌ ไม่สามารถส่งข้อความตอบกลับ interaction ได้:", err);
    return null;
  }
}

export async function handleImageCommand(interaction) {
  const { guildId } = interaction;
  if (!guildId) {
    await safeReply(interaction, { content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", ephemeral: true });
    return;
  }

  ensureGuildDatabase(guildId);
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }
    } catch (e) {
      console.warn("⚠️ ไม่สามารถ deferReply ได้:", e.message);
    }

    const rawTitle = (interaction.options.getString("title") || interaction.options.getString("name") || "").trim();
    const categoryTitle = sanitizeFolderName(rawTitle);
    const blurOption = interaction.options.getBoolean("blur") ?? false;

    if (!categoryTitle) {
      await safeReply(interaction, { content: "❌ กรุณาระบุชื่อหมวดหมู่ให้ถูกต้องค่ะ", ephemeral: true });
      return;
    }

    const targetDir = path.join(DATABASE_DIR, guildId, "image", categoryTitle);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const attachments = [];
    for (let i = 1; i <= 9; i++) {
      const att = interaction.options.getAttachment(`image${i}`);
      if (att) attachments.push(att);
    }

    if (attachments.length === 0) {
      await safeReply(interaction, { content: "❌ กรุณาแนบไฟล์รูปภาพอย่างน้อย 1 รูปค่ะ", ephemeral: true });
      return;
    }

    let savedCount = 0;
    let failCount = 0;
    const timePrefix = Date.now();
    const savedFiles = [];

    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      try {
        const res = await fetch(att.url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        });

        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const fileName = `${timePrefix}_${i + 1}.webp`;
          const savePath = path.join(targetDir, fileName);

          await sharp(buffer, { animated: false }).webp({ quality: 90 }).toFile(savePath);
          savedCount++;
          savedFiles.push(fileName);
        } else {
          failCount++;
        }
      } catch (err) {
        console.error(`❌ ไม่สามารถแปลงรูปภาพ ${att.name}:`, err);
        failCount++;
      }
    }

    // อัปเดตไฟล์ database/${guildId}/image/data.json
    const galleryData = getImageGalleryData(guildId);
    const userId = interaction.user.id;
    const userName = interaction.user.tag || interaction.user.username;
    const nowIso = new Date().toISOString();

    if (!galleryData.titles) galleryData.titles = {};

    if (!galleryData.titles[categoryTitle]) {
      galleryData.titles[categoryTitle] = {
        title: categoryTitle,
        createdBy: userId,
        createdByName: userName,
        createdAt: nowIso,
        updatedAt: nowIso,
        imageCount: savedFiles.length,
        images: savedFiles,
        blur: blurOption,
      };
    } else {
      const existing = galleryData.titles[categoryTitle];
      const existingImages = existing.images || [];
      const updatedImages = [...existingImages, ...savedFiles];
      existing.updatedAt = nowIso;
      existing.imageCount = updatedImages.length;
      existing.images = updatedImages;
      // อัปเดตค่า blur ถ้าผู้ใช้ระบุค่ามาใหม่
      if (interaction.options.getBoolean("blur") !== null) {
        existing.blur = blurOption;
      }
    }

    saveImageGalleryData(guildId, galleryData);

    const blurText = blurOption ? "\n🔒 เปิดใช้งาน Spoiler (เบลอรูปภาพ)" : "";
    await safeReply(interaction, {
      content: `✅ บันทึก **${categoryTitle}** เรียบร้อย\nจำนวน ${savedCount} รูป${blurText}`,
      ephemeral: true,
    });
  } else if (subcommand === "list") {
    const galleryData = getImageGalleryData(guildId);
    const imagesDir = path.join(DATABASE_DIR, guildId, "image");

    let categoryList = [];

    if (galleryData.titles && Object.keys(galleryData.titles).length > 0) {
      for (const [tName, meta] of Object.entries(galleryData.titles)) {
        const blurTag = meta.blur ? " 🔞" : "";
        categoryList.push(`• 📁 **${tName}**${blurTag} (${meta.imageCount || 0} รูป) - สร้างโดย: <@${meta.createdBy}>`);
      }
    } else if (fs.existsSync(imagesDir)) {
      const categories = fs.readdirSync(imagesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => {
          const catPath = path.join(imagesDir, dirent.name);
          const files = fs.readdirSync(catPath).filter((f) => f.endsWith(".webp") || f.endsWith(".png") || f.endsWith(".jpg"));
          return `• 📁 **${dirent.name}** (${files.length} รูป)`;
        });
      categoryList.push(...categories);
    }

    if (categoryList.length === 0) {
      await safeReply(interaction, { content: "📁 ยังไม่มีคลังรูปภาพในเซิร์ฟเวอร์นี้ค่ะ", ephemeral: true });
      return;
    }

    await safeReply(interaction, {
      content: `🖼️ **รายการคลังรูปภาพทั้งหมดในเซิร์ฟเวอร์:**\n\n${categoryList.join("\n")}`,
      ephemeral: true,
    });
  } else if (subcommand === "delete") {
    const rawTitle = (interaction.options.getString("title") || interaction.options.getString("name") || "").trim();
    const categoryTitle = sanitizeFolderName(rawTitle);
    const targetDir = path.join(DATABASE_DIR, guildId, "image", categoryTitle);

    let deleted = false;
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      deleted = true;
    }

    const galleryData = getImageGalleryData(guildId);
    if (galleryData.titles && galleryData.titles[categoryTitle]) {
      delete galleryData.titles[categoryTitle];
      saveImageGalleryData(guildId, galleryData);
      deleted = true;
    }

    if (deleted) {
      await safeReply(interaction, { content: `✅ ลบคลังรูปภาพหมวดหมู่ **"${categoryTitle}"** ออกเรียบร้อยแล้วค่ะ`, ephemeral: true });
    } else {
      await safeReply(interaction, { content: `❌ ไม่พบคลังรูปภาพหมวดหมู่ **"${categoryTitle}"** ค่ะ`, ephemeral: true });
    }
  } else if (subcommand === "view") {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }
    } catch (e) {
      console.warn("⚠️ ไม่สามารถ deferReply ได้:", e.message);
    }

    const rawTitle = (interaction.options.getString("title") || interaction.options.getString("name") || "").trim();
    const categoryTitle = sanitizeFolderName(rawTitle);
    const targetDir = path.join(DATABASE_DIR, guildId, "image", categoryTitle);

    if (!fs.existsSync(targetDir)) {
      await safeReply(interaction, { content: `❌ ไม่พบคลังรูปภาพหมวดหมู่ **"${categoryTitle}"** ค่ะ` });
      return;
    }

    const files = fs.readdirSync(targetDir).filter((f) => f.endsWith(".webp") || f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".gif"));

    if (files.length === 0) {
      await safeReply(interaction, { content: `❌ ไม่พบรูปภาพในหมวดหมู่ **"${categoryTitle}"** ค่ะ` });
      return;
    }

    // ตรวจสอบค่า blur จาก data.json
    const galleryData = getImageGalleryData(guildId);
    const isBlur = galleryData.titles?.[categoryTitle]?.blur === true;

    // Discord แนบไฟล์ได้สูงสุด 10 รูปต่อ 1 ข้อความ
    const firstChunk = files.slice(0, 10);
    const attachments = firstChunk.map((file) => {
      const builder = new AttachmentBuilder(path.join(targetDir, file));
      if (isBlur) builder.setName(`SPOILER_${file}`);
      return builder;
    });

    const blurLabel = isBlur ? " 🔞 (Spoiler)" : "";
    await safeReply(interaction, {
      content: `🖼️ **รูปภาพในคลัง "${categoryTitle}" (ทั้งหมด ${files.length} รูป):**${blurLabel}`,
      files: attachments,
    });

    if (files.length > 10) {
      for (let i = 10; i < files.length; i += 10) {
        const chunk = files.slice(i, i + 10);
        const nextAttachments = chunk.map((file) => {
          const builder = new AttachmentBuilder(path.join(targetDir, file));
          if (isBlur) builder.setName(`SPOILER_${file}`);
          return builder;
        });
        await interaction.followUp({ files: nextAttachments }).catch((err) => {
          console.error("❌ ไม่สามารถส่งรูปภาพเพิ่มเติมได้:", err);
        });
      }
    }
  }
}
