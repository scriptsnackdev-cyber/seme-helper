import { Client, GatewayIntentBits } from "discord.js";
import "dotenv/config";

import { registerSystemFonts } from "./utils/canvas.js";
import { setupReadyEvent } from "./events/ready.js";
import { setupGuildMemberAddEvent } from "./events/guildMemberAdd.js";
import { setupMessageCreateEvent } from "./events/messageCreate.js";
import { setupInteractionCreateEvent } from "./events/interactionCreate.js";
import { setupGuildCreateEvent } from "./events/guildCreate.js";
import { setupGuildDeleteEvent } from "./events/guildDelete.js";

// ป้องกันบอทดับจาก Unhandled Promise Rejections และ Uncaught Exceptions
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ [Unhandled Rejection]:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ [Uncaught Exception]:", err);
});

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token) {
  console.error("❌ ไม่พบบอทโทเคน! กรุณาระบุ DISCORD_TOKEN ในไฟล์ .env");
  process.exit(1);
}

// สร้าง Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// 1. ลงทะเบียนฟอนต์ระบบการ์ด
registerSystemFonts();

// 2. ติดตั้ง Event Listeners โมดูลาร์
setupReadyEvent(client, token, clientId);
setupGuildMemberAddEvent(client);
setupMessageCreateEvent(client);
setupInteractionCreateEvent(client);
setupGuildCreateEvent(client, token, clientId);
setupGuildDeleteEvent(client);

// 3. เข้าสู่ระบบ Discord
client.login(token);