import { respondToInteraction, deferCommand, errorSummary } from "../utils/helper.js";
import { MessageFlags, PermissionFlagsBits, AttachmentBuilder } from "discord.js";
import { getGiveRoleBannerPath } from "../utils/db.js";
import { generateGiveRoleCard } from "../utils/canvas.js";
import { hasStaffPermission, assertRoleManageable } from "../utils/permission.js";

export async function handleGiveRoleCommand(interaction) {
  const { guildId } = interaction;
  if (!guildId) {
    await respondToInteraction(interaction, { content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", flags: MessageFlags.Ephemeral });
    return;
  }

  await deferCommand(interaction, false);

  // 1. ตรวจสอบสิทธิ์ผู้สั่ง (ต้องมีสิทธิ์ Manage Roles หรือ Admin หรือยศสูงกว่าบอท)
  const hasPerm = await hasStaffPermission(interaction, PermissionFlagsBits.ManageRoles);
  if (!hasPerm) {
    await respondToInteraction(interaction, {
      content: "❌ คุณไม่มีสิทธิ์จัดการยศ (Manage Roles) ในการใช้งานคำสั่งนี้ค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user");
  const role = interaction.options.getRole("role");

  // 2. ตรวจสอบความปลอดภัย: คนสั่งไม่สามารถแจกยศที่สูงกว่าหรือเท่ากับยศของตัวเองได้ (ยกเว้น Server Owner)
  const callerMember = interaction.member;
  if (interaction.guild.ownerId !== interaction.user.id && callerMember) {
    if (callerMember.roles.highest.comparePositionTo(role) <= 0) {
      await respondToInteraction(interaction, {
        content: `❌ คุณไม่สามารถแจกยศ <@&${role.id}> ได้ เนื่องจากยศนี้อยู่สูงกว่าหรือเท่ากับยศสูงสุดของคุณค่ะ`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    await respondToInteraction(interaction, { content: "❌ ไม่พบสมาชิกในเซิร์ฟเวอร์นี้", flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    await assertRoleManageable(interaction.guild, role);
    await member.roles.add(role);
  } catch (error) {
    console.warn("มอบยศไม่สำเร็จ:", errorSummary(error));
    await respondToInteraction(interaction, {
      content: error.code ? "มอบยศไม่สำเร็จ (รหัส " + error.code + ") กรุณาตรวจสอบสิทธิ์และลำดับยศบอท" : error.message,
    });
    return;
  }

  const successContent = "Success: <@" + targetUser.id + "> ได้รับยศ <@&" + role.id + "> เรียบร้อยแล้ว";
  let attachment;
  try {
    const bannerInfo = getGiveRoleBannerPath(guildId);
    const cardBuffer = await generateGiveRoleCard(targetUser, role.name, bannerInfo ? bannerInfo.path : null);
    attachment = new AttachmentBuilder(cardBuffer, { name: "giverole.png" });
  } catch (error) {
    console.warn("มอบยศสำเร็จ แต่สร้างการ์ดไม่สำเร็จ:", errorSummary(error));
  }
  await respondToInteraction(interaction, {
    content: successContent + (attachment ? "" : " (สร้างการ์ดไม่สำเร็จ)"),
    ...(attachment ? { files: [attachment] } : {}),
  });
}
