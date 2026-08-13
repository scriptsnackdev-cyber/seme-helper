import fs from "fs";
import path from "path";
import sharp from "sharp";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// โครงสร้างฟอนต์ (Thai, Bracket 【】 & Symbol ⪩⪨ Emoji fallback support)
export const fontStack = '"Leelawadee UI", "Segoe UI Symbol", "Microsoft YaHei", "Quivira", "Segoe UI Emoji", "NotoSymbols", "NotoEmoji", "Arial Unicode MS", sans-serif';
export const fontStackBold = '"Leelawadee UI", "Segoe UI Symbol", "Microsoft YaHei", "Quivira", "Segoe UI Emoji", "NotoSymbolsBold", "NotoEmoji", "Arial Unicode MS", sans-serif';

export function registerSystemFonts() {
  try {
    const fontsPath = path.join(process.cwd(), "assets/fonts");
    const quiviraPath = path.join(fontsPath, "Quivira/Quivira.otf");
    const emojiPath = path.join(fontsPath, "Noto_Color_Emoji,Noto_Sans_Symbols/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf");
    const symbolsBoldPath = path.join(fontsPath, "Noto_Sans_Symbols/static/NotoSansSymbols-Bold.ttf");
    const symbolsPath = path.join(fontsPath, "Noto_Sans_Symbols/static/NotoSansSymbols-Regular.ttf");

    if (fs.existsSync(quiviraPath)) GlobalFonts.registerFromPath(quiviraPath, "Quivira");
    if (fs.existsSync(emojiPath)) GlobalFonts.registerFromPath(emojiPath, "NotoEmoji");
    if (fs.existsSync(symbolsBoldPath)) GlobalFonts.registerFromPath(symbolsBoldPath, "NotoSymbolsBold");
    if (fs.existsSync(symbolsPath)) GlobalFonts.registerFromPath(symbolsPath, "NotoSymbols");

    // ลงทะเบียนฟอนต์ระบบสำหรับสัญลักษณ์พิเศษ 【】 ⪩⪨
    const sysWinFonts = [
      { path: "C:\\Windows\\Fonts\\seguisym.ttf", name: "Segoe UI Symbol" },
      { path: "C:\\Windows\\Fonts\\seguiemj.ttf", name: "Segoe UI Emoji" },
      { path: "C:\\Windows\\Fonts\\msyh.ttc", name: "Microsoft YaHei" },
    ];
    for (const f of sysWinFonts) {
      if (fs.existsSync(f.path)) {
        try {
          GlobalFonts.registerFromPath(f.path, f.name);
        } catch (e) {}
      }
    }

    console.log("🔤 [Fonts] ลงทะเบียนฟอนต์เรียบร้อยแล้ว");
  } catch (e) {
    console.error("⚠️ [Fonts] ไม่สามารถลงทะเบียนฟอนต์ได้:", e);
  }
}

// ดาวน์โหลดรูปภาพและแปลงเป็น GIF ด้วย Sharp
export async function downloadAndConvertToGif(imageUrl, destPath) {
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const res = await fetch(imageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`โหลดรูปไม่สำเร็จ (HTTP ${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await sharp(buffer, { animated: true })
    .resize({ width: 480, withoutEnlargement: true })
    .gif()
    .toFile(destPath);
}

// แปลงไฟล์วิดีโอ MP4/MOV/WEBM เป็น Animated GIF หรือ PNGด้วย ffmpeg
export async function convertMp4ToGif(videoUrl, destPath, tempMp4Path) {
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const tempDir = path.dirname(tempMp4Path);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const res = await fetch(videoUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`โหลดวิดีโอไม่สำเร็จ (HTTP ${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tempMp4Path, buffer);

  try {
    const isPng = destPath.toLowerCase().endsWith(".png");
    const args = isPng
      ? ["-y", "-loglevel", "error", "-i", tempMp4Path, "-vframes", "1", "-update", "1", destPath]
      : [
          "-y",
          "-loglevel", "error",
          "-i", tempMp4Path,
          "-t", "10",
          "-filter_complex", "[0:v] fps=15,scale=480:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=single [p];[b][p] paletteuse",
          destPath,
        ];
    await execFileAsync(ffmpegPath, args, { maxBuffer: 50 * 1024 * 1024 });
  } finally {
    if (fs.existsSync(tempMp4Path)) {
      fs.unlinkSync(tempMp4Path);
    }
  }
}


export function drawRoundedRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

// สร้างภาพการ์ด Level Up ด้วย Canvas
export async function generateLevelUpCard(user, level, customBannerPath) {
  const canvas = createCanvas(984, 282);
  const ctx = canvas.getContext("2d");

  // 1. Banner Background เต็มแผ่นภาพ (ไม่โดน Crop)
  let loadedBg = false;
  if (customBannerPath && fs.existsSync(customBannerPath)) {
    try {
      const bgImg = await loadImage(customBannerPath);
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      loadedBg = true;
    } catch (err) {
      console.error("⚠️ ไม่สามารถโหลดแบนเนอร์ได้:", err);
    }
  }

  if (!loadedBg) {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#1a1c29");
    gradient.addColorStop(0.5, "#2d1b2e");
    gradient.addColorStop(1, "#11111d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Soft Dark Layer
  const textBgGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  textBgGradient.addColorStop(0, "rgba(0, 0, 0, 0.65)");
  textBgGradient.addColorStop(0.6, "rgba(0, 0, 0, 0.4)");
  textBgGradient.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = textBgGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Accent Line Bottom
  const themeColor = "#FFB6C1";
  const accentGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  accentGradient.addColorStop(0, themeColor);
  accentGradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = accentGradient;
  ctx.fillRect(0, canvas.height - 8, canvas.width, 8);

  // 2. Circular Avatar
  const avatarSize = 160;
  const avatarX = 50;
  const avatarY = (canvas.height - avatarSize) / 2;

  // Avatar Shadow
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  try {
    const avatarUrl = user.displayAvatarURL({ extension: "png", size: 256 });
    const avatarImg = await loadImage(avatarUrl);

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch (err) {
    console.error("⚠️ ไม่สามารถโหลด Avatar ได้:", err);
  }

  // Avatar Border Ring
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Texts
  const textX = 240;
  const pinkColor = "#FFB6C1";
  const displayName = user.globalName || user.username;

  // User Name
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = `bold 42px ${fontStackBold}`;
  ctx.fillText(displayName, textX, 85);

  // CHAT LEVEL UP! Badge
  ctx.fillStyle = themeColor;
  drawRoundedRect(ctx, textX, 105, 220, 40, 10);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `bold 22px ${fontStackBold}`;
  ctx.textAlign = "center";
  ctx.fillText("CHAT LEVEL UP!", textX + 110, 133);

  // Level Number
  ctx.textAlign = "right";
  ctx.fillStyle = pinkColor;
  ctx.font = `bold 100px ${fontStackBold}`;
  ctx.fillText(level, 930, 140);
  ctx.font = `bold 30px ${fontStackBold}`;
  ctx.fillText("LEVEL", 930, 55);

  // Progress Bar Line
  const barWidth = 690;
  const barY = 185;
  ctx.fillStyle = "rgba(255, 182, 193, 0.2)";
  drawRoundedRect(ctx, textX, barY, barWidth, 15, 7);

  ctx.fillStyle = accentGradient;
  drawRoundedRect(ctx, textX, barY, barWidth, 15, 7);

  // Subtext
  ctx.textAlign = "left";
  ctx.fillStyle = pinkColor;
  ctx.font = `italic 22px ${fontStack}`;
  ctx.fillText("✨ Keep active to earn more rewards!", textX, 240);

  return await canvas.encode("png");
}

// สร้างภาพการ์ด Give Role ด้วย Canvas
export async function generateGiveRoleCard(user, roleName, customBannerPath) {
  const canvas = createCanvas(984, 282);
  const ctx = canvas.getContext("2d");

  let loadedBg = false;
  if (customBannerPath && fs.existsSync(customBannerPath)) {
    try {
      const bgImg = await loadImage(customBannerPath);
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      loadedBg = true;
    } catch (err) {
      console.error("⚠️ ไม่สามารถโหลดแบนเนอร์ได้:", err);
    }
  }

  if (!loadedBg) {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#1c1829");
    gradient.addColorStop(0.5, "#2d1b3d");
    gradient.addColorStop(1, "#11111d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const textBgGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  textBgGradient.addColorStop(0, "rgba(0, 0, 0, 0.65)");
  textBgGradient.addColorStop(0.6, "rgba(0, 0, 0, 0.4)");
  textBgGradient.addColorStop(1, "rgba(0, 0, 0, 0.5)");
  ctx.fillStyle = textBgGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const themeColor = "#FFB6C1";
  const accentGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  accentGradient.addColorStop(0, themeColor);
  accentGradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = accentGradient;
  ctx.fillRect(0, canvas.height - 8, canvas.width, 8);

  const avatarSize = 160;
  const avatarX = 50;
  const avatarY = (canvas.height - avatarSize) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  try {
    const avatarUrl = user.displayAvatarURL({ extension: "png", size: 256 });
    const avatarImg = await loadImage(avatarUrl);

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch (err) {
    console.error("⚠️ ไม่สามารถโหลด Avatar ได้:", err);
  }

  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
  ctx.stroke();

  const textX = 240;
  const pinkColor = "#FFB6C1";
  const displayName = user.globalName || user.username;

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = `bold 38px ${fontStackBold}`;
  ctx.fillText(displayName, textX, 75);

  ctx.fillStyle = themeColor;
  drawRoundedRect(ctx, textX, 90, 240, 36, 10);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `bold 20px ${fontStackBold}`;
  ctx.textAlign = "center";
  ctx.fillText("NEW ROLE GRANTED!", textX + 120, 115);

  const roleText = `⪩ |  ${roleName}  | ⪨`;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 44px ${fontStackBold}`;
  ctx.fillText(roleText, textX, 185);

  ctx.textAlign = "left";
  ctx.fillStyle = pinkColor;
  ctx.font = `italic 22px ${fontStack}`;
  ctx.fillText("🐾 Congratulations on your new achievement!", textX, 235);

  return await canvas.encode("png");
}
