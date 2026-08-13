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
  getMemberBannerPath,
  saveMemberFormSettings,
  getMemberFormBannerPath,
} from "../../utils/db.js";
import { convertMp4ToGif, downloadAndConvertToGif } from "../../utils/canvas.js";
import { sendHelperMessage } from "../../utils/helper.js";

export async function handleSetMemberCommands(interaction) {
  const { guildId } = interaction;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "setup") {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const newRole = interaction.options.getRole("newrole");
    const buttonText = interaction.options.getString("button");
    const removeRole = interaction.options.getRole("removerole");
    const bannerAttachment = interaction.options.getAttachment("banner");

    if (bannerAttachment) {
      const bannerGifPath = path.join(DATABASE_DIR, guildId, "member", "banner.gif");
      const bannerWebpPath = path.join(DATABASE_DIR, guildId, "member", "banner.webp");
      const tempVideoPath = path.join(DATABASE_DIR, guildId, "member", "temp_input.mp4");

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

    const customId = `claim_role_${newRole.id}_${removeRole ? removeRole.id : "none"}`;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0xff69b4)
      .setFooter({
        text: `${interaction.guild?.name || "PurrPaw"} Verification System`,
        iconURL: interaction.guild?.iconURL({ dynamic: true }) || undefined,
      })
      .setTimestamp();

    const sendOptions = { embeds: [embed] };
    const bannerInfo = getMemberBannerPath(guildId);

    if (bannerInfo) {
      const bannerAttachmentFile = new AttachmentBuilder(bannerInfo.path, { name: bannerInfo.filename });
      embed.setImage(`attachment://${bannerInfo.filename}`);
      sendOptions.files = [bannerAttachmentFile];
    }

    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(buttonText)
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);
    sendOptions.components = [row];

    await sendHelperMessage(interaction.channel, sendOptions, guildId);
    await interaction.editReply({ content: "✅ สร้างและส่งข้อความยืนยันสิทธิ์สมาชิกเรียบร้อยแล้ว!" });
  } else if (subcommand === "form-setup") {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const buttonText = interaction.options.getString("button");
    const pendingRole = interaction.options.getRole("pendingrole");
    const approvedRole = interaction.options.getRole("approvedrole");
    const logChannel = interaction.options.getChannel("logchannel");
    const announceChannel = interaction.options.getChannel("announce") || interaction.options.getChannel("annouce");
    const q1 = interaction.options.getString("question1");
    const q2 = interaction.options.getString("question2");
    const q3 = interaction.options.getString("question3");
    const bannerAttachment = interaction.options.getAttachment("banner");

    saveMemberFormSettings(guildId, {
      title,
      description,
      buttonText,
      pendingRoleId: pendingRole.id,
      approvedRoleId: approvedRole.id,
      logChannelId: logChannel.id,
      announceChannelId: announceChannel ? announceChannel.id : null,
      question1: q1,
      question2: q2 || null,
      question3: q3 || null,
    });

    if (bannerAttachment) {
      const bannerGifPath = path.join(DATABASE_DIR, guildId, "member_form", "banner.gif");
      const bannerWebpPath = path.join(DATABASE_DIR, guildId, "member_form", "banner.webp");
      const tempVideoPath = path.join(DATABASE_DIR, guildId, "member_form", "temp_input.mp4");

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

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0xff69b4)
      .setFooter({
        text: `${interaction.guild?.name || "PurrPaw"} Verification Form`,
        iconURL: interaction.guild?.iconURL({ dynamic: true }) || undefined,
      })
      .setTimestamp();

    const sendOptions = { embeds: [embed] };
    const bannerInfo = getMemberFormBannerPath(guildId);

    if (bannerInfo) {
      const bannerAttachmentFile = new AttachmentBuilder(bannerInfo.path, { name: bannerInfo.filename });
      embed.setImage(`attachment://${bannerInfo.filename}`);
      sendOptions.files = [bannerAttachmentFile];
    }

    const button = new ButtonBuilder()
      .setCustomId("open_verify_form_btn")
      .setLabel(buttonText)
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);
    sendOptions.components = [row];

    await sendHelperMessage(interaction.channel, sendOptions, guildId);
    const announceText = announceChannel ? ` และจะส่งข้อความประกาศต้อนรับที่ห้อง <#${announceChannel.id}> เมื่ออนุมัติ` : "";
    await interaction.editReply({ content: `✅ สร้างและส่งฟอร์มคัดกรองสมาชิกเรียบร้อยแล้ว! คำตอบจะถูกส่งไปที่ห้อง <#${logChannel.id}> ให้ทีมงานอนุมัติ${announceText}ค่ะ` });
  }
}
