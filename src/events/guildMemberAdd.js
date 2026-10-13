import { AttachmentBuilder } from "discord.js";
import { getWelcomeSettings, getBannerPath, getJailRecords } from "../utils/db.js";
import { sendHelperMessage, errorSummary } from "../utils/helper.js";

export function setupGuildMemberAddEvent(client) {
  client.on("guildMemberAdd", async (member) => {
    try {
      // 0. ป้องกันการหนีคุก: หากสมาชิกกำลังติดคุกอยู่ ให้ใส่ยศคุกกลับและข้าม welcome
      const jailRecords = getJailRecords(member.guild.id);
      const jailRecord = jailRecords[member.id];
      if (jailRecord && Date.now() < jailRecord.releaseAt) {
        if (jailRecord.jailRoleId) {
          try {
            const jailRole = await member.guild.roles.fetch(jailRecord.jailRoleId);
            if (jailRole) {
              await member.roles.add(jailRole);
              console.log(`🔒 [Jail Evade Prevention] สมาชิก ${member.user.tag} กำลังติดคุก บอทใส่ยศ ${jailRole.name} กลับให้ทันที`);
            }
          } catch (jailErr) {
            console.error(`❌ [Jail Error] ไม่สามารถใส่ยศคุกให้ ${member.user.tag}:`, errorSummary(jailErr));
          }
        }
        return;
      }

      const settings = getWelcomeSettings(member.guild.id);

      // 1. แจกยศสมาชิกใหม่อัตโนมัติ
      if (settings.roleId) {
        try {
          const role = await member.guild.roles.fetch(settings.roleId);
          if (role) {
            await member.roles.add(role);
            console.log(`✅ [Auto Role] มอบยศ ${role.name} ให้กับ ${member.user.tag} ในเซิร์ฟเวอร์ ${member.guild.name} เรียบร้อยแล้ว`);
          }
        } catch (err) {
          console.error(`❌ [Auto Role Error] ไม่สามารถแจกยศให้ ${member.user.tag}:`, errorSummary(err));
        }
      }

      // 2. ส่งข้อความต้อนรับ
      if (!settings.enabled || !settings.channelId) return;

      const channel = await member.guild.channels.fetch(settings.channelId).catch(() => null);
      if (!channel) return;

      const rawMessage = settings.message || "WELCOME TO {guild} 🐱🐾\nยินดีต้อนรับคุณ {user} เข้าสู่เซิร์ฟเวอร์ของเราค่ะ!";
      const welcomeText = rawMessage
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{guild}/g, member.guild.name);

      const sendOptions = { content: welcomeText };
      const bannerInfo = getBannerPath(member.guild.id);

      if (bannerInfo) {
        const attachment = new AttachmentBuilder(bannerInfo.path, { name: bannerInfo.filename });
        sendOptions.files = [attachment];
      }

      await sendHelperMessage(channel, sendOptions, member.guild.id);
      console.log(`🐾 [Welcome] ส่งข้อความต้อนรับให้ ${member.user.tag} ในห้อง #${channel.name} สำเร็จ`);
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาดในระบบต้อนรับสมาชิกใหม่:", errorSummary(err));
    }
  });
}
