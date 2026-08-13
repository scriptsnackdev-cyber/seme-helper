import { logServerCount } from "../utils/db.js";

export function setupGuildDeleteEvent(client) {
  client.on("guildDelete", async (guild) => {
    console.log(`📤 [Guild Leave] บอทออกจากเซิร์ฟเวอร์: ${guild.name} (ID: ${guild.id})`);
    logServerCount(client.guilds);
  });
}
