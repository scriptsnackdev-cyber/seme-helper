import { AttachmentBuilder } from "discord.js";
import {
  getLevelingSettings,
  getLevelingUserData,
  saveLevelingUserData,
  saveLevelingUserDataThrottled,
  getGlobalLevelingConfig,
  getLevelingBannerPath,
  getIntroSettings,
} from "../utils/db.js";
import { generateLevelUpCard } from "../utils/canvas.js";
import { sendHelperMessage, errorSummary } from "../utils/helper.js";
import { postIntroStickyMessage } from "../commands/set/setIntro.js";

const userCooldowns = new Map();
const processingIntroChannels = new Set();

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

async function handleIntroSticky(message, guildId) {
  const introSettings = getIntroSettings(guildId);
  if (!introSettings || !introSettings.enabled || introSettings.channelId !== message.channel.id || !introSettings.message) {
    return;
  }

  if (processingIntroChannels.has(message.channel.id)) return;
  processingIntroChannels.add(message.channel.id);

  try {
    // หน่วงเวลาเล็กน้อย (350ms) เพื่อให้ข้อความของสมาชิกถูกจัดลำดับลงห้องอย่างสมบูรณ์
    await new Promise((resolve) => setTimeout(resolve, 350));
    await postIntroStickyMessage(message.guild, introSettings);
  } catch (err) {
    console.error("❌ [Intro Sticky] ข้อผิดพลาดในการส่งเทมเพลต:", errorSummary(err));
  } finally {
    processingIntroChannels.delete(message.channel.id);
  }
}

export function setupMessageCreateEvent(client) {
  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    // 1. ตรวจสอบและส่งข้อความ Sticky Template แนะนำตัว
    await handleIntroSticky(message, guildId);

    // 2. ระบบสะสมแต้ม Leveling
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

      // คำนวณสัดส่วน Progress สำหรับวาดบนการ์ด
      const currentLevelExp = globalConfig[newLevel] || globalConfig[String(newLevel)] || 0;
      const nextLevelExp = globalConfig[newLevel + 1] || globalConfig[String(newLevel + 1)] || Math.floor(100 * Math.pow(newLevel + 1, 1.85));
      const expRange = Math.max(1, nextLevelExp - currentLevelExp);
      const currentExpProgress = Math.max(0, userData[userId].chars - currentLevelExp);
      const progressRatio = Math.min(1.0, currentExpProgress / expRange);

      const progressInfo = {
        currentExp: userData[userId].chars,
        maxExp: nextLevelExp,
        progressRatio: Math.max(0.1, progressRatio),
      };

      let attachment;
      try {
        const customBannerPath = getLevelingBannerPath(guildId);
        const cardBuffer = await generateLevelUpCard(message.author, newLevel, customBannerPath, progressInfo);
        attachment = new AttachmentBuilder(cardBuffer, { name: "levelup.png" });
      } catch (error) {
        console.warn("สร้างการ์ด Level Up ไม่สำเร็จ ใช้ข้อความ:", errorSummary(error));
      }
      try {
        await sendHelperMessage(targetChannel, {
          content: "ยินดีด้วยค่ะ <@" + userId + ">! เลเวลของคุณอัปเป็น **Level " + newLevel + "** แล้วค่ะ",
          ...(attachment ? { files: [attachment] } : {}),
        }, guildId);
      } catch (error) {
        console.warn("อัปเลเวลแล้ว แต่ส่งประกาศไม่ได้:", errorSummary(error));
      }
    } else {
      // บันทึกแบบ Throttled ทุก 3-5 วินาที เพื่อไม่ให้บล็อก Node.js Event Loop
      saveLevelingUserDataThrottled(guildId, userData);
    }
  });
}
