import { EmbedBuilder } from "discord.js";
import { getHelperSettings, saveHelperSettings } from "../../utils/db.js";

export async function handleSetHelperCommands(interaction) {
  const { guildId } = interaction;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "setup") {
    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString("name");
    const imageAttachment = interaction.options.getAttachment("image");
    const imageUrl = interaction.options.getString("image_url");

    let avatar = null;

    if (imageAttachment) {
      avatar = imageAttachment.url;
    } else if (imageUrl) {
      avatar = imageUrl.trim();
    }

    const currentSettings = getHelperSettings(guildId);
    if (!avatar && currentSettings.avatar) {
      avatar = currentSettings.avatar;
    }

    saveHelperSettings(guildId, {
      enabled: true,
      name: name.trim(),
      avatar: avatar || null,
    });

    const embed = new EmbedBuilder()
      .setTitle("🎭 ตั้งค่าบอทผู้ช่วย (Helper) สำเร็จ!")
      .setDescription(`บอทจะใช้ชื่อและรูปโปรไฟล์นี้ในการส่งข้อความต่างๆ ในเซิร์ฟเวอร์ (Welcome, Announce, Level Up, Form) ค่ะ`)
      .addFields(
        { name: "🏷️ ชื่อผู้ช่วย (Helper Name)", value: `**${name}**`, inline: true },
        { name: "🖼️ รูปโปรไฟล์ (Avatar)", value: avatar ? `[คลิกเพื่อดูรูป](${avatar})` : "*ใช้รูปเริ่มต้นของบอท*", inline: true }
      )
      .setColor(0x57f287)
      .setTimestamp();

    if (avatar) {
      embed.setThumbnail(avatar);
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
