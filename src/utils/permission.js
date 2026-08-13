/**
 * ตรวจสอบสิทธิ์ว่าผู้ใช้มียศสูงกว่าบอทหรือไม่
 * - เจ้าของเซิร์ฟเวอร์ (Server Owner) อนุญาตเสมอ
 * - สมาชิกที่มียศสูงสุด อยู่สูงกว่า ยศสูงสุดของบอท (Highest Role Position > Bot Highest Role Position) อนุญาต
 * - สมาชิกที่ยศต่ำกว่าหรือเท่ากับบอท ไม่อนุญาต
 */
export async function isMemberHigherThanBot(interaction) {
  if (!interaction.guild) return false;

  // 1. เจ้าของเซิร์ฟเวอร์ (Server Owner) มีสิทธิ์สูงสุดเสมอ
  if (interaction.guild.ownerId === interaction.user.id) {
    return true;
  }

  // 2. ดึงข้อมูล Member ของผู้ใช้
  let member = interaction.member;
  if (!member || !member.roles) {
    member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  }
  if (!member) return false;

  // 3. ดึงข้อมูล Member ของบอทในเซิร์ฟเวอร์
  const botMember = interaction.guild.members.me || (await interaction.guild.members.fetchMe().catch(() => null));
  if (!botMember) return false;

  const memberHighestPosition = member.roles.highest ? member.roles.highest.position : 0;
  const botHighestPosition = botMember.roles.highest ? botMember.roles.highest.position : 0;

  return memberHighestPosition > botHighestPosition;
}
