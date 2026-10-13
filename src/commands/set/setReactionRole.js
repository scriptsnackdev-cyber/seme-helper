import { EmbedBuilder, PermissionFlagsBits, parseEmoji } from "discord.js";
import { getReactionRoleSettings, saveReactionRoleSettings } from "../../utils/db.js";
import { assertRoleManageable, hasStaffPermission } from "../../utils/permission.js";
import { deferCommand, respondToInteraction, errorSummary, getReactionEmojiKey, sendHelperMessage, editHelperMessage, deleteHelperMessage } from "../../utils/helper.js";

const unicodeEmoji = /^(?:[0-9#*]\uFE0F?\u20E3|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?(?:[\u{E0020}-\u{E007E}]+\u{E007F})?(?:\u200D\p{Extended_Pictographic}[\uFE0E\uFE0F]?\p{Emoji_Modifier}?)*)$/u;

export async function handleSetReactionRoleCommands(interaction) {
  await deferCommand(interaction);
  const guild = interaction.guild;
  let message;
  let saved = false;

  try {
    if (!guild) throw new Error("คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์");
    if (!await hasStaffPermission(interaction, PermissionFlagsBits.ManageRoles)) {
      throw new Error("คุณไม่มีสิทธิ์จัดการยศสำหรับสร้าง Reaction Roles");
    }

    const channel = interaction.options.getChannel("channel");
    if (channel?.guildId !== guild.id || !channel.isTextBased() || !channel.send) {
      throw new Error("กรุณาเลือกห้องข้อความในเซิร์ฟเวอร์นี้");
    }
    const title = interaction.options.getString("title").trim();
    const description = interaction.options.getString("description")?.trim();
    if (!title) throw new Error("กรุณาระบุหัวข้อที่ไม่ใช่ช่องว่าง");

    const botMember = guild.members.me ?? await guild.members.fetchMe();
    const permissions = channel.permissionsFor(botMember);
    if (!permissions) throw new Error("ไม่สามารถตรวจสอบสิทธิ์บอทในห้องนี้ได้");
    const missingPermissions = permissions.missing([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
    ]);
    if (missingPermissions.length) {
      throw new Error(`บอทขาดสิทธิ์ในห้อง: ${missingPermissions.join(", ")}`);
    }
    const callerMember = interaction.member?.roles?.highest
      ? interaction.member : await guild.members.fetch(interaction.user.id);

    const entries = [];
    const reactions = [];
    const emojiKeys = new Set();
    const roleIds = new Set();
    for (let index = 1; index <= 10; index++) {
      const rawEmoji = interaction.options.getString(`emoji${index}`);
      const selectedRole = interaction.options.getRole(`role${index}`);
      if (!rawEmoji && !selectedRole) continue;
      if (!rawEmoji || !selectedRole) {
        throw new Error(`คู่ที่ ${index} ต้องระบุทั้งอิโมจิและยศ`);
      }
      const emoji = parseEmoji(rawEmoji.trim());
      if (!emoji || (!emoji.id && !unicodeEmoji.test(emoji.name))) {
        throw new Error(`อิโมจิคู่ที่ ${index} ไม่ถูกต้อง กรุณาวางอิโมจิจริงหรือ custom emoji`);
      }
      const emojiKey = getReactionEmojiKey(emoji);
      const role = await guild.roles.fetch(selectedRole.id);
      await assertRoleManageable(guild, role);
      if (guild.ownerId !== interaction.user.id && callerMember.roles.highest.comparePositionTo(role) <= 0) {
        throw new Error(`ไม่สามารถกำหนดยศ ${role.name} ที่สูงกว่าหรือเท่ากับยศของคุณได้`);
      }
      if (emojiKeys.has(emojiKey) || roleIds.has(role.id)) {
        throw new Error("แต่ละคู่ต้องใช้อิโมจิและยศที่ไม่ซ้ำกันในข้อความเดียวกัน");
      }

      let reaction = emoji.name;
      let displayEmoji = emoji.name;
      if (emoji.id) {
        const customEmoji = interaction.client.emojis.cache.get(emoji.id);
        if (!customEmoji?.available) throw new Error(`บอทไม่สามารถใช้อิโมจิคู่ที่ ${index} ได้`);
        if (customEmoji.guild.id !== guild.id && !permissions.has(PermissionFlagsBits.UseExternalEmojis)) {
          throw new Error("บอทต้องมีสิทธิ์ Use External Emojis เพื่อใช้อิโมจิจากเซิร์ฟเวอร์อื่น");
        }
        reaction = customEmoji;
        displayEmoji = customEmoji.toString();
      }
      emojiKeys.add(emojiKey);
      roleIds.add(role.id);
      reactions.push(reaction);
      entries.push({ emoji: displayEmoji, emojiKey, roleId: role.id });
    }
    if (!entries.length) throw new Error("กรุณาระบุอิโมจิและยศอย่างน้อยหนึ่งคู่");
    // Load before sending so an invalid stored config cannot leave an orphan panel.
    getReactionRoleSettings(guild.id);

    const lines = entries.map((entry) => `${entry.emoji} — <@&${entry.roleId}>`);
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription([
        ...(description ? [description] : []),
        lines.join("\n"),
      ].join("\n\n"))
      .setColor(0xf3e4f5);

    message = await sendHelperMessage(channel, { content: "กำลังเตรียมตัวเลือกยศ กรุณารอสักครู่", allowedMentions: { parse: [] } }, guild.id);
    for (const reaction of reactions) await message.react(reaction);
    saveReactionRoleSettings(guild.id, {
      ...getReactionRoleSettings(guild.id),
      [message.id]: { channelId: channel.id, entries },
    });
    saved = true;
    await editHelperMessage(message, { content: null, embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.warn("สร้าง Reaction Roles ไม่สำเร็จ:", errorSummary(error));
    let cleanupNotice = "";
    if (saved) {
      try {
        const settings = { ...getReactionRoleSettings(guild.id) };
        delete settings[message.id];
        saveReactionRoleSettings(guild.id, settings);
      } catch (cleanupError) {
        console.warn("คืนการตั้งค่า Reaction Roles ไม่สำเร็จ:", errorSummary(cleanupError));
        cleanupNotice = " กรุณาแจ้งผู้ดูแลตรวจสอบรายการตั้งค่าที่สร้างไม่สำเร็จ";
      }
    }
    if (message) {
      try { await deleteHelperMessage(message); }
      catch (cleanupError) {
        console.warn("ลบข้อความ Reaction Roles ที่สร้างไม่สำเร็จไม่ได้:", errorSummary(cleanupError));
        cleanupNotice += ` กรุณาลบข้อความที่สร้างไม่สมบูรณ์: ${message.url}`;
      }
    }
    await respondToInteraction(interaction, {
      content: (error.code ? `สร้าง Reaction Roles ไม่สำเร็จ (รหัส ${error.code}) กรุณาตรวจสอบสิทธิ์และอิโมจิ` : error.message) + cleanupNotice,
    });
    return;
  }
  await respondToInteraction(interaction, { content: `Success: สร้างข้อความเลือกหลายยศเรียบร้อยแล้ว ${message.url}` });
}
