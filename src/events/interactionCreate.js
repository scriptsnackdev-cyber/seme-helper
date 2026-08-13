import fs from "fs";
import path from "path";
import {
  EmbedBuilder,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonStyle,
  ButtonBuilder,
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
import { handleGiveRoleCommand } from "../commands/giverole.js";
import { handleQuizCommand } from "../commands/quiz.js";
import { handleImageCommand } from "../commands/image.js";
import { handleHelperCommand } from "../commands/helper.js";
import { isMemberHigherThanBot } from "../utils/permission.js";
import { sendHelperMessage } from "../utils/helper.js";

const quizSessions = new Map();

function renderProgressBar(current, total) {
  const percentage = Math.round(((current + 1) / total) * 100);
  const filledCount = Math.round(((current + 1) / total) * 10);
  const bar = "🟩".repeat(filledCount) + "⬜".repeat(Math.max(0, 10 - filledCount));
  return `${bar} ${percentage}%`;
}

function buildQuestionPayload(guildId, qIndex) {
  const config = getQuizConfig(guildId);
  const question = config.questions[qIndex];
  const total = config.questions.length;

  const progressBarText = renderProgressBar(qIndex, total);

  const embed = new EmbedBuilder()
    .setTitle(`🐾 ${config.title || "แบบทดสอบ"}: ข้อที่ ${qIndex + 1}/${total}`)
    .setDescription(`${progressBarText}\n\n🐾 **คำถาม:** ${question.text}\n\n*เลือกสิ่งที่ตรงกับตัวคุณมากที่สุดนะเมี้ยว! 🐾*`)
    .setColor(0xff69b4);

  const rows = [];
  let currentRow = new ActionRowBuilder();

  (question.options || []).forEach((opt, idx) => {
    const btn = new ButtonBuilder()
      .setCustomId(`quiz_opt_${qIndex}_${opt.id}`)
      .setLabel(opt.label.slice(0, 80))
      .setStyle(ButtonStyle.Secondary);

    currentRow.addComponents(btn);

    if (currentRow.components.length === 2 || idx === question.options.length - 1) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
  });

  return { embeds: [embed], components: rows, ephemeral: true };
}

export function setupInteractionCreateEvent(client) {
  client.on("interactionCreate", async (interaction) => {
    try {
      // 1. ปุ่มรับยศทันที
      if (interaction.isButton() && interaction.customId.startsWith("claim_role_")) {
        const parts = interaction.customId.split("_");
        const newRoleId = parts[2];
        const removeRoleId = parts[3];

        const member = interaction.member;
        const guild = interaction.guild;

        if (!guild || !member) return;

        let addedRoleName = "";
        let roleErrorMsg = null;

        if (newRoleId && newRoleId !== "none") {
          const roleToAdd = await guild.roles.fetch(newRoleId).catch(() => null);
          if (roleToAdd) {
            try {
              await member.roles.add(roleToAdd);
              addedRoleName = roleToAdd.name;
            } catch (err) {
              console.error("❌ ไม่สามารถแจกยศยืนยันสิทธิ์ได้:", err);
              roleErrorMsg = `ไม่สามารถมอบยศ ${roleToAdd.name} ได้ (อาจเนื่องจากยศอยู่สูงกว่ายศบอท หรือบอทไม่มีสิทธิ์ Manage Roles)`;
            }
          }
        }

        if (removeRoleId && removeRoleId !== "none") {
          const roleToRemove = await guild.roles.fetch(removeRoleId).catch(() => null);
          if (roleToRemove) {
            await member.roles.remove(roleToRemove).catch(() => null);
          }
        }

        if (roleErrorMsg) {
          await interaction.reply({ content: `⚠️ ${roleErrorMsg}`, ephemeral: true });
        } else {
          await interaction.reply({
            content: `✨ ยืนยันสิทธิ์สำเร็จ! เพิ่มยศ **${addedRoleName || "สมาชิก"}** ให้กับคุณเรียบร้อยแล้วค่ะ 💕`,
            ephemeral: true,
          });
        }
        return;
      }

      // 2. ปุ่มเปิดฟอร์มคัดกรองสมาชิก
      if (interaction.isButton() && interaction.customId === "open_verify_form_btn") {
        const guildId = interaction.guildId;
        const memberFormSettings = getMemberFormSettings(guildId);

        if (!memberFormSettings) {
          await interaction.reply({ content: "❌ ยังไม่ได้ตั้งค่าระบบฟอร์มคัดกรองในเซิร์ฟเวอร์นี้ค่ะ", ephemeral: true });
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
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(q1Input));

        if (memberFormSettings.question2) {
          const q2Input = new TextInputBuilder()
            .setCustomId("q2_input")
            .setLabel(memberFormSettings.question2.slice(0, 45))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);
          modal.addComponents(new ActionRowBuilder().addComponents(q2Input));
        }

        if (memberFormSettings.question3) {
          const q3Input = new TextInputBuilder()
            .setCustomId("q3_input")
            .setLabel(memberFormSettings.question3.slice(0, 45))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);
          modal.addComponents(new ActionRowBuilder().addComponents(q3Input));
        }

        await interaction.showModal(modal);
        return;
      }

      // 3. ปุ่มอนุมัติ / ปฏิเสธฟอร์มคัดกรองของทีมงาน
      if (interaction.isButton() && (interaction.customId.startsWith("approve_member_") || interaction.customId.startsWith("reject_member_"))) {
        const hasPermission = await isMemberHigherThanBot(interaction);
        if (!hasPermission) {
          await interaction.reply({
            content: "❌ เฉพาะทีมงานที่มียศสูงกว่าบอทเท่านั้นที่สามารถกดอนุมัติหรือปฏิเสธสมาชิกได้ค่ะ",
            ephemeral: true,
          });
          return;
        }

        const isApprove = interaction.customId.startsWith("approve_member_");
        const targetUserId = interaction.customId.replace(isApprove ? "approve_member_" : "reject_member_", "");
        const guild = interaction.guild;
        const guildId = interaction.guildId;
        const memberFormSettings = getMemberFormSettings(guildId);

        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

        if (!targetMember) {
          await interaction.reply({ content: "❌ ไม่พบสมาชิกในเซิร์ฟเวอร์นี้ (สมาชิกอาจจะออกจากเซิร์ฟเวอร์ไปแล้วค่ะ)", ephemeral: true });
          return;
        }

        if (isApprove) {
          if (memberFormSettings) {
            if (memberFormSettings.pendingRoleId) {
              const pRole = await guild.roles.fetch(memberFormSettings.pendingRoleId).catch(() => null);
              if (pRole) await targetMember.roles.remove(pRole).catch(() => null);
            }
            if (memberFormSettings.approvedRoleId) {
              const aRole = await guild.roles.fetch(memberFormSettings.approvedRoleId).catch(() => null);
              if (aRole) await targetMember.roles.add(aRole).catch(() => null);
            }

            // ส่งข้อความประกาศต้อนรับไปที่ห้อง announce (ถ้ามีการตั้งค่าไว้)
            if (memberFormSettings.announceChannelId) {
              const announceChannel = await guild.channels.fetch(memberFormSettings.announceChannelId).catch(() => null);
              if (announceChannel) {
                const originalEmbed = interaction.message.embeds[0];
                const q1Field = originalEmbed?.fields?.[0];
                const q1Question = memberFormSettings.question1 || q1Field?.name?.replace(/^📌\s*/, "") || "ชื่อ";
                const q1Answer = q1Field?.value || targetMember.displayName || targetMember.user.username;

                const welcomeEmbed = new EmbedBuilder()
                  .setTitle(`🎪 ยินดีต้อนรับสมาชิกใหม่!`)
                  .setDescription(`ขอต้อนรับ <@${targetMember.id}> เข้าสู่ ${guild.name} ค่ะ! 🎉✨\n\n📌 **${q1Question}:** **${q1Answer}**`)
                  .setColor(0xff69b4)
                  .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                  .setFooter({
                    text: `${guild.name} Verification System`,
                    iconURL: guild.iconURL({ dynamic: true }) || undefined,
                  })
                  .setTimestamp();

                const announcePayload = {
                  content: `🎉 ยินดีต้อนรับสมาชิกใหม่ <@${targetMember.id}> เข้าสู่เซิร์ฟเวอร์ค่ะ! ✨ (ชื่อ/คำตอบ: **${q1Answer}**)`,
                  embeds: [welcomeEmbed],
                };

                const bannerInfo = getMemberFormBannerPath(guildId);
                if (bannerInfo) {
                  const bannerAttachmentFile = new AttachmentBuilder(bannerInfo.path, { name: bannerInfo.filename });
                  welcomeEmbed.setImage(`attachment://${bannerInfo.filename}`);
                  announcePayload.files = [bannerAttachmentFile];
                }

                await sendHelperMessage(announceChannel, announcePayload, guildId).catch((err) => {
                  console.error("❌ ไม่สามารถส่งข้อความประกาศต้อนรับที่ห้อง announce ได้:", err);
                });
              }
            }
          }

          const originalEmbed = interaction.message.embeds[0];
          const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setColor(0x57f287)
            .setTitle(`✅ อนุมัติสมาชิกเรียบร้อยแล้ว (โดย ${interaction.user.username})`);

          await interaction.update({ embeds: [updatedEmbed], components: [] });
        } else {
          const originalEmbed = interaction.message.embeds[0];
          const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setColor(0xed4245)
            .setTitle(`❌ ไม่อนุมัติสมาชิก (โดย ${interaction.user.username})`);

          await interaction.update({ embeds: [updatedEmbed], components: [] });
        }
        return;
      }

      // 4. ปุ่มเริ่มทำ Quiz
      if (interaction.isButton() && interaction.customId === "start_quiz_btn") {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        const config = getQuizConfig(guildId);

        if (!config.questions || config.questions.length === 0 || !config.results || config.results.length === 0) {
          await interaction.reply({ content: "⚠️ ระบบแบบทดสอบยังตั้งค่าไม่สมบูรณ์ค่ะ (ต้องมีทั้งข้อคำถามและผลลัพธ์ยศนะคะ)", ephemeral: true });
          return;
        }

        const sessionKey = `${guildId}_${userId}`;
        quizSessions.set(sessionKey, {
          currentIndex: 0,
          scores: {},
        });

        const payload = buildQuestionPayload(guildId, 0);
        await interaction.reply(payload);
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

        if (!session) {
          await interaction.reply({ content: "⚠️ เซสชันแบบทดสอบของคุณหมดอายุแล้ว กรุณากดปุ่มทำแบบทดสอบใหม่อีกครั้งนะคะ", ephemeral: true });
          return;
        }

        const currentQuestion = config.questions[qIndex];
        const selectedOpt = (currentQuestion.options || []).find((o) => o.id === optId);

        if (selectedOpt && selectedOpt.resultId) {
          const resKey = selectedOpt.resultId;
          session.scores[resKey] = (session.scores[resKey] || 0) + 1;
        }

        const nextIndex = qIndex + 1;
        if (nextIndex < config.questions.length) {
          session.currentIndex = nextIndex;
          const nextPayload = buildQuestionPayload(guildId, nextIndex);
          await interaction.update(nextPayload);
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
                await interaction.member.roles.add(role);
                roleAddedSuccess = true;
              } catch (err) {
                console.error("❌ ไม่สามารถแจกยศควิซได้:", err);
              }
            }
          }

          quizSessions.delete(sessionKey);

          let desc = `🎉 **ขอแสดงความยินดีด้วยค่ะ! คุณได้ผลลัพธ์:** **${result?.title || "ไม่ทราบผล"}**\n\n`;
          if (result?.description) desc += `ℹ️ ${result.description}\n\n`;
          if (roleAddedSuccess && result?.roleId) {
            desc += `✨ ระบบได้มอบยศ <@&${result.roleId}> ให้กับคุณเรียบร้อยแล้วค่ะ! 💖`;
          } else if (result?.roleId) {
            desc += `⚠️ ระบบไม่สามารถแจกยศ <@&${result.roleId}> ให้คุณได้ (กรุณาแจ้งแอดมินให้ตรวจสอบสิทธิ์ Manage Roles ของบอทนะคะ)`;
          }

          const resultEmbed = new EmbedBuilder()
            .setTitle(`💸 ผลทดสอบ ${config.title || "ควิซ"}: ${result?.title || "ผลลัพธ์"}`)
            .setDescription(desc)
            .setColor(0xff69b4)
            .setFooter({
              text: `${interaction.guild?.name || "PurrPaw"} Interactive Quiz`,
              iconURL: interaction.guild?.iconURL({ dynamic: true }) || undefined,
            })
            .setTimestamp();

          const updatePayload = {
            content: `🎉 **สรุปผลแบบทดสอบของคุณเรียบร้อยแล้วค่ะ!**`,
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

          await interaction.update(updatePayload);
        }
        return;
      }

      // 6. Modal การส่งฟอร์มคัดกรองสมาชิก
      if (interaction.isModalSubmit() && interaction.customId === "verify_form_modal") {
        const guildId = interaction.guildId;
        const memberFormSettings = getMemberFormSettings(guildId);

        if (!memberFormSettings || !memberFormSettings.logChannelId) {
          await interaction.reply({ content: "❌ ระบบฟอร์มคัดกรองยังตั้งค่าไม่สมบูรณ์ค่ะ", ephemeral: true });
          return;
        }

        const logChannel = await interaction.guild.channels.fetch(memberFormSettings.logChannelId).catch(() => null);
        if (!logChannel) {
          await interaction.reply({ content: "❌ ไม่พบห้อง log สำหรับทีมงานตรวจสอบฟอร์มคัดกรองค่ะ (ห้องอาจถูกลบไปแล้ว)", ephemeral: true });
          return;
        }

        const q1Ans = interaction.fields.getTextInputValue("q1_input");
        let q2Ans = null;
        let q3Ans = null;

        try { q2Ans = interaction.fields.getTextInputValue("q2_input"); } catch (e) { }
        try { q3Ans = interaction.fields.getTextInputValue("q3_input"); } catch (e) { }

        const member = interaction.member;
        const guild = interaction.guild;

        if (memberFormSettings.pendingRoleId) {
          const pendingRole = await guild.roles.fetch(memberFormSettings.pendingRoleId).catch(() => null);
          if (pendingRole) {
            await member.roles.add(pendingRole).catch((err) => {
              console.error("❌ ไม่สามารถแจก Role1 (Pending) ได้:", err);
            });
          }
        }

        const logEmbed = new EmbedBuilder()
          .setTitle(`📝 คำตอบฟอร์มคัดกรองใหม่จาก: ${member.user.tag}`)
          .setDescription(`👤 **ผู้ส่ง:** <@${member.id}> (${member.user.tag})\n🆔 **User ID:** \`${member.id}\``)
          .setColor(0xfee75c)
          .addFields({ name: `📌 ${memberFormSettings.question1}`, value: q1Ans || "-" })
          .setFooter({ text: `ส่งเมื่อ`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
          .setTimestamp();

        if (memberFormSettings.question2 && q2Ans) {
          logEmbed.addFields({ name: `📌 ${memberFormSettings.question2}`, value: q2Ans });
        }
        if (memberFormSettings.question3 && q3Ans) {
          logEmbed.addFields({ name: `📌 ${memberFormSettings.question3}`, value: q3Ans });
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

        await logChannel.send({ embeds: [logEmbed], components: [btnRow] });

        await interaction.reply({
          content: `✅ ส่งฟอร์มคัดกรองเรียบร้อยแล้วค่ะ! ได้รับยศ <@&${memberFormSettings.pendingRoleId}> ชั่วคราวระหว่างรอทีมงานตรวจสอบนะคะ ✨`,
          ephemeral: true,
        });
        return;
      }

      if (interaction.isAutocomplete()) {
        const hasPermission = await isMemberHigherThanBot(interaction);
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

      // ตรวจสอบสิทธิ์: เฉพาะผู้ที่มียศสูงกว่าบอท (หรือ Server Owner) เท่านั้นที่สามารถใช้คำสั่งได้
      const hasPermission = await isMemberHigherThanBot(interaction);
      if (!hasPermission) {
        await interaction.reply({
          content: "❌ คุณไม่มียศที่สูงกว่าบอท จึงไม่สามารถใช้งานคำสั่งนี้ได้ค่ะ (อนุญาตเฉพาะผู้ดูแลที่มียศสูงกว่าบอทเท่านั้น)",
          ephemeral: true,
        });
        return;
      }

      if (commandName === "ping") {
        await interaction.reply({ content: "Pong! 🏓", ephemeral: true });
        return;
      }

      if (commandName === "set") {
        if (!guildId) {
          await interaction.reply({ content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", ephemeral: true });
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
        } else {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "⚠️ ไม่พบฟังก์ชันคำสั่งที่เลือกค่ะ", ephemeral: true });
          }
        }
        return;
      }

      if (commandName === "giverole") {
        await handleGiveRoleCommand(interaction);
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

      if (commandName === "helper") {
        await handleHelperCommand(interaction);
        return;
      }
    } catch (err) {
      if (err.code === 10062 || err.message?.includes("Unknown interaction")) {
        console.warn("⚠️ [Discord Notice] คำสั่งเก่าค้างแคชในโปรแกรม Discord (Unknown Interaction) - กรุณากด Ctrl+R บน Discord 1 ครั้ง");
        return;
      }
      console.error("❌ เกิดข้อผิดพลาดใน interactionCreate:", err);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: `❌ เกิดข้อผิดพลาดในการประมวลผล: ${err.message}`, ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ content: `❌ เกิดข้อผิดพลาดในการประมวลผล: ${err.message}`, ephemeral: true }).catch(() => null);
      }
    }
  });
}
