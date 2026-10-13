import { respondToInteraction, deferCommand, errorSummary } from "../utils/helper.js";
import { MessageFlags, AttachmentBuilder, EmbedBuilder } from "discord.js";
import {
  getLevelingSettings,
  getLevelingUserData,
  getGlobalLevelingConfig,
  getLevelingBannerPath,
} from "../utils/db.js";
import { generateRankCard } from "../utils/canvas.js";

export async function handleRankCommand(interaction) {
  const { guild, guildId } = interaction;
  if (!guildId) {
    await respondToInteraction(interaction, { content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", flags: MessageFlags.Ephemeral });
    return;
  }

  await deferCommand(interaction, false);

  const targetUser = interaction.options.getUser("user") || interaction.user;
  const levelingSettings = getLevelingSettings(guildId);
  const userData = getLevelingUserData(guildId);
  const globalConfig = getGlobalLevelingConfig();

  // สร้าง sorted users list เพื่อหา rank
  const users = Object.entries(userData).map(([id, data]) => ({
    userId: id,
    chars: data.chars || 0,
    level: data.level || 1,
  }));
  users.sort((a, b) => b.level - a.level || b.chars - a.chars);

  const targetData = userData[targetUser.id] || { chars: 0, level: 1 };
  const targetLevel = targetData.level || 1;
  const targetChars = targetData.chars || 0;

  const rankIndex = users.findIndex((u) => u.userId === targetUser.id);
  const rankNumber = rankIndex >= 0 ? rankIndex + 1 : users.length + 1;

  // คำนวณ Progress EXP
  const currentLevelExp = globalConfig[targetLevel] || globalConfig[String(targetLevel)] || 0;
  const nextLevelExp = globalConfig[targetLevel + 1] || globalConfig[String(targetLevel + 1)] || Math.floor(100 * Math.pow(targetLevel + 1, 1.85));
  const expRange = Math.max(1, nextLevelExp - currentLevelExp);
  const currentExpProgress = Math.max(0, targetChars - currentLevelExp);
  const progressRatio = Math.min(1.0, currentExpProgress / expRange);

  const progressInfo = {
    currentExp: targetChars,
    maxExp: nextLevelExp,
    progressRatio: Math.max(0.05, progressRatio),
  };

  try {
    const bannerPath = getLevelingBannerPath(guildId);
    const cardBuffer = await generateRankCard(targetUser, targetLevel, rankNumber, bannerPath, progressInfo);
    const attachment = new AttachmentBuilder(cardBuffer, { name: `rank_${targetUser.id}.png` });

    let replyNotice = "";
    if (levelingSettings && !levelingSettings.enabled) {
      replyNotice = "*หมายเหตุ: ระบบสะสมเลเวลในเซิร์ฟเวอร์นี้กำลังปิดใช้งานอยู่ค่ะ*\n";
    }

    await respondToInteraction(interaction, {
      content: replyNotice || undefined,
      files: [attachment],
    });
  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการสร้าง Rank Card:", errorSummary(err));
    await respondToInteraction(interaction, {
      content: `📊 **ข้อมูลเลเวลของ ${targetUser.username}**\n- **อันดับในเซิร์ฟเวอร์:** #${rankNumber}\n- **เลเวล:** Level ${targetLevel}\n- **EXP สะสม:** ${targetChars.toLocaleString()} / ${nextLevelExp.toLocaleString()} EXP`,
    });
  }
}

export async function handleLeaderboardCommand(interaction) {
  const { guild, guildId, user } = interaction;
  if (!guildId) {
    await respondToInteraction(interaction, { content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", flags: MessageFlags.Ephemeral });
    return;
  }

  const userData = getLevelingUserData(guildId);
  const users = Object.entries(userData).map(([id, data]) => ({
    userId: id,
    chars: data.chars || 0,
    level: data.level || 1,
  }));
  users.sort((a, b) => b.level - a.level || b.chars - a.chars);

  if (users.length === 0) {
    await respondToInteraction(interaction, {
      content: "⚠️ ยังไม่มีข้อมูลการพิมพ์คุยหรือสะสมเลเวลของสมาชิกในเซิร์ฟเวอร์นี้ค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const top10 = users.slice(0, 10);
  const myRankIndex = users.findIndex((u) => u.userId === user.id);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : "-";
  const myLevel = myRankIndex >= 0 ? users[myRankIndex].level : 1;
  const myExp = myRankIndex >= 0 ? users[myRankIndex].chars : 0;

  const medals = ["🥇", "🥈", "🥉"];
  const lines = top10.map((item, idx) => {
    const medal = idx < 3 ? medals[idx] : `\`#${idx + 1}\``;
    return `${medal} <@${item.userId}> — **Level ${item.level}** (${item.chars.toLocaleString()} EXP)`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ตาราง 10 อันดับเลเวลสูงสุด — ${guild?.name || "Server"}`)
    .setDescription(lines.join("\n\n"))
    .setColor(0xffb6c1)
    .addFields({
      name: "อันดับของคุณ",
      value: `ลำดับที่ **#${myRank}** • **Level ${myLevel}** (${myExp.toLocaleString()} EXP)`,
      inline: false,
    })
    .setFooter({
      text: `${guild?.name || "Server"} • พิมพ์คุยในห้องเพื่อสะสมเลเวล`,
      iconURL: guild?.iconURL({ dynamic: true }) || undefined,
    })
    .setTimestamp();

  await respondToInteraction(interaction, { embeds: [embed] });
}
