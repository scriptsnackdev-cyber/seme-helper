import { PermissionFlagsBits, AttachmentBuilder } from "discord.js";
import { getGiveRoleBannerPath } from "../utils/db.js";
import { generateGiveRoleCard } from "../utils/canvas.js";

export async function handleGiveRoleCommand(interaction) {
  const { guildId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น", ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser("user");
  const role = interaction.options.getRole("role");

  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "❌ ไม่พบสมาชิกในเซิร์ฟเวอร์นี้", ephemeral: true });
    return;
  }

  const botMember = await interaction.guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({ content: "❌ บอทไม่มีสิทธิ์ Manage Roles (จัดการยศ) ในเซิร์ฟเวอร์นี้ค่ะ", ephemeral: true });
    return;
  }

  if (role.position >= botMember.roles.highest.position) {
    await interaction.reply({ content: `❌ บอทไม่สามารถแจกยศ <@&${role.id}> ได้เนื่องจากยศนี้อยู่สูงกว่าหรือเท่ากับยศสูงสุดของบอทค่ะ`, ephemeral: true });
    return;
  }

  try {
    await interaction.deferReply();
    await member.roles.add(role);

    const bannerInfo = getGiveRoleBannerPath(guildId);
    const cardBuffer = await generateGiveRoleCard(targetUser, role.name, bannerInfo ? bannerInfo.path : null);
    const attachment = new AttachmentBuilder(cardBuffer, { name: "giverole.png" });

    await interaction.editReply({
      content: `✨ **ประกาศความสำเร็จ!** <@${targetUser.id}> ได้รับยศใหม่แล้วนะเมี้ยววว! 🐾🎉`,
      files: [attachment],
    });
  } catch (err) {
    console.error("Error in /giverole:", err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: `❌ เกิดข้อผิดพลาดในการมอบยศ: ${err.message}` });
    } else {
      await interaction.reply({ content: `❌ เกิดข้อผิดพลาดในการมอบยศ: ${err.message}`, ephemeral: true });
    }
  }
}
