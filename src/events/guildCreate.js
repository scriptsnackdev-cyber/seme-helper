import { logServerCount } from "../utils/db.js";
import { registerGuildCommands, getSlashCommandDefinitions } from "./ready.js";

export function setupGuildCreateEvent(client, token, clientId) {
  client.on("guildCreate", async (guild) => {
    console.log(`📥 [Guild Join] บอทถูกดึงเข้าเซิร์ฟเวอร์ใหม่: ${guild.name} (ID: ${guild.id})`);
    
    // บันทึกจำนวนเซิร์ฟเวอร์ใหม่
    logServerCount(client.guilds);

    // ลงทะเบียน Slash Commands สำหรับเซิร์ฟเวอร์ใหม่ทันที
    try {
      const commands = getSlashCommandDefinitions();
      await registerGuildCommands(token, clientId, guild.id, commands);
      console.log(`✅ [Guild Join] ลงทะเบียน Slash Commands ให้กับ ${guild.name} สำเร็จ!`);
    } catch (err) {
      console.error(`❌ [Guild Join Error] ไม่สามารถลงทะเบียนคำสั่งให้ ${guild.name}:`, err);
    }
  });
}
