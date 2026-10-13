import { MessageFlags, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { respondToInteraction, errorSummary } from "../../utils/helper.js";
import { getJailSettings, saveJailSettings, getJailRecords } from "../../utils/db.js";
import { assertRoleManageable } from "../../utils/permission.js";

export async function handleSetJailCommands(interaction) {
  const { guildId, guild } = interaction;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "role") {
    const role = interaction.options.getRole("role");

    // 1. ตรวจสอบลำดับยศของผู้สั่ง (ยกเว้น Server Owner)
    const callerMember = interaction.member;
    if (guild.ownerId !== interaction.user.id && callerMember) {
      if (callerMember.roles.highest.comparePositionTo(role) <= 0) {
        await respondToInteraction(interaction, {
          content: `❌ คุณไม่สามารถกำหนดยศ <@&${role.id}> เป็นยศคุกได้ เนื่องจากยศนี้อยู่สูงกว่าหรือเท่ากับยศสูงสุดของคุณค่ะ`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    // 2. ตรวจสอบว่าบอทสามารถจัดการยศนี้ได้หรือไม่
    try {
      await assertRoleManageable(guild, role);
    } catch (error) {
      await respondToInteraction(interaction, {
        content: `❌ ไม่สามารถใช้ยศนี้ได้: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    saveJailSettings(guildId, {
      roleId: role.id,
      roleName: role.name,
    });

    await respondToInteraction(interaction, {
      content: `✅ ตั้งค่ายศห้องขัง (Jail Role) เป็น <@&${role.id}> เรียบร้อยแล้วค่ะ`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (subcommand === "status") {
    const settings = getJailSettings(guildId);
    const records = getJailRecords(guildId);
    const prisonerEntries = Object.entries(records);

    const embed = new EmbedBuilder()
      .setTitle("สถานะระบบห้องขัง (Jail Status)")
      .setColor(0x2f3136)
      .addFields(
        {
          name: "ยศห้องขัง (Jail Role)",
          value: settings.roleId ? `<@&${settings.roleId}> (\`${settings.roleId}\`)` : "ยังไม่ได้ตั้งค่า (กรุณาใช้ `/set jail role`)",
          inline: false,
        },
        {
          name: "จำนวนผู้ที่ถูกคุมขังในขณะนี้",
          value: `${prisonerEntries.length} คน`,
          inline: false,
        }
      );

    if (prisonerEntries.length > 0) {
      const prisonerList = prisonerEntries
        .slice(0, 15)
        .map(([userId, item]) => {
          const releaseTimestamp = Math.floor(item.releaseAt / 1000);
          return `• <@${userId}> — ปลด: <t:${releaseTimestamp}:R> (เหตุผล: ${item.reason || "ไม่ระบุ"})`;
        })
        .join("\n");

      embed.addFields({
        name: "รายชื่อผู้ถูกคุมขัง",
        value: prisonerEntries.length > 15 ? `${prisonerList}\n... และอีก ${prisonerEntries.length - 15} คน` : prisonerList,
        inline: false,
      });
    }

    await respondToInteraction(interaction, {
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (subcommand === "remove-role") {
    const settings = getJailSettings(guildId);
    if (!settings.roleId) {
      await respondToInteraction(interaction, {
        content: "⚠️ เซิร์ฟเวอร์นี้ยังไม่ได้ตั้งค่ายศห้องขังค่ะ",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    saveJailSettings(guildId, {
      roleId: null,
      roleName: null,
    });

    await respondToInteraction(interaction, {
      content: "✅ ลบการตั้งค่ายศห้องขังออกจากระบบเรียบร้อยแล้วค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (subcommand === "initial-role") {
    const botMember = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await respondToInteraction(interaction, {
        content: "❌ บอทไม่มีสิทธิ์จัดการยศ (Manage Roles) ในเซิร์ฟเวอร์ จึงไม่สามารถสร้างยศได้ค่ะ กรุณาให้สิทธิ์บอทก่อน",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const createdRole = await guild.roles.create({
        name: "jail",
        permissions: 0n,
        color: 0x546e7a,
        reason: `Created by ${interaction.user.tag} via /set jail initial-role`,
      });

      saveJailSettings(guildId, {
        roleId: createdRole.id,
        roleName: createdRole.name,
      });

      await respondToInteraction(interaction, {
        content: `✅ สร้างยศ <@&${createdRole.id}> (\`${createdRole.name}\`) พร้อมปิดสิทธิ์ทั้งหมดเรียบร้อยแล้วค่ะ\n` +
          `📌 บันทึกเป็นยศห้องขัง (Jail Role) ของเซิร์ฟเวอร์เรียบร้อย\n` +
          `💡 *คุณสามารถแก้ไขชื่อยศ สี หรือตั้งค่า Channel Overrides สำหรับห้องขังใน Discord ได้ตามสะดวกเลยค่ะ*`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.warn("สร้างยศ Jail ไม่สำเร็จ:", errorSummary(err));
      await respondToInteraction(interaction, {
        content: `❌ ไม่สามารถสร้างยศได้: ${err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ Discord"}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
