import fs from "fs";
import path from "path";
import sharp from "sharp";
import { EmbedBuilder } from "discord.js";
import { DATABASE_DIR, ensureGuildDatabase, getHelperSettings, saveHelperSettings, getHelperAvatarPath } from "../../utils/db.js";

export async function handleSetHelperCommands(interaction) {
  const { guildId } = interaction;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "setup") {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString("name");
    const imageAttachment = interaction.options.getAttachment("image");
    const imageUrl = interaction.options.getString("image_url");

    let avatarUrl = null;
    ensureGuildDatabase(guildId);
    const localAvatarPath = path.join(DATABASE_DIR, guildId, "helper_avatar.png");

    if (imageAttachment) {
      try {
        const res = await fetch(imageAttachment.url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          await sharp(buffer).png().toFile(localAvatarPath);
          avatarUrl = imageAttachment.url;
        }
      } catch (err) {
        console.error("❌ ไม่สามารถบันทึกรูปโปรไฟล์ผู้ช่วยได้:", err);
      }
    } else if (imageUrl) {
      avatarUrl = imageUrl.trim();
      try {
        const res = await fetch(avatarUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          await sharp(buffer).png().toFile(localAvatarPath);
        }
      } catch (err) {
        console.warn("⚠️ ไม่สามารถโหลดรูปจาก URL มาเซฟในเครื่องได้:", err.message);
      }
    }

    const currentSettings = getHelperSettings(guildId);
    if (!avatarUrl && currentSettings.avatar) {
      avatarUrl = currentSettings.avatar;
    }

    saveHelperSettings(guildId, {
      enabled: true,
      name: name.trim(),
      avatar: avatarUrl || null,
    });

    const embed = new EmbedBuilder()
      .setTitle("🎭 ตั้งค่าบอทผู้ช่วย (Helper) สำเร็จ!")
      .setDescription(`บอทจะใช้ชื่อและรูปโปรไฟล์นี้ในการส่งข้อความต่างๆ ในเซิร์ฟเวอร์ (Welcome, Announce, Level Up, Form) ค่ะ`)
      .addFields(
        { name: "🏷️ ชื่อผู้ช่วย (Helper Name)", value: `**${name}**`, inline: true },
        { name: "🖼️ รูปโปรไฟล์ (Avatar)", value: avatarUrl ? `[คลิกเพื่อดูรูป](${avatarUrl})` : (fs.existsSync(localAvatarPath) ? "*บันทึกรูปภาพลงระบบเรียบร้อย*" : "*ใช้รูปเริ่มต้นของบอท*"), inline: true }
      )
      .setColor(0x57f287)
      .setTimestamp();

    if (avatarUrl) {
      embed.setThumbnail(avatarUrl);
    }

    await interaction.editReply({ embeds: [embed] });
  } else if (subcommand === "status") {
    const settings = getHelperSettings(guildId);

    const embed = new EmbedBuilder()
      .setTitle("🤖 ข้อมูลการตั้งค่าบอทผู้ช่วย (Helper)")
      .setColor(settings.enabled ? 0x57f287 : 0xed4245)
      .addFields(
        { name: "สถานะ (Status)", value: settings.enabled ? "🟢 เปิดใช้งาน (Enabled)" : "🔴 ปิดใช้งาน (Disabled)", inline: true },
        { name: "ชื่อผู้ช่วย (Name)", value: settings.name ? `**${settings.name}**` : "*ยังไม่ได้ตั้งค่า*", inline: true },
        { name: "รูปโปรไฟล์ (Avatar)", value: settings.avatar ? `[คลิกเพื่อดูรูป](${settings.avatar})` : "*ใช้รูปเริ่มต้นของบอท*", inline: false }
      )
      .setTimestamp();

    if (settings.avatar) {
      embed.setThumbnail(settings.avatar);
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else if (subcommand === "reset") {
    saveHelperSettings(guildId, {
      enabled: false,
      name: null,
      avatar: null,
    });

    await interaction.reply({
      content: "🔄 รีเซ็ตการตั้งค่าบอทผู้ช่วยเรียบร้อยแล้วค่ะ บอทจะกลับมาใช้ชื่อและรูปโปรไฟล์เริ่มต้นของบอทตามปกติค่ะ",
      ephemeral: true,
    });
  }
}
