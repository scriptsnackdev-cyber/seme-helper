import { respondToInteraction, deferCommand, errorSummary, sendHelperMessage } from "../utils/helper.js";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { MessageFlags, AttachmentBuilder } from "discord.js";
import { DATABASE_DIR, ensureGuildDatabase, getImageGalleryData, saveImageGalleryData } from "../utils/db.js";

function sanitizeFolderName(name) {
  return name.replace(/[\/\\:\*\?"<>\|]/g, "_").replace(/\.\./g, "_").trim();
}

export async function handleImageCommand(interaction) {
  const { guildId } = interaction;
  if (!guildId) {
    await respondToInteraction(interaction, { content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", flags: MessageFlags.Ephemeral });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  await deferCommand(interaction);
  ensureGuildDatabase(guildId);

  if (subcommand === "add") {

    const rawTitle = (interaction.options.getString("title") ?? "").trim();
    const categoryTitle = sanitizeFolderName(rawTitle);
    const blurOption = interaction.options.getBoolean("blur") ?? false;

    if (!categoryTitle) {
      await respondToInteraction(interaction, { content: "❌ กรุณาระบุชื่อหมวดหมู่ให้ถูกต้องค่ะ", flags: MessageFlags.Ephemeral });
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
      await respondToInteraction(interaction, { content: "❌ กรุณาแนบไฟล์รูปภาพอย่างน้อย 1 รูปค่ะ", flags: MessageFlags.Ephemeral });
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
        console.error(`❌ ไม่สามารถแปลงรูปภาพ ${att.name}:`, errorSummary(err));
        failCount++;
      }
    }

    if (savedCount === 0) {
      await respondToInteraction(interaction, { content: "บันทึกรูปไม่สำเร็จ ล้มเหลว " + failCount + " รูป กรุณาตรวจไฟล์แล้วลองใหม่" });
      return;
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
    await respondToInteraction(interaction, {
      content: `Success: บันทึก **${categoryTitle}** จำนวน ${savedCount} รูป ล้มเหลว ${failCount} รูป${blurText}`,
      flags: MessageFlags.Ephemeral,
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
      await respondToInteraction(interaction, { content: "📁 ยังไม่มีคลังรูปภาพในเซิร์ฟเวอร์นี้ค่ะ", flags: MessageFlags.Ephemeral });
      return;
    }

    const content = "รายการคลังรูปภาพทั้งหมดในเซิร์ฟเวอร์:\n\n" + categoryList.join("\n");
    const chunks = content.match(/[\s\S]{1,1900}/g);
    if (!await respondToInteraction(interaction, { content: chunks[0] })) return;
    for (const chunk of chunks.slice(1)) {
      await interaction.followUp({ content: chunk, flags: MessageFlags.Ephemeral });
    }
  } else if (subcommand === "delete") {
    const rawTitle = (interaction.options.getString("title") ?? "").trim();
    const imageIndex = interaction.options.getInteger("index");
    const categoryTitle = sanitizeFolderName(rawTitle);
    const targetDir = path.join(DATABASE_DIR, guildId, "image", categoryTitle);

    if (!fs.existsSync(targetDir)) {
      await respondToInteraction(interaction, { content: `❌ ไม่พบคลังรูปภาพหมวดหมู่ **"${categoryTitle}"** ค่ะ`, flags: MessageFlags.Ephemeral });
      return;
    }

    const files = fs.readdirSync(targetDir).filter((f) => f.endsWith(".webp") || f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".gif"));

    if (files.length === 0) {
      await respondToInteraction(interaction, { content: `❌ ไม่พบรูปภาพในหมวดหมู่ **"${categoryTitle}"** ค่ะ`, flags: MessageFlags.Ephemeral });
      return;
    }

    const galleryData = getImageGalleryData(guildId);

    // 1. กรณีระบุลำดับรูปภาพ (ลบเฉพาะรูปตาม index)
    if (imageIndex !== null && imageIndex !== undefined) {
      if (imageIndex < 1 || imageIndex > files.length) {
        await respondToInteraction(interaction, {
          content: `❌ ไม่พบรูปภาพลำดับที่ **${imageIndex}** ค่ะ (หมวดหมู่นี้มีทั้งหมด **${files.length}** รูป กรุณาระบุลำดับระหว่าง 1 ถึง ${files.length})`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const targetFileName = files[imageIndex - 1];
      const targetFilePath = path.join(targetDir, targetFileName);

      if (fs.existsSync(targetFilePath)) {
        fs.unlinkSync(targetFilePath);
      }

      // อัปเดตข้อมูล data.json
      if (galleryData.titles && galleryData.titles[categoryTitle]) {
        const existing = galleryData.titles[categoryTitle];
        if (Array.isArray(existing.images)) {
          existing.images = existing.images.filter((img) => img !== targetFileName);
          existing.imageCount = existing.images.length;
        } else {
          existing.imageCount = Math.max(0, (existing.imageCount || files.length) - 1);
        }
        existing.updatedAt = new Date().toISOString();

        // ถ้ารูปหมดแล้ว ให้ลบหมวดหมู่ออกจาก data.json และลบโฟลเดอร์ทิ้ง
        if (existing.imageCount === 0 || (existing.images && existing.images.length === 0)) {
          delete galleryData.titles[categoryTitle];
          if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }
        }
        saveImageGalleryData(guildId, galleryData);
      }

      const remainingCount = files.length - 1;
      const remainText = remainingCount > 0 ? ` (ยังเหลืออีก ${remainingCount} รูปในหมวดหมู่นี้)` : ` (หมวดหมู่นี้ไม่มีรูปภาพเหลืออยู่แล้ว จึงลบหมวดหมู่ออกอัตโนมัติ)`;

      await respondToInteraction(interaction, {
        content: `✅ ลบรูปภาพลำดับที่ **${imageIndex}** ออกจากหมวดหมู่ **"${categoryTitle}"** เรียบร้อยแล้วค่ะ${remainText}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 2. กรณีไม่ระบุลำดับ (ลบทั้งหมวดหมู่)
    let deleted = false;
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      deleted = true;
    }

    if (galleryData.titles && galleryData.titles[categoryTitle]) {
      delete galleryData.titles[categoryTitle];
      saveImageGalleryData(guildId, galleryData);
      deleted = true;
    }

    if (deleted) {
      await respondToInteraction(interaction, { content: `✅ ลบคลังรูปภาพหมวดหมู่ **"${categoryTitle}"** (ทั้งหมด ${files.length} รูป) ออกเรียบร้อยแล้วค่ะ`, flags: MessageFlags.Ephemeral });
    } else {
      await respondToInteraction(interaction, { content: `❌ ไม่พบคลังรูปภาพหมวดหมู่ **"${categoryTitle}"** ค่ะ`, flags: MessageFlags.Ephemeral });
    }
  } else if (subcommand === "view") {

    const rawTitle = (interaction.options.getString("title") ?? "").trim();
    const categoryTitle = sanitizeFolderName(rawTitle);
    const targetDir = path.join(DATABASE_DIR, guildId, "image", categoryTitle);

    if (!fs.existsSync(targetDir)) {
      await respondToInteraction(interaction, { content: `❌ ไม่พบคลังรูปภาพหมวดหมู่ **"${categoryTitle}"** ค่ะ` });
      return;
    }

    const files = fs.readdirSync(targetDir).filter((f) => f.endsWith(".webp") || f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".gif"));

    if (files.length === 0) {
      await respondToInteraction(interaction, { content: `❌ ไม่พบรูปภาพในหมวดหมู่ **"${categoryTitle}"** ค่ะ` });
      return;
    }

    // ตรวจสอบค่า blur จาก data.json
    const galleryData = getImageGalleryData(guildId);
    const isBlur = galleryData.titles?.[categoryTitle]?.blur === true;

    let sentCount = 0;
    let firstMessage;
    try {
      for (let index = 0; index < files.length; index += 10) {
        const chunk = files.slice(index, index + 10);
        const attachments = chunk.map((file, offset) => new AttachmentBuilder(path.join(targetDir, file), {
          name: (isBlur ? "SPOILER_" : "") + "image_" + (index + offset + 1) + "_" + file,
        }));
        const message = await sendHelperMessage(interaction.channel, {
          ...(index === 0 ? {
            content: "รูปภาพในคลัง **" + categoryTitle + "** (ทั้งหมด " + files.length + " รูป)" + (isBlur ? " (Spoiler)" : "")
              + "\nลบเฉพาะรูปด้วย `/image delete title:" + categoryTitle + " index:<ลำดับรูป>`",
          } : {}),
          files: attachments,
        }, guildId);
        if (index === 0) firstMessage = message;
        sentCount += chunk.length;
      }
    } catch (error) {
      console.warn("ส่งคลังรูปภาพผ่าน Helper ไม่ครบ:", errorSummary(error));
      await respondToInteraction(interaction, {
        content: "ยืนยันการส่งสำเร็จ " + sentCount + " / " + files.length + " รูป ชุดถัดไปมีปัญหา: " + (error.code
          ? "กรุณาตรวจขนาดไฟล์และสิทธิ์ Helper Webhook (รหัส " + error.code + ")"
          : error.message),
      });
      return;
    }
    await respondToInteraction(interaction, { content: "Success: ส่งรูปภาพ " + sentCount + " รูปเรียบร้อยแล้ว " + firstMessage.url });
  }
}
