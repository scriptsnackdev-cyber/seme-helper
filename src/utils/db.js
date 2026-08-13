import fs from "fs";
import path from "path";

export const DATABASE_DIR = "./database";
export const SERVER_LIST_FILE = "./serverlist.json";
export const LEVELING_CONFIG_FILE = "./leveling.json";

// ฟังก์ชันสร้างหรืออ่านไฟล์ JSON ศูนย์กลางพร้อมค่าเริ่มต้น
export function readJson(filePath, defaultValue = {}) {
  if (!fs.existsSync(filePath)) {
    writeJson(filePath, defaultValue);
    return defaultValue;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.error(`❌ [DB Error] ไม่สามารถอ่านไฟล์ ${filePath}:`, err);
    return defaultValue;
  }
}

// ฟังก์ชันบันทึกไฟล์ JSON ศูนย์กลาง
export function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ฟังก์ชันเตรียมโฟลเดอร์สำหรับเซิร์ฟเวอร์
export function ensureGuildDatabase(guildId) {
  const guildDir = path.join(DATABASE_DIR, guildId);
  const welcomeDir = path.join(guildDir, "welcome");
  const memberDir = path.join(guildDir, "member");
  const memberFormDir = path.join(guildDir, "member_form");
  const quizDir = path.join(guildDir, "quiz");
  const quizResultsDir = path.join(guildDir, "quiz", "results");
  const levelingDir = path.join(guildDir, "leveling");
  const giveroleDir = path.join(guildDir, "giverole");

  if (!fs.existsSync(welcomeDir)) fs.mkdirSync(welcomeDir, { recursive: true });
  if (!fs.existsSync(memberDir)) fs.mkdirSync(memberDir, { recursive: true });
  if (!fs.existsSync(memberFormDir)) fs.mkdirSync(memberFormDir, { recursive: true });
  if (!fs.existsSync(quizDir)) fs.mkdirSync(quizDir, { recursive: true });
  if (!fs.existsSync(quizResultsDir)) fs.mkdirSync(quizResultsDir, { recursive: true });
  if (!fs.existsSync(levelingDir)) fs.mkdirSync(levelingDir, { recursive: true });
  if (!fs.existsSync(giveroleDir)) fs.mkdirSync(giveroleDir, { recursive: true });
}

// ==================== DOMAIN HELPERS ==================== //

// 1. Settings รวมของเซิร์ฟเวอร์
export function getGuildSettings(guildId) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "settings.json");
  return readJson(filePath, { welcomeEnabled: false });
}

export function saveGuildSettings(guildId, settings) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "settings.json");
  writeJson(filePath, settings);
}

// 2. Welcome Settings
export function getWelcomeSettings(guildId) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "welcome", "setting.json");
  return readJson(filePath, { enabled: false, message: null, roleId: null, roleName: null, channelId: null, channelName: null });
}

export function saveWelcomeSettings(guildId, settings) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "welcome", "setting.json");
  writeJson(filePath, settings);
}

export function getBannerPath(guildId) {
  const gifPath = path.join(DATABASE_DIR, guildId, "welcome", "banner.gif");
  const webpPath = path.join(DATABASE_DIR, guildId, "welcome", "banner.webp");
  if (fs.existsSync(gifPath)) return { path: gifPath, filename: "banner.gif" };
  if (fs.existsSync(webpPath)) return { path: webpPath, filename: "banner.webp" };
  return null;
}

// 3. Member & Member Form
export function getMemberBannerPath(guildId) {
  const gifPath = path.join(DATABASE_DIR, guildId, "member", "banner.gif");
  const webpPath = path.join(DATABASE_DIR, guildId, "member", "banner.webp");
  if (fs.existsSync(gifPath)) return { path: gifPath, filename: "banner.gif" };
  if (fs.existsSync(webpPath)) return { path: webpPath, filename: "banner.webp" };
  return null;
}

export function getMemberFormSettings(guildId) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "member_form", "setting.json");
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath, null);
}

export function saveMemberFormSettings(guildId, settings) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "member_form", "setting.json");
  writeJson(filePath, settings);
}

export function getMemberFormBannerPath(guildId) {
  const gifPath = path.join(DATABASE_DIR, guildId, "member_form", "banner.gif");
  const webpPath = path.join(DATABASE_DIR, guildId, "member_form", "banner.webp");
  if (fs.existsSync(gifPath)) return { path: gifPath, filename: "banner.gif" };
  if (fs.existsSync(webpPath)) return { path: webpPath, filename: "banner.webp" };
  return null;
}

// 4. Quiz Config & Results
export function getQuizConfig(guildId) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "quiz", "config.json");
  const defaultConfig = { title: "แบบทดสอบวัดระดับยศ", description: "", buttonText: "🧠 ทำแบบทดสอบ", results: [], questions: [] };
  if (!fs.existsSync(filePath)) {
    writeJson(filePath, defaultConfig);
    return defaultConfig;
  }
  const raw = readJson(filePath, defaultConfig) || {};
  return {
    title: raw.title || defaultConfig.title,
    description: raw.description || defaultConfig.description,
    buttonText: raw.buttonText || defaultConfig.buttonText,
    results: Array.isArray(raw.results) ? raw.results : [],
    questions: Array.isArray(raw.questions) ? raw.questions : [],
  };
}

export function saveQuizConfig(guildId, config) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "quiz", "config.json");
  writeJson(filePath, config);
}

export function getQuizHeaderBannerPath(guildId) {
  const gifPath = path.join(DATABASE_DIR, guildId, "quiz", "header_banner.gif");
  const webpPath = path.join(DATABASE_DIR, guildId, "quiz", "header_banner.webp");
  if (fs.existsSync(gifPath)) return { path: gifPath, filename: "header_banner.gif" };
  if (fs.existsSync(webpPath)) return { path: webpPath, filename: "header_banner.webp" };
  return null;
}

export function getQuizResultBannerPath(guildId, resultId) {
  const encId = encodeURIComponent(resultId);
  const gifPath = path.join(DATABASE_DIR, guildId, "quiz", "results", `${encId}.gif`);
  const webpPath = path.join(DATABASE_DIR, guildId, "quiz", "results", `${encId}.webp`);
  if (fs.existsSync(gifPath)) return { path: gifPath, filename: `${encId}.gif` };
  if (fs.existsSync(webpPath)) return { path: webpPath, filename: `${encId}.webp` };

  const rawGif = path.join(DATABASE_DIR, guildId, "quiz", "results", `${resultId}.gif`);
  const rawWebp = path.join(DATABASE_DIR, guildId, "quiz", "results", `${resultId}.webp`);
  if (fs.existsSync(rawGif)) return { path: rawGif, filename: `${resultId}.gif` };
  if (fs.existsSync(rawWebp)) return { path: rawWebp, filename: `${resultId}.webp` };
  return null;
}

// 5. Leveling Settings & User Data
export function getLevelingSettings(guildId) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "leveling", "setting.json");
  return readJson(filePath, { enabled: false, channelId: null });
}

export function saveLevelingSettings(guildId, settings) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "leveling", "setting.json");
  writeJson(filePath, settings);
}

export function getGlobalLevelingConfig() {
  if (!fs.existsSync(LEVELING_CONFIG_FILE)) {
    const levelsConfig = {};
    for (let l = 1; l <= 100; l++) {
      levelsConfig[l] = Math.floor(100 * Math.pow(l, 1.85));
    }
    writeJson(LEVELING_CONFIG_FILE, levelsConfig);
    return levelsConfig;
  }
  return readJson(LEVELING_CONFIG_FILE);
}

export function getLevelingUserData(guildId) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "leveling", "database.json");
  return readJson(filePath, {});
}

export function saveLevelingUserData(guildId, data) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "leveling", "database.json");
  writeJson(filePath, data);
}

export function getLevelingBannerPath(guildId) {
  const levDir = path.join(DATABASE_DIR, guildId, "leveling");
  const webpPath = path.join(levDir, "banner.webp");
  const pngPath = path.join(levDir, "banner.png");
  const gifPath = path.join(levDir, "banner.gif");
  if (fs.existsSync(webpPath)) return webpPath;
  if (fs.existsSync(pngPath)) return pngPath;
  if (fs.existsSync(gifPath)) return gifPath;
  return null;
}

// 6. GiveRole Banner Helper
export function getGiveRoleBannerPath(guildId) {
  const dir = path.join(DATABASE_DIR, guildId, "giverole");
  const gifPath = path.join(dir, "banner.gif");
  const webpPath = path.join(dir, "banner.webp");
  const pngPath = path.join(dir, "banner.png");
  if (fs.existsSync(gifPath)) return { path: gifPath, filename: "banner.gif" };
  if (fs.existsSync(webpPath)) return { path: webpPath, filename: "banner.webp" };
  if (fs.existsSync(pngPath)) return { path: pngPath, filename: "banner.png" };
  return null;
}

// 7. Server List Logging Helper
export function logServerCount(guilds) {
  try {
    const list = guilds.cache.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberCount,
    }));
    writeJson(SERVER_LIST_FILE, { totalServers: list.length, updatedAt: new Date().toISOString(), servers: list });
    console.log(`📊 [Server List] บันทึกรายชื่อเซิร์ฟเวอร์ทั้งหมด ${list.length} เซิร์ฟเวอร์เรียบร้อยแล้ว`);
  } catch (err) {
    console.error("❌ ไม่สามารถบันทึกรายชื่อเซิร์ฟเวอร์ได้:", err);
  }
}

// 8. Image Gallery Metadata Helpers
export function getImageGalleryData(guildId) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "image", "data.json");
  const raw = readJson(filePath, { titles: {} }) || {};
  return {
    titles: raw && typeof raw.titles === "object" && raw.titles !== null ? raw.titles : {},
  };
}

export function saveImageGalleryData(guildId, data) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "image", "data.json");
  writeJson(filePath, data);
}

// 9. Server Helper (Custom Webhook Persona)
export function getHelperSettings(guildId) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "helper.json");
  return readJson(filePath, { enabled: false, name: null, avatar: null });
}

export function saveHelperSettings(guildId, settings) {
  ensureGuildDatabase(guildId);
  const filePath = path.join(DATABASE_DIR, guildId, "helper.json");
  writeJson(filePath, settings);
}

