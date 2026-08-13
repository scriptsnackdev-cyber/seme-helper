import { AttachmentBuilder } from "discord.js";
import {
  getLevelingSettings,
  getLevelingUserData,
  saveLevelingUserData,
  getGlobalLevelingConfig,
  getLevelingBannerPath,
} from "../utils/db.js";
import { generateLevelUpCard } from "../utils/canvas.js";

const userCooldowns = new Map();

// ทำความสะอาด Map คูลดาวน์เมื่อสะสมข้อมูลเกิน 1,000 รายการ
function cleanupUserCooldowns() {
  if (userCooldowns.size > 1000) {
    const now = Date.now();
    for (const [key, timestamp] of userCooldowns.entries()) {
      if (now - timestamp > 10000) {
        userCooldowns.delete(key);
      }
    }
  }
}

export function setupMessageCreateEvent(client) {
  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    const levelingSettings = getLevelingSettings(guildId);
    if (!levelingSettings || !levelingSettings.enabled) return;

    const content = message.content ? message.content.trim() : "";
    if (content.length === 0) return;

    const now = Date.now();
    const userKey = `${guildId}_${userId}`;
    const lastTimestamp = userCooldowns.get(userKey) || 0;
    if (now - lastTimestamp < 3000) return; // 3-second cooldown
    userCooldowns.set(userKey, now);
    cleanupUserCooldowns();

    const charCount = content.length;
    const globalConfig = getGlobalLevelingConfig();
    const userData = getLevelingUserData(guildId);

    if (!userData[userId]) {
      userData[userId] = { chars: 0, level: 1 };
    }

    userData[userId].chars = (userData[userId].chars || 0) + charCount;
    let currentLevel = userData[userId].level || 1;
    let newLevel = currentLevel;

    const maxLevel = 100;
    while (newLevel < maxLevel) {
      const nextLvl = newLevel + 1;
      const requiredExp = globalConfig[nextLvl] || globalConfig[String(nextLvl)] || Math.floor(100 * Math.pow(nextLvl, 1.85));
      if (userData[userId].chars >= requiredExp) {
        newLevel++;
      } else {
        break;
      }
    }

    if (newLevel > currentLevel) {
      userData[userId].level = newLevel;
      saveLevelingUserData(guildId, userData);

      let targetChannel = message.channel;
      if (levelingSettings.channelId) {
        const customChannel = await message.guild.channels.fetch(levelingSettings.channelId).catch(() => null);
        if (customChannel) targetChannel = customChannel;
      }

      console.log(`🎉 [Level Up Log] ${message.author.tag} อัปเวลเป็น Level ${newLevel}! (พิมพ์สะสมทั้งหมด ${userData[userId].chars} อักขระ)`);

      try {
        const customBannerPath = getLevelingBannerPath(guildId);
        const cardBuffer = await generateLevelUpCard(message.author, newLevel, customBannerPath);
        const attachment = new AttachmentBuilder(cardBuffer, { name: "levelup.png" });

        await targetChannel.send({
          content: `🎉 ยินดีด้วยค่ะ <@${userId}>! เลเวลของคุณอัปเป็น **Level ${newLevel}** แล้วค่ะ! ✨`,
          files: [attachment],
        });
      } catch (cardErr) {
        console.error("❌ ไม่สามารถสร้างการ์ด Level Up ได้:", cardErr);
        await targetChannel.send({
          content: `🎉 ยินดีด้วยค่ะ <@${userId}>! เลเวลของคุณอัปเป็น **Level ${newLevel}** แล้วค่ะ! ✨`,
        });
      }
    } else {
      saveLevelingUserData(guildId, userData);
    }
  });
}
