import { AttachmentBuilder } from "discord.js";
import { getWelcomeSettings, getBannerPath } from "../utils/db.js";
import { sendHelperMessage } from "../utils/helper.js";

export function setupGuildMemberAddEvent(client) {
  client.on("guildMemberAdd", async (member) => {
    try {
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
          console.error(`❌ [Auto Role Error] ไม่สามารถแจกยศให้ ${member.user.tag}:`, err);
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
      console.error("❌ เกิดข้อผิดพลาดในระบบต้อนรับสมาชิกใหม่:", err);
    }
  });
}
