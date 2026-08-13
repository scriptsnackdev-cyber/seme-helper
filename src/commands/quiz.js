import fs from "fs";
import path from "path";
import {
  EmbedBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import {
  DATABASE_DIR,
  getQuizConfig,
  saveQuizConfig,
  getQuizHeaderBannerPath,
} from "../utils/db.js";
import { convertMp4ToGif, downloadAndConvertToGif } from "../utils/canvas.js";
import { sendHelperMessage } from "../utils/helper.js";

export async function handleQuizCommand(interaction) {
  const { guildId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const config = getQuizConfig(guildId);

  if (subcommand === "add-result") {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title").trim();
    const role = interaction.options.getRole("role");
    const description = interaction.options.getString("description");
    const bannerAttachment = interaction.options.getAttachment("banner");

    if (!config.results) config.results = [];

    const existingIndex = config.results.findIndex((r) => r.id === title || r.title === title);
    const newResult = {
      id: title,
      title,
      roleId: role.id,
      roleName: role.name,
      description,
    };

    if (existingIndex >= 0) {
      config.results[existingIndex] = newResult;
    } else {
      config.results.push(newResult);
    }

    saveQuizConfig(guildId, config);

    if (bannerAttachment) {
      const encId = encodeURIComponent(title);
      const gifPath = path.join(DATABASE_DIR, guildId, "quiz", "results", `${encId}.gif`);
      const webpPath = path.join(DATABASE_DIR, guildId, "quiz", "results", `${encId}.webp`);
      const tempVideoPath = path.join(DATABASE_DIR, guildId, "quiz", "results", `temp_${encId}.mp4`);

      if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
      if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath);

      const contentType = bannerAttachment.contentType || "";
      const fileName = bannerAttachment.name.toLowerCase();
      const isVideo = contentType.startsWith("video/") || fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".webm");

      if (isVideo) {
        await convertMp4ToGif(bannerAttachment.url, gifPath, tempVideoPath);
      } else {
        await downloadAndConvertToGif(bannerAttachment.url, gifPath);
      }
    }

    await interaction.editReply({
      content: `✅ เพิ่ม/แก้ไข ผลลัพธ์ **"${title}"** สำหรับแจกยศ **${role.name}** เรียบร้อยแล้วค่ะ!`,
    });
  } else if (subcommand === "add-question") {
    const text = interaction.options.getString("text");
    const opt1Label = interaction.options.getString("opt1_label");
    const opt1Result = interaction.options.getString("opt1_result").trim();
    const opt2Label = interaction.options.getString("opt2_label");
    const opt2Result = interaction.options.getString("opt2_result").trim();

    const opt3Label = interaction.options.getString("opt3_label");
    const opt3Result = interaction.options.getString("opt3_result") ? interaction.options.getString("opt3_result").trim() : null;
    const opt4Label = interaction.options.getString("opt4_label");
    const opt4Result = interaction.options.getString("opt4_result") ? interaction.options.getString("opt4_result").trim() : null;

    if (!config.questions) config.questions = [];

    const options = [
      { id: "opt1", label: opt1Label, resultId: opt1Result },
      { id: "opt2", label: opt2Label, resultId: opt2Result },
    ];

    if (opt3Label && opt3Result) options.push({ id: "opt3", label: opt3Label, resultId: opt3Result });
    if (opt4Label && opt4Result) options.push({ id: "opt4", label: opt4Label, resultId: opt4Result });

    const qId = `q${config.questions.length + 1}`;
    config.questions.push({
      id: qId,
      text,
      options,
    });

    saveQuizConfig(guildId, config);

    await interaction.reply({
      content: `✅ เพิ่มคำถามข้อที่ **${config.questions.length}** เรียบร้อยแล้วค่ะ!\n📝 **คำถาม:** ${text}`,
      ephemeral: true,
    });
  } else if (subcommand === "setup") {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title") || config.title || "แบบทดสอบวัดระดับยศ";
    const description = interaction.options.getString("description") || config.description || "กดปุ่มด้านล่างเพื่อเริ่มทำแบบทดสอบและวัดยศของคุณ!";
    const buttonText = interaction.options.getString("button") || config.buttonText || "🧠 ทำแบบทดสอบ";
    const bannerAttachment = interaction.options.getAttachment("header-banner");

    config.title = title;
    config.description = description;
    config.buttonText = buttonText;
    saveQuizConfig(guildId, config);

    if (bannerAttachment) {
      const gifPath = path.join(DATABASE_DIR, guildId, "quiz", "header_banner.gif");
      const webpPath = path.join(DATABASE_DIR, guildId, "quiz", "header_banner.webp");
      const tempVideoPath = path.join(DATABASE_DIR, guildId, "quiz", "temp_header.mp4");

      if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
      if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath);

      const contentType = bannerAttachment.contentType || "";
      const fileName = bannerAttachment.name.toLowerCase();
      const isVideo = contentType.startsWith("video/") || fileName.endsWith(".mp4") || fileName.endsWith(".mov") || fileName.endsWith(".webm");

      if (isVideo) {
        await convertMp4ToGif(bannerAttachment.url, gifPath, tempVideoPath);
      } else {
        await downloadAndConvertToGif(bannerAttachment.url, gifPath);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`🧠 ${title}`)
      .setDescription(description)
      .setColor(0xff69b4)
      .setFooter({
        text: `${interaction.guild?.name || "PurrPaw"} Interactive Quiz System`,
        iconURL: interaction.guild?.iconURL({ dynamic: true }) || undefined,
      })
      .setTimestamp();

    const sendOptions = { embeds: [embed] };
    const bannerInfo = getQuizHeaderBannerPath(guildId);

    if (bannerInfo) {
      const bannerAttachmentFile = new AttachmentBuilder(bannerInfo.path, { name: bannerInfo.filename });
      embed.setImage(`attachment://${bannerInfo.filename}`);
      sendOptions.files = [bannerAttachmentFile];
    }

    const button = new ButtonBuilder()
      .setCustomId("start_quiz_btn")
      .setLabel(buttonText)
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);
    sendOptions.components = [row];

    await sendHelperMessage(interaction.channel, sendOptions, guildId);
    await interaction.editReply({ content: "✅ สร้างและส่งแบบทดสอบ Interactive Quiz ลงในช่องนี้เรียบร้อยแล้วค่ะ!" });
  } else if (subcommand === "delete-result") {
    const title = interaction.options.getString("title").trim();
    if (!config.results || config.results.length === 0) {
      await interaction.reply({ content: "⚠️ ยังไม่มีผลลัพธ์ยศในระบบค่ะ", ephemeral: true });
      return;
    }

    const index = config.results.findIndex((r) => r.id === title || r.title === title);
    if (index === -1) {
      await interaction.reply({ content: `❌ ไม่พบผลลัพธ์ชื่อ **"${title}"** ในระบบค่ะ`, ephemeral: true });
      return;
    }

    config.results.splice(index, 1);
    saveQuizConfig(guildId, config);

    const encId = encodeURIComponent(title);
    const gifPath = path.join(DATABASE_DIR, guildId, "quiz", "results", `${encId}.gif`);
    const webpPath = path.join(DATABASE_DIR, guildId, "quiz", "results", `${encId}.webp`);
    if (fs.existsSync(gifPath)) fs.unlinkSync(gifPath);
    if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath);

    await interaction.reply({ content: `✅ ลบผลลัพธ์ **"${title}"** ออกจากระบบเรียบร้อยแล้วค่ะ`, ephemeral: true });
  } else if (subcommand === "delete-question") {
    const index = interaction.options.getInteger("index") - 1;
    if (!config.questions || config.questions.length === 0) {
      await interaction.reply({ content: "⚠️ ยังไม่มีข้อคำถามในระบบค่ะ", ephemeral: true });
      return;
    }

    if (index < 0 || index >= config.questions.length) {
      await interaction.reply({ content: `❌ ไม่พบข้อคำถามลำดับที่ **${index + 1}** ค่ะ`, ephemeral: true });
      return;
    }

    const removed = config.questions.splice(index, 1);
    saveQuizConfig(guildId, config);

    await interaction.reply({ content: `✅ ลบคำถามข้อที่ **${index + 1}** ("${removed[0].text}") ออกจากระบบเรียบร้อยแล้วค่ะ`, ephemeral: true });
  }
}
