import { PermissionFlagsBits } from "discord.js";

export async function assertRoleManageable(guild, role) {
  if (!role) throw new Error("ไม่พบยศที่ตั้งค่าไว้ กรุณาตั้งค่ายศใหม่");
  if (role.managed || role.id === guild.id) {
    throw new Error("ไม่สามารถจัดการยศของระบบหรือ @everyone ได้");
  }
  const botMember = guild.members.me ?? await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error("บอทไม่มีสิทธิ์ Manage Roles กรุณาให้ผู้ดูแลปรับสิทธิ์บอท");
  }
  if (botMember.roles.highest.comparePositionTo(role) <= 0) {
    throw new Error(`ยศ ${role.name} อยู่สูงกว่าหรือเท่ากับยศบอท กรุณาย้ายยศบอทให้สูงกว่า`);
  }
}

/**
 * ตรวจสอบสิทธิ์ทีมงาน/แอดมินสำหรับใช้งานคำสั่งทั่วไป
 * - เจ้าของเซิร์ฟเวอร์ (Server Owner) อนุญาตเสมอ
 * - ผู้มีสิทธิ์ Administrator อนุญาตเสมอ
 * - ผู้มีสิทธิ์ ManageGuild หรือ ManageRoles อนุญาตเสมอ
 * - ผู้ที่มียศสูงสุด อยู่สูงกว่า ยศสูงสุดของบอท อนุญาต
 */
export async function isMemberHigherThanBot(interaction) {
  return await hasStaffPermission(interaction, PermissionFlagsBits.ManageGuild);
}

/**
 * ตรวจสอบสิทธิ์เจาะจงตาม PermissionFlag
 * @param {import("discord.js").Interaction} interaction
 * @param {bigint} [requiredPermission] สิทธิ์ที่ต้องการ เช่น ManageGuild, ManageRoles, ManageMessages
 */
export async function hasStaffPermission(interaction, requiredPermission = PermissionFlagsBits.ManageGuild) {
  if (!interaction.guild) return false;

  // 1. เจ้าของเซิร์ฟเวอร์ (Server Owner) มีสิทธิ์สูงสุดเสมอ
  if (interaction.guild.ownerId === interaction.user.id) {
    return true;
  }

  // 2. ดึงข้อมูล Member ของผู้ใช้
  let member = interaction.member;
  if (!member || !member.roles || !member.permissions) {
    member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  }
  if (!member) return false;

  // 3. ผู้มีสิทธิ์ Administrator ผ่านเสมอ
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // 4. มีสิทธิ์เฉพาะตามที่กำหนดไว้
  if (requiredPermission && member.permissions.has(requiredPermission)) {
    return true;
  }

  // 5. ตรวจสอบลำดับยศ (ต้องมียศและยศสูงสุดต้องอยู่สูงกว่ายศสูงสุดของบอท)
  const botMember = interaction.guild.members.me || (await interaction.guild.members.fetchMe().catch(() => null));
  if (!botMember) return false;

  const memberHighestPosition = member.roles.highest ? member.roles.highest.position : 0;
  const botHighestPosition = botMember.roles.highest ? botMember.roles.highest.position : 0;

  return memberHighestPosition > 0 && memberHighestPosition > botHighestPosition;
}
