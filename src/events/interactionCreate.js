import fs from "fs";
import path from "path";
import {
  MessageFlags,
  EmbedBuilder,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonStyle,
  ButtonBuilder,
  PermissionFlagsBits,
} from "discord.js";

import {
  DATABASE_DIR,
  ensureGuildDatabase,
  getMemberFormSettings,
  getMemberFormBannerPath,
  getQuizConfig,
  getQuizResultBannerPath,
  getImageGalleryData,
} from "../utils/db.js";

import { handleSetWelcomeCommands } from "../commands/set/setWelcome.js";
import { handleSetMemberCommands } from "../commands/set/setMember.js";
import { handleSetLevelingCommands } from "../commands/set/setLeveling.js";
import { handleSetGiveRoleCommands } from "../commands/set/setGiveRole.js";
import { handleSetHelperCommands } from "../commands/set/setHelper.js";
import { handleSetIntroCommands } from "../commands/set/setIntro.js";
import { handleSetReactionRoleCommands } from "../commands/set/setReactionRole.js";
import { handleSetJailCommands } from "../commands/set/setJail.js";
import { handleGiveRoleCommand } from "../commands/giverole.js";
import { handleJailCommand, handleUnjailCommand } from "../commands/jail.js";
import { handleQuizCommand } from "../commands/quiz.js";
import { handleImageCommand } from "../commands/image.js";
import { handleHelperCommand } from "../commands/helper.js";
import { handleRankCommand, handleLeaderboardCommand } from "../commands/rank.js";
import { handleMusicCommand, handleMusicButtonInteraction } from "../commands/music.js";
import { hasStaffPermission, assertRoleManageable } from "../utils/permission.js";
import { sendHelperMessage, editHelperMessage, respondToInteraction, deferCommand, errorSummary } from "../utils/helper.js";

const quizSessions = new Map();
const processingReviews = new Set();

// ทำความสะอาดเซสชัน Quiz ที่หมดอายุเกิน 15 นาที เพื่อป้องกัน Memory Leak
function cleanupQuizSessions() {
  const now = Date.now();
  for (const [key, session] of quizSessions.entries()) {
    if (now - (session.createdAt || 0) > 15 * 60 * 1000) {
      quizSessions.delete(key);
    }
  }
}

function renderProgressBar(current, total) {
  const percentage = Math.round(((current + 1) / total) * 100);
  const filledCount = Math.round(((current + 1) / total) * 10);
  const bar = "🟩".repeat(filledCount) + "⬜".repeat(Math.max(0, 10 - filledCount));
  return `${bar} ${percentage}%`;
}

function buildQuestionPayload(guildId, qIndex, sessionId) {
  const config = getQuizConfig(guildId);
  const question = config.questions[qIndex];
  const total = config.questions.length;

  const progressBarText = renderProgressBar(qIndex, total);

  const embed = new EmbedBuilder()
    .setTitle(`${config.title || "แบบทดสอบ"}: ข้อที่ ${qIndex + 1}/${total}`)
    .setDescription(`${progressBarText}\n\n**คำถาม:** ${question.text}\n\n*เลือกสิ่งที่ตรงกับคุณมากที่สุด*`)
    .setColor(0xff69b4);

  const rows = [];
  let currentRow = new ActionRowBuilder();

  (question.options || []).forEach((opt, idx) => {
    const btn = new ButtonBuilder()
      .setCustomId(`quiz_opt_${qIndex}_${opt.id}_${sessionId}`)
      .setLabel(opt.label.slice(0, 80))
      .setStyle(ButtonStyle.Secondary);

    currentRow.addComponents(btn);

    if (currentRow.components.length === 2 || idx === question.options.length - 1) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  });

  return { embeds: [embed], components: rows };
}

export function setupInteractionCreateEvent(client) {
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await deferCommand(interaction);
      }

      // 0. ปุ่มควบคุมเครื่องเล่นเพลง
      if (interaction.isButton() && interaction.customId.startsWith("music_")) {
        await handleMusicButtonInteraction(interaction);
        return;
      }

      // 1. ปุ่มรับยศทันที
      if (interaction.isButton() && interaction.customId.startsWith("claim_role_")) {
        const parts = interaction.customId.split("_");
        const newRoleId = parts[2];
        const removeRoleId = parts[3];

        const member = interaction.member;
        const guild = interaction.guild;

        if (!guild || !member) return;

        await deferCommand(interaction);
        let addedRoleName = "";
        let roleToRemove = null;
        try {
          const roleToAdd = newRoleId && newRoleId !== "none"
            ? await guild.roles.fetch(newRoleId) : null;
          if (newRoleId && newRoleId !== "none") await assertRoleManageable(guild, roleToAdd);
          if (removeRoleId && removeRoleId !== "none" && removeRoleId !== newRoleId) {
            roleToRemove = await guild.roles.fetch(removeRoleId);
            await assertRoleManageable(guild, roleToRemove);
          }
          if (roleToAdd) {
            await member.roles.add(roleToAdd);
            addedRoleName = roleToAdd.name;
          }
        } catch (error) {
          console.warn("แจกยศยืนยันสิทธิ์ไม่สำเร็จ:", errorSummary(error));
          await respondToInteraction(interaction, {
            content: error.code ? "แจกยศไม่สำเร็จ (รหัส " + error.code + ") กรุณาตรวจสอบสิทธิ์และลำดับยศบอท" : error.message,
          });
          return;
        }
        let removalNotice = "";
        if (roleToRemove) {
          try { await member.roles.remove(roleToRemove); }
          catch (error) {
            console.warn("ถอดยศเดิมไม่สำเร็จ:", errorSummary(error));
            removalNotice = " แต่ถอดยศเดิมไม่สำเร็จ กรุณาแจ้งผู้ดูแล";
          }
        }
        await respondToInteraction(interaction, {
          content: "Success: ยืนยันสิทธิ์สำเร็จ" + (addedRoleName ? " ได้รับยศ **" + addedRoleName + "**" : "") + removalNotice,
        });
        return;
      }

      // 2. ปุ่มเปิดฟอร์มคัดกรองสมาชิก
      if (interaction.isButton() && interaction.customId === "open_verify_form_btn") {
        const guildId = interaction.guildId;
        const memberFormSettings = getMemberFormSettings(guildId);

        if (!memberFormSettings) {
          await respondToInteraction(interaction, { content: "❌ ยังไม่ได้ตั้งค่าระบบฟอร์มคัดกรองในเซิร์ฟเวอร์นี้ค่ะ", flags: MessageFlags.Ephemeral });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId("verify_form_modal")
          .setTitle("📝 ฟอร์มคัดกรองยืนยันสิทธิ์สมาชิก");

        const q1Label = (memberFormSettings.question1 || "คำถามที่ 1").slice(0, 45);
        const q1Input = new TextInputBuilder()
          .setCustomId("q1_input")
          .setLabel(q1Label)
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1024)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(q1Input));

        if (memberFormSettings.question2) {
          const q2Input = new TextInputBuilder()
            .setCustomId("q2_input")
            .setLabel(memberFormSettings.question2.slice(0, 45))
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1024)
            .setRequired(false);
          modal.addComponents(new ActionRowBuilder().addComponents(q2Input));
        }

        if (memberFormSettings.question3) {
          const q3Input = new TextInputBuilder()
            .setCustomId("q3_input")
            .setLabel(memberFormSettings.question3.slice(0, 45))
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1024)
            .setRequired(false);
          modal.addComponents(new ActionRowBuilder().addComponents(q3Input));
        }

        await interaction.showModal(modal);
        return;
      }

      // 3. ปุ่มอนุมัติ / ปฏิเสธฟอร์มคัดกรองของทีมงาน
      if (interaction.isButton() && (interaction.customId.startsWith("approve_member_") || interaction.customId.startsWith("reject_member_"))) {
        await deferCommand(interaction);
        const reviewKey = interaction.message.id;
        if (processingReviews.has(reviewKey)) {
          await respondToInteraction(interaction, { content: "รายการนี้กำลังถูกตรวจสอบ กรุณารอสักครู่" });
          return;
        }
        processingReviews.add(reviewKey);
        try {
          const hasPermission = await hasStaffPermission(interaction, PermissionFlagsBits.ManageRoles);
          if (!hasPermission) {
            await respondToInteraction(interaction, {
              content: "❌ เฉพาะทีมงานที่มีสิทธิ์จัดการยศ (Manage Roles) หรือยศสูงกว่าบอทเท่านั้นที่สามารถกดอนุมัติหรือปฏิเสธสมาชิกได้ค่ะ",
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          const currentMessage = await interaction.channel.messages.fetch({ message: reviewKey, force: true });
          const originalEmbed = currentMessage.embeds[0];
          if (!originalEmbed) {
            await respondToInteraction(interaction, { content: "❌ ไม่พบข้อมูลฟอร์มในข้อความนี้ค่ะ", flags: MessageFlags.Ephemeral });
            return;
          }

          // ป้องกันการกดย้ำหรือทำรายการซ้ำซ้อน
          if (currentMessage.components.length === 0) {
            await respondToInteraction(interaction, { content: "⚠️ รายการนี้ได้รับการตรวจสอบเรียบร้อยแล้วค่ะ", flags: MessageFlags.Ephemeral });
            return;
          }

          const isApprove = interaction.customId.startsWith("approve_member_");
          const targetUserId = interaction.customId.replace(isApprove ? "approve_member_" : "reject_member_", "");
          const guild = interaction.guild;
          const guildId = interaction.guildId;
          const memberFormSettings = getMemberFormSettings(guildId);

          const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

          if (!targetMember) {
            const updatedEmbed = EmbedBuilder.from(originalEmbed)
              .setColor(0x95a5a6)
              .setTitle(`⚠️ ไม่พบสมาชิกในเซิร์ฟเวอร์ (โดย ${interaction.user.username})`);
            await editHelperMessage(currentMessage, { embeds: [updatedEmbed], components: [] }).catch(() => null);
            await respondToInteraction(interaction, { content: "❌ ไม่พบสมาชิกในเซิร์ฟเวอร์นี้ (สมาชิกอาจจะออกจากเซิร์ฟเวอร์ไปแล้วค่ะ)", flags: MessageFlags.Ephemeral });
            return;
          }

          let pendingNotice = "";
          if (isApprove) {
            if (!memberFormSettings?.approvedRoleId) {
              await respondToInteraction(interaction, { content: "ยังไม่ได้ตั้งค่ายศ Approved กรุณาตั้งค่าฟอร์มใหม่" });
              return;
            }
            try {
              const approvedRole = await guild.roles.fetch(memberFormSettings.approvedRoleId);
              await assertRoleManageable(guild, approvedRole);
              await targetMember.roles.add(approvedRole);
            } catch (error) {
              console.warn("แจกยศ Approved ไม่สำเร็จ:", errorSummary(error));
              await respondToInteraction(interaction, {
                content: error.code ? "แจกยศไม่สำเร็จ (รหัส " + error.code + ") ยศ Pending และปุ่มอนุมัติยังอยู่ กรุณาตรวจสอบสิทธิ์บอทแล้วลองใหม่" : error.message,
              });
              return;
            }
            if (memberFormSettings.pendingRoleId && memberFormSettings.pendingRoleId !== memberFormSettings.approvedRoleId) {
              try {
                const pendingRole = await guild.roles.fetch(memberFormSettings.pendingRoleId);
                await assertRoleManageable(guild, pendingRole);
                await targetMember.roles.remove(pendingRole);
              } catch (error) {
                console.warn("ถอด Pending ไม่สำเร็จ:", errorSummary(error));
                pendingNotice = " แต่ถอด Pending ไม่สำเร็จ กรุณาแจ้งผู้ดูแล";
              }
            }

          }
          const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setColor(isApprove ? 0x57f287 : 0xed4245)
            .setTitle((isApprove ? "อนุมัติสมาชิกแล้ว" : "ไม่อนุมัติสมาชิก") + " (โดย " + interaction.user.username + ")");
          try {
            await editHelperMessage(currentMessage, { embeds: [updatedEmbed], components: [] });
          } catch (error) {
            console.warn("อัปเดตข้อความฟอร์มไม่สำเร็จ:", errorSummary(error));
            await respondToInteraction(interaction, {
              content: isApprove ? "Success: ได้รับยศ Approved แล้ว แต่บันทึกผลบนข้อความฟอร์มไม่สำเร็จ กรุณาแจ้งผู้ดูแล" + pendingNotice : "บันทึกผลไม่อนุมัติไม่สำเร็จ กรุณาลองใหม่",
            });
            return;
          }
          await respondToInteraction(interaction, {
            content: (isApprove ? "Success: อนุมัติสมาชิกและมอบยศ Approved เรียบร้อยแล้ว" + pendingNotice : "Success: บันทึกผลไม่อนุมัติสมาชิกเรียบร้อยแล้ว"),
          });

          // Preserve the configured announcement flow for both decisions.
          try {
            if (memberFormSettings?.announceChannelId) {
              const announceChannel = await guild.channels.fetch(memberFormSettings.announceChannelId).catch(() => null);
              if (announceChannel) {
                const q1Field = originalEmbed?.fields?.[0];
                const q1Question = memberFormSettings.question1 ?? "ชื่อ";
                const q1Answer = q1Field?.value ?? targetMember.displayName;

                const welcomeEmbed = new EmbedBuilder()
                  .setTitle(`ยินดีต้อนรับสมาชิกใหม่`)
                  .setDescription(`ขอต้อนรับ <@${targetMember.id}> เข้าสู่ ${guild.name} ค่ะ\n\n**${q1Question}:** **${q1Answer}**`)
                  .setColor(0xff69b4)
                  .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                  .setFooter({
                    text: `${guild.name} Verification System`,
                    iconURL: guild.iconURL({ dynamic: true }) || undefined,
                  })
                  .setTimestamp();

                const announcePayload = {
                  content: `ยินดีต้อนรับสมาชิกใหม่ <@${targetMember.id}> เข้าสู่เซิร์ฟเวอร์ค่ะ (${q1Question}: **${q1Answer}**)`,
                  embeds: [welcomeEmbed],
                };

                const bannerInfo = getMemberFormBannerPath(guildId);
                if (bannerInfo) {
                  const bannerAttachmentFile = new AttachmentBuilder(bannerInfo.path, { name: bannerInfo.filename });
                  welcomeEmbed.setImage(`attachment://${bannerInfo.filename}`);
                  announcePayload.files = [bannerAttachmentFile];
                }

                await sendHelperMessage(announceChannel, announcePayload, guildId).catch((err) => {
                  console.error("❌ ไม่สามารถส่งข้อความประกาศต้อนรับที่ห้อง announce ได้:", errorSummary(err));
                });
              }
            }
          } catch (error) {
            console.warn("บันทึกผลตรวจสอบแล้ว แต่ส่งประกาศไม่สำเร็จ:", errorSummary(error));
          }
          return;
        } finally {
          processingReviews.delete(reviewKey);
        }
      }

      // 4. ปุ่มเริ่มทำ Quiz
      if (interaction.isButton() && interaction.customId === "start_quiz_btn") {
        await deferCommand(interaction);
        cleanupQuizSessions();
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        const config = getQuizConfig(guildId);

        if (!config.questions || config.questions.length === 0 || !config.results || config.results.length === 0) {
          await respondToInteraction(interaction, { content: "⚠️ ระบบแบบทดสอบยังตั้งค่าไม่สมบูรณ์ค่ะ (ต้องมีทั้งข้อคำถามและผลลัพธ์ยศนะคะ)", flags: MessageFlags.Ephemeral });
          return;
        }

        const sessionKey = `${guildId}_${userId}`;
        if (quizSessions.get(sessionKey)?.processing) {
          await respondToInteraction(interaction, { content: "กำลังบันทึกคำตอบแบบทดสอบ กรุณารอให้เสร็จก่อนเริ่มใหม่" });
          return;
        }
        quizSessions.set(sessionKey, {
          id: interaction.id,
          configVersion: JSON.stringify(config),
          processing: false,
          currentIndex: 0,
          scores: {},
          createdAt: Date.now(),
        });

        const payload = buildQuestionPayload(guildId, 0, interaction.id);
        if (!await respondToInteraction(interaction, payload)) quizSessions.delete(sessionKey);
        return;
      }

      // 5. ปุ่มตอบคำถาม Quiz
      if (interaction.isButton() && interaction.customId.startsWith("quiz_opt_")) {
        const parts = interaction.customId.split("_");
        const qIndex = parseInt(parts[2], 10);
        const optId = parts[3];

        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        const sessionKey = `${guildId}_${userId}`;

        const session = quizSessions.get(sessionKey);
        const config = getQuizConfig(guildId);

        if (!session || Date.now() - session.createdAt > 15 * 60 * 1000) {
          quizSessions.delete(sessionKey);
          await respondToInteraction(interaction, { content: "⚠️ เซสชันแบบทดสอบของคุณหมดอายุแล้ว กรุณากดปุ่มทำแบบทดสอบใหม่อีกครั้งนะคะ", flags: MessageFlags.Ephemeral });
          return;
        }

        if (session.configVersion !== JSON.stringify(config)) {
          quizSessions.delete(sessionKey);
          await respondToInteraction(interaction, { content: "แบบทดสอบถูกแก้ไขระหว่างทำ กรุณาเริ่มใหม่", flags: MessageFlags.Ephemeral });
          return;
        }
        if (parts[4] !== session.id || session.processing || qIndex !== session.currentIndex) {
          await respondToInteraction(interaction, { content: "คำตอบนี้ถูกส่งแล้วหรือเป็นแบบทดสอบชุดเก่า กรุณาใช้คำถามล่าสุด", flags: MessageFlags.Ephemeral });
          return;
        }
        const currentQuestion = config.questions[qIndex];
        const selectedOpt = currentQuestion?.options?.find((option) => option.id === optId);
        if (!selectedOpt || !config.results.some((result) => result.id === selectedOpt.resultId || result.title === selectedOpt.resultId)) {
          await respondToInteraction(interaction, { content: "ไม่พบคำถาม ตัวเลือก หรือผลลัพธ์ กรุณาแจ้งผู้ดูแลและเริ่มใหม่", flags: MessageFlags.Ephemeral });
          return;
        }
        session.processing = true;
        try {
          await interaction.deferUpdate();
          if (selectedOpt && selectedOpt.resultId) {
            const resKey = selectedOpt.resultId;
            session.scores[resKey] = (session.scores[resKey] || 0) + 1;
          }

          const nextIndex = qIndex + 1;
          if (nextIndex < config.questions.length) {
            session.currentIndex = nextIndex;
            const nextPayload = buildQuestionPayload(guildId, nextIndex, session.id);
            if (!await respondToInteraction(interaction, nextPayload)) quizSessions.delete(sessionKey);
          } else {
            let highestScore = -1;
            let winningResultId = null;

            for (const [rId, score] of Object.entries(session.scores)) {
              if (score > highestScore) {
                highestScore = score;
                winningResultId = rId;
              }
            }

            let result = (config.results || []).find((r) => r.id === winningResultId || r.title === winningResultId);
            if (!result && config.results && config.results.length > 0) {
              result = config.results[0];
            }

            let roleAddedSuccess = false;
            if (result && result.roleId) {
              const role = await interaction.guild.roles.fetch(result.roleId).catch(() => null);
              if (role) {
                try {
                  await assertRoleManageable(interaction.guild, role);
                  await interaction.member.roles.add(role);
                  roleAddedSuccess = true;
                } catch (err) {
                  console.error("❌ ไม่สามารถแจกยศควิซได้:", errorSummary(err));
                }
              }
            }

            quizSessions.delete(sessionKey);

            let desc = `**ผลลัพธ์ของคุณคือ:** **${result?.title || "ไม่ทราบผล"}**\n\n`;
            if (result?.description) desc += `${result.description}\n\n`;
            if (roleAddedSuccess && result?.roleId) {
              desc += `ระบบได้มอบยศ <@&${result.roleId}> ให้กับคุณเรียบร้อยแล้วค่ะ`;
            } else if (result?.roleId) {
              desc += `ระบบไม่สามารถแจกยศ <@&${result.roleId}> ให้คุณได้ (กรุณาแจ้งแอดมินให้ตรวจสอบสิทธิ์ Manage Roles ของบอทนะคะ)`;
            }

            const resultEmbed = new EmbedBuilder()
              .setTitle(`ผลทดสอบ ${config.title || "ควิซ"}: ${result?.title || "ผลลัพธ์"}`)
              .setDescription(desc)
              .setColor(0xff69b4)
              .setFooter({
                text: `${interaction.guild?.name || "Server"} Interactive Quiz`,
                iconURL: interaction.guild?.iconURL({ dynamic: true }) || undefined,
              })
              .setTimestamp();

            const updatePayload = {
              content: `**สรุปผลแบบทดสอบของคุณเรียบร้อยแล้วค่ะ**`,
              embeds: [resultEmbed],
              components: [],
            };

            if (result) {
              const bannerInfo = getQuizResultBannerPath(guildId, result.id || result.title);
              if (bannerInfo) {
                const attachment = new AttachmentBuilder(bannerInfo.path, { name: bannerInfo.filename });
                resultEmbed.setImage(`attachment://${bannerInfo.filename}`);
                updatePayload.files = [attachment];
              }
            }

            await respondToInteraction(interaction, updatePayload);
          }
        } finally {
          session.processing = false;
        }
        return;
      }

      // 6. Modal การส่งฟอร์มคัดกรองสมาชิก
      if (interaction.isModalSubmit() && interaction.customId === "verify_form_modal") {
        await deferCommand(interaction);
        const guildId = interaction.guildId;
        const memberFormSettings = getMemberFormSettings(guildId);

        if (!memberFormSettings || !memberFormSettings.logChannelId) {
          await respondToInteraction(interaction, { content: "❌ ระบบฟอร์มคัดกรองยังตั้งค่าไม่สมบูรณ์ค่ะ", flags: MessageFlags.Ephemeral });
          return;
        }

        const logChannel = await interaction.guild.channels.fetch(memberFormSettings.logChannelId).catch(() => null);
        if (!logChannel) {
          await respondToInteraction(interaction, { content: "❌ ไม่พบห้อง log สำหรับทีมงานตรวจสอบฟอร์มคัดกรองค่ะ (ห้องอาจถูกลบไปแล้ว)", flags: MessageFlags.Ephemeral });
          return;
        }

        const q1Ans = interaction.fields.getTextInputValue("q1_input");
        let q2Ans = null;
        let q3Ans = null;

        try { q2Ans = interaction.fields.getTextInputValue("q2_input"); } catch (e) { }
        try { q3Ans = interaction.fields.getTextInputValue("q3_input"); } catch (e) { }

        const member = interaction.member;
        const guild = interaction.guild;

        if ([q1Ans, q2Ans, q3Ans].some((answer) => answer && answer.length > 1024)) {
          await respondToInteraction(interaction, { content: "คำตอบแต่ละข้อต้องไม่เกิน 1024 ตัวอักษร กรุณาส่งฟอร์มใหม่" });
          return;
        }

        let pendingNotice = "";
        if (memberFormSettings.pendingRoleId) {
          try {
            const pendingRole = await guild.roles.fetch(memberFormSettings.pendingRoleId);
            await assertRoleManageable(guild, pendingRole);
            await member.roles.add(pendingRole);
            pendingNotice = " ได้รับยศ <@&" + pendingRole.id + "> ระหว่างรอตรวจสอบ";
          } catch (error) {
            console.warn("แจก Pending ไม่สำเร็จ:", errorSummary(error));
            pendingNotice = " แต่แจกยศ Pending ไม่สำเร็จ กรุณาแจ้งผู้ดูแล";
          }
        }

        const logEmbed = new EmbedBuilder()
          .setTitle(`📝 คำตอบฟอร์มคัดกรองใหม่จาก: ${member.user.tag}`)
          .setDescription(`👤 **ผู้ส่ง:** <@${member.id}> (${member.user.tag})\n🆔 **User ID:** \`${member.id}\``)
          .setColor(0xfee75c)
          .addFields({ name: (memberFormSettings.question1 ?? "คำถามที่ 1").slice(0, 256), value: q1Ans || "-" })
          .setFooter({ text: `ส่งเมื่อ`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
          .setTimestamp();

        if (memberFormSettings.question2 && q2Ans) {
          logEmbed.addFields({ name: memberFormSettings.question2.slice(0, 256), value: q2Ans });
        }
        if (memberFormSettings.question3 && q3Ans) {
          logEmbed.addFields({ name: memberFormSettings.question3.slice(0, 256), value: q3Ans });
        }

        const approveBtn = new ButtonBuilder()
          .setCustomId(`approve_member_${member.id}`)
          .setLabel("✅ อนุมัติสมาชิก")
          .setStyle(ButtonStyle.Success);

        const rejectBtn = new ButtonBuilder()
          .setCustomId(`reject_member_${member.id}`)
          .setLabel("❌ ไม่อนุมัติ")
          .setStyle(ButtonStyle.Danger);

        const btnRow = new ActionRowBuilder().addComponents(approveBtn, rejectBtn);

        await sendHelperMessage(logChannel, { embeds: [logEmbed], components: [btnRow] }, guildId);
        await respondToInteraction(interaction, {
          content: "Success: ส่งฟอร์มให้ทีมงานตรวจสอบเรียบร้อยแล้ว" + pendingNotice,
        });
        return;
      }

      if (interaction.isAutocomplete()) {
        const hasPermission = await hasStaffPermission(interaction, PermissionFlagsBits.ManageGuild);
        if (!hasPermission) {
          await interaction.respond([]).catch(() => null);
          return;
        }

        const { commandName: autoCmdName, guildId: autoGuildId } = interaction;
        if (autoCmdName === "image" && autoGuildId) {
          const focusedValue = interaction.options.getFocused().toLowerCase();
          const galleryData = getImageGalleryData(autoGuildId);
          const imagesDir = path.join(DATABASE_DIR, autoGuildId, "image");

          const titlesFromData = Object.keys(galleryData.titles || {});
          let titlesFromDir = [];
          if (fs.existsSync(imagesDir)) {
            titlesFromDir = fs.readdirSync(imagesDir, { withFileTypes: true })
              .filter((dirent) => dirent.isDirectory())
              .map((dirent) => dirent.name);
          }

          const allTitles = Array.from(new Set([...titlesFromData, ...titlesFromDir]));
          const filtered = allTitles
            .filter((title) => title.toLowerCase().includes(focusedValue))
            .slice(0, 25);

          await interaction.respond(
            filtered.map((choice) => ({ name: choice, value: choice }))
          ).catch(() => null);
        }

        if (autoCmdName === "quiz" && autoGuildId) {
          const focused = interaction.options.getFocused(true);
          const focusedValue = (focused.value || "").toLowerCase();
          const quizConfig = getQuizConfig(autoGuildId);

          if (focused.name.endsWith("_result") || focused.name === "title") {
            const results = quizConfig.results || [];
            const filtered = results
              .map((r) => r.title || r.id)
              .filter((title) => Boolean(title) && title.toLowerCase().includes(focusedValue))
              .slice(0, 25);

            await interaction.respond(
              filtered.map((choice) => ({ name: choice, value: choice }))
            ).catch(() => null);
          }
        }
        return;
      }

      if (!interaction.isChatInputCommand()) return;

      const { commandName, guildId } = interaction;

      // 1. คำสั่งสาธารณะ (Public Command) - สมาชิกทุกคนใช้งานได้
      if (commandName === "ping") {
        await respondToInteraction(interaction, { content: "Pong! 🏓", flags: MessageFlags.Ephemeral });
        return;
      }

      if (commandName === "rank") {
        await handleRankCommand(interaction);
        return;
      }

      if (commandName === "leaderboard") {
        await handleLeaderboardCommand(interaction);
        return;
      }

      // 2. คำสั่งมอบยศ (Role Command) - มีระบบเช็กสิทธิ์ ManageRoles และ Role Hierarchy ภายในฟังก์ชัน
      if (commandName === "giverole") {
        await handleGiveRoleCommand(interaction);
        return;
      }

      if (commandName === "jail") {
        await handleJailCommand(interaction);
        return;
      }

      if (commandName === "unjail") {
        await handleUnjailCommand(interaction);
        return;
      }

      if (commandName === "music") {
        await handleMusicCommand(interaction);
        return;
      }

      // 3. คำสั่งบอทผู้ช่วย (Helper Message Command) - เฉพาะผู้มีสิทธิ์ ManageMessages หรือยศสูงกว่าบอท
      if (commandName === "helper") {
        const hasPermission = await hasStaffPermission(interaction, PermissionFlagsBits.ManageMessages);
        if (!hasPermission) {
          await respondToInteraction(interaction, {
            content: "❌ คุณไม่มีสิทธิ์จัดการข้อความ (Manage Messages) หรือยศของคุณไม่สูงกว่าบอท จึงไม่สามารถใช้คำสั่งนี้ได้ค่ะ",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await handleHelperCommand(interaction);
        return;
      }

      // 4. คำสั่งตั้งค่าเซิร์ฟเวอร์และระบบคลังรูปภาพ (Server Config: set, quiz, image) - เฉพาะผู้มีสิทธิ์ ManageGuild หรือ Admin
      const hasPermission = await hasStaffPermission(interaction, PermissionFlagsBits.ManageGuild);
      if (!hasPermission) {
        await respondToInteraction(interaction, {
          content: "❌ คุณไม่มีสิทธิ์จัดการเซิร์ฟเวอร์ (Manage Server) ในการใช้งานคำสั่งนี้ค่ะ (อนุญาตเฉพาะผู้ดูแลเซิร์ฟเวอร์เท่านั้น)",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (commandName === "set") {
        if (!guildId) {
          await respondToInteraction(interaction, { content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", flags: MessageFlags.Ephemeral });
          return;
        }

        ensureGuildDatabase(guildId);

        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(false);

        if (subcommandGroup === "welcome" || subcommand === "welcome") {
          await handleSetWelcomeCommands(interaction);
        } else if (subcommandGroup === "member" || subcommand === "member") {
          await handleSetMemberCommands(interaction);
        } else if (subcommandGroup === "leveling" || subcommand === "leveling") {
          await handleSetLevelingCommands(interaction);
        } else if (subcommandGroup === "giverole" || subcommand === "giverole") {
          await handleSetGiveRoleCommands(interaction);
        } else if (subcommandGroup === "helper" || subcommand === "helper") {
          await handleSetHelperCommands(interaction);
        } else if (subcommandGroup === "intro" || subcommand === "intro") {
          await handleSetIntroCommands(interaction);
        } else if (subcommandGroup === "reaction-role") {
          await handleSetReactionRoleCommands(interaction);
        } else if (subcommandGroup === "jail" || subcommand === "jail") {
          await handleSetJailCommands(interaction);
        } else {
          if (!interaction.replied) {
            await respondToInteraction(interaction, { content: "⚠️ ไม่พบฟังก์ชันคำสั่งที่เลือกค่ะ", flags: MessageFlags.Ephemeral });
          }
        }
        return;
      }

      if (commandName === "quiz") {
        await handleQuizCommand(interaction);
        return;
      }

      if (commandName === "image") {
        await handleImageCommand(interaction);
        return;
      }
      await respondToInteraction(interaction, { content: "ไม่พบคำสั่งนี้ กรุณาเลือกคำสั่งล่าสุดจากรายการ" });
    } catch (err) {
      if (err.code === 10062 || err.message?.includes("Unknown interaction")) {
        console.warn("Interaction หมดอายุหรือไม่ถูกต้อง (10062): ตรวจเวลาตอบรับ การเชื่อมต่อ และจำนวน instance ของบอท");
        return;
      }
      console.error("❌ เกิดข้อผิดพลาดใน interactionCreate:", errorSummary(err));
      if (interaction.deferred || interaction.replied) {
        await respondToInteraction(interaction, { content: err.code ? `ประมวลผลไม่สำเร็จ (รหัส ${err.code}) กรุณาตรวจสอบสิทธิ์และการตั้งค่า` : err.message });
      } else {
        await respondToInteraction(interaction, { content: `ประมวลผลไม่สำเร็จ (รหัส ${err.code ?? "UNKNOWN"})`, flags: MessageFlags.Ephemeral });
      }
    }
  });
}
