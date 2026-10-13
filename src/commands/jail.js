import { MessageFlags, PermissionFlagsBits } from "discord.js";
import { respondToInteraction, sendHelperMessage, errorSummary } from "../utils/helper.js";
import {
  getJailSettings,
  getJailRecords,
  saveJailRecords,
  getAllGuildsWithActiveJails,
} from "../utils/db.js";
import { hasStaffPermission, assertRoleManageable } from "../utils/permission.js";

/**
 * คำสั่ง /jail $user $time [reason]
 */
export async function handleJailCommand(interaction) {
  const { guild, guildId } = interaction;
  if (!guild || !guildId) {
    await respondToInteraction(interaction, {
      content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 1. ตรวจสอบสิทธิ์ผู้สั่ง
  const hasPerm = await hasStaffPermission(interaction, PermissionFlagsBits.ModerateMembers);
  if (!hasPerm) {
    await respondToInteraction(interaction, {
      content: "❌ คุณไม่มีสิทธิ์จัดการสมาชิก (Moderate Members) หรือยศของคุณไม่สูงกว่าบอท จึงไม่สามารถใช้คำสั่งนี้ได้ค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user");
  const minutes = interaction.options.getInteger("time");
  const reason = interaction.options.getString("reason")?.trim() || "ไม่ระบุเหตุผล";

  // 2. ตรวจสอบเป้าหมายเบื้องต้น
  if (targetUser.bot) {
    await respondToInteraction(interaction, {
      content: "❌ ไม่สามารถส่งบอทเข้าห้องขังได้ค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (targetUser.id === interaction.user.id) {
    await respondToInteraction(interaction, {
      content: "❌ คุณไม่สามารถส่งตัวเองเข้าห้องขังได้ค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (targetUser.id === guild.ownerId) {
    await respondToInteraction(interaction, {
      content: "❌ ไม่สามารถส่งเจ้าของเซิร์ฟเวอร์เข้าห้องขังได้ค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    await respondToInteraction(interaction, {
      content: "❌ ไม่พบสมาชิกคนนี้ในเซิร์ฟเวอร์ค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 3. ตรวจสอบลำดับยศ (Role Hierarchy)
  const callerMember = interaction.member;
  if (guild.ownerId !== interaction.user.id && callerMember) {
    if (callerMember.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
      await respondToInteraction(interaction, {
        content: `❌ คุณไม่สามารถขัง <@${targetUser.id}> ได้ เนื่องจากสมาชิกคนนี้มียศสูงกว่าหรือเท่ากับยศสูงสุดของคุณค่ะ`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const botMember = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!botMember || botMember.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
    await respondToInteraction(interaction, {
      content: `❌ บอทไม่สามารถจัดการ <@${targetUser.id}> ได้ เนื่องจากสมาชิกคนนี้มียศสูงกว่าหรือเท่ากับยศสูงสุดของบอทค่ะ`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 4. ตรวจสอบการตั้งค่ายศคุกของเซิร์ฟเวอร์
  const settings = getJailSettings(guildId);
  if (!settings.roleId) {
    await respondToInteraction(interaction, {
      content: "⚠️ เซิร์ฟเวอร์นี้ยังไม่ได้ตั้งค่ายศห้องขัง กรุณาให้ผู้ดูแลตั้งค่าผ่านคำสั่ง `/set jail role` ก่อนค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const jailRole = await guild.roles.fetch(settings.roleId).catch(() => null);
  if (!jailRole) {
    await respondToInteraction(interaction, {
      content: "⚠️ ไม่พบยศห้องขังในเซิร์ฟเวอร์ (อาจถูกลบไปแล้ว) กรุณาตั้งค่าใหม่ด้วย `/set jail role` ค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await assertRoleManageable(guild, jailRole);
  } catch (err) {
    await respondToInteraction(interaction, {
      content: `❌ บอทไม่สามารถจัดการยศห้องขังได้: ${err.message}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 5. ตรวจสอบว่าถูกขังอยู่แล้วหรือไม่ (ป้องกันการขังซ้ำแล้วข้อมูลยศเดิมหาย)
  const records = getJailRecords(guildId);
  if (records[targetUser.id]) {
    const existingRelease = Math.floor(records[targetUser.id].releaseAt / 1000);
    await respondToInteraction(interaction, {
      content: `⚠️ สมาชิก <@${targetUser.id}> ถูกคุมขังอยู่แล้ว (กำหนดเวลาปลด: <t:${existingRelease}:R>) หากต้องการปลดออก กรุณาใช้คำสั่ง \`/unjail\` ค่ะ`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 6. ดึงรายชื่อยศเดิมและสลับยศ
  const originalRoles = targetMember.roles.cache
    .filter((r) => r.id !== guild.id && !r.managed)
    .map((r) => r.id);
  const managedRoles = targetMember.roles.cache
    .filter((r) => r.managed)
    .map((r) => r.id);

  try {
    await targetMember.roles.set([...managedRoles, jailRole.id], `Jailed by ${interaction.user.tag}: ${reason}`);
  } catch (err) {
    console.warn("ส่งเข้าห้องขังไม่สำเร็จ:", errorSummary(err));
    await respondToInteraction(interaction, {
      content: `❌ ไม่สามารถเปลี่ยนยศได้: ${err.message || "เกิดข้อผิดพลาดของสิทธิ์บอท"}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 7. บันทึกข้อมูลเวลาปลดลง JSON
  const now = Date.now();
  const releaseAt = now + minutes * 60 * 1000;
  records[targetUser.id] = {
    userId: targetUser.id,
    userTag: targetUser.tag,
    originalRoles,
    jailRoleId: jailRole.id,
    jailedAt: now,
    jailDurationMinutes: minutes,
    releaseAt,
    jailedBy: interaction.user.id,
    reason,
  };
  saveJailRecords(guildId, records);

  // 8. ส่งข้อความแจ้งเตือน
  const releaseTimestamp = Math.floor(releaseAt / 1000);
  const successContent = `🚨 ส่งสมาชิก <@${targetUser.id}> เข้าห้องขังเป็นเวลา **${minutes} นาที** เรียบร้อยแล้วค่ะ\n⏳ กำหนดเวลาปลด: <t:${releaseTimestamp}:F> (<t:${releaseTimestamp}:R>)\n📝 เหตุผล: ${reason}`;

  try {
    const publicMsg = await sendHelperMessage(
      interaction.channel,
      { content: successContent },
      guildId
    );
    await respondToInteraction(interaction, {
      content: `${successContent}${publicMsg?.url ? ` (${publicMsg.url})` : ""}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    console.warn("ส่งประกาศ Jail ผ่าน Helper ไม่สำเร็จ:", errorSummary(err));
    await respondToInteraction(interaction, {
      content: successContent,
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * คำสั่ง /unjail $user [reason]
 */
export async function handleUnjailCommand(interaction) {
  const { guild, guildId } = interaction;
  if (!guild || !guildId) {
    await respondToInteraction(interaction, {
      content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 1. ตรวจสอบสิทธิ์ผู้สั่ง
  const hasPerm = await hasStaffPermission(interaction, PermissionFlagsBits.ModerateMembers);
  if (!hasPerm) {
    await respondToInteraction(interaction, {
      content: "❌ คุณไม่มีสิทธิ์จัดการสมาชิก (Moderate Members) หรือยศของคุณไม่สูงกว่าบอท จึงไม่สามารถใช้คำสั่งนี้ได้ค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const targetUser = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason")?.trim() || "ปลดคุกก่อนกำหนดโดยผู้ดูแล";

  const records = getJailRecords(guildId);
  const record = records[targetUser.id];

  if (!record) {
    await respondToInteraction(interaction, {
      content: `⚠️ สมาชิก <@${targetUser.id}> ไม่ได้อยู่ในรายชื่อผู้ถูกคุมขังค่ะ`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 2. คืนยศเดิม
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  if (targetMember) {
    const validOriginalRoles = (record.originalRoles || []).filter((id) => guild.roles.cache.has(id));
    const managedRoles = targetMember.roles.cache.filter((r) => r.managed).map((r) => r.id);

    try {
      await targetMember.roles.set([...managedRoles, ...validOriginalRoles], `Unjailed by ${interaction.user.tag}: ${reason}`);
    } catch (err) {
      console.warn("ปลดคุกและคืนยศไม่สำเร็จ:", errorSummary(err));
      await respondToInteraction(interaction, {
        content: `❌ ไม่สามารถคืนยศได้: ${err.message || "เกิดข้อผิดพลาดของสิทธิ์บอท"}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  // 3. ลบรายการออกจากฐานข้อมูล
  delete records[targetUser.id];
  saveJailRecords(guildId, records);

  const successContent = `✅ ปลดสมาชิก <@${targetUser.id}> ออกจากห้องขังและคืนยศเดิมเรียบร้อยแล้วค่ะ\n📝 เหตุผล: ${reason}`;

  try {
    const publicMsg = await sendHelperMessage(
      interaction.channel,
      { content: successContent },
      guildId
    );
    await respondToInteraction(interaction, {
      content: `${successContent}${publicMsg?.url ? ` (${publicMsg.url})` : ""}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    console.warn("ส่งประกาศ Unjail ผ่าน Helper ไม่สำเร็จ:", errorSummary(err));
    await respondToInteraction(interaction, {
      content: successContent,
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * ฟังก์ชันสแกนตรวจสอบ Date.now() >= releaseAt ใน JSON และปลดคุกอัตโนมัติ (นาทีละ 1 ครั้ง)
 */
let isCheckingJails = false;

export async function checkAndReleaseExpiredJails(client) {
  if (isCheckingJails) return;
  isCheckingJails = true;

  try {
    const guildIds = getAllGuildsWithActiveJails();
    if (guildIds.length === 0) return;

    const now = Date.now();

    for (const guildId of guildIds) {
      try {
        const records = getJailRecords(guildId);
        const entries = Object.entries(records);
        if (entries.length === 0) continue;

        let hasChanges = false;
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) continue;

        for (const [userId, record] of entries) {
          if (now >= record.releaseAt) {
            try {
              const member = await guild.members.fetch(userId).catch(() => null);
              if (member) {
                const validOriginalRoles = (record.originalRoles || []).filter((id) => guild.roles.cache.has(id));
                const managedRoles = member.roles.cache.filter((r) => r.managed).map((r) => r.id);
                await member.roles.set([...managedRoles, ...validOriginalRoles], "ระยะเวลาคุมขังหมดอายุ (Jail Expired)");
                console.log(`🔓 [Jail] ปลดคุกและคืนยศเดิมให้ ${member.user.tag} ในเซิร์ฟเวอร์ ${guild.name} เรียบร้อยแล้ว`);
              }
            } catch (memberErr) {
              console.warn(`⚠️ [Jail Warning] ไม่สามารถคืนยศให้ ${userId} ใน ${guildId}:`, errorSummary(memberErr));
            }
            delete records[userId];
            hasChanges = true;
          }
        }

        if (hasChanges) {
          saveJailRecords(guildId, records);
        }
      } catch (guildErr) {
        console.warn(`⚠️ [Jail Warning] เกิดข้อผิดพลาดขณะตรวจสอบห้องขังใน ${guildId}:`, errorSummary(guildErr));
      }
    }
  } catch (err) {
    console.error("❌ [Jail Error] เกิดข้อผิดพลาดในรอบตรวจสอบห้องขัง:", errorSummary(err));
  } finally {
    isCheckingJails = false;
  }
}

/**
 * เริ่มต้นตัวสแกนห้องขังอัตโนมัติ (รอบละ 1 นาที / ทุกๆ 60 วินาที)
 */
export function startJailCheckInterval(client) {
  // รัน 1 ครั้งเมื่อเริ่มต้น เพื่อเก็บกวาดคนที่หมดเวลาระหว่างบอทออฟไลน์
  checkAndReleaseExpiredJails(client).catch(() => {});

  // วนสแกนนาทีละ 1 ครั้ง
  return setInterval(() => {
    checkAndReleaseExpiredJails(client).catch(() => {});
  }, 60 * 1000);
}
