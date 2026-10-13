import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { Song } from "distube";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

// ── Path ของ yt-dlp ──
const isWindows = process.platform === "win32";
const rootDir = path.resolve(__dirname, "../..");
const YTDLP_PATH = isWindows
  ? path.join(rootDir, "yt-dlp.exe")
  : (fs.existsSync(path.join(rootDir, "yt-dlp")) ? path.join(rootDir, "yt-dlp") : "yt-dlp");

console.log(`🎵 [Music] yt-dlp path: ${YTDLP_PATH} (System: ${process.platform})`);

/**
 * ฟังก์ชันยิงคำสั่ง yt-dlp เพื่อสกัดข้อมูลและ Stream URL
 */
export async function ytdlp(args, useCookie = true) {
  const finalArgs = [...args];
  if (useCookie) {
    const cookiePath = path.join(rootDir, "cookies.txt");
    if (fs.existsSync(cookiePath)) {
      finalArgs.push("--cookies", cookiePath);
    } else if (process.env.YOUTUBE_COOKIE) {
      finalArgs.push("--add-header", `Cookie:${process.env.YOUTUBE_COOKIE}`);
    }
  }
  finalArgs.push(
    "--no-check-certificates",
    "--prefer-free-formats",
    "--add-header",
    "User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
  );

  try {
    const { stdout } = await execFileAsync(YTDLP_PATH, finalArgs, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 50,
      windowsHide: true,
    });
    return JSON.parse(stdout);
  } catch (err) {
    if (useCookie && process.env.YOUTUBE_COOKIE) return ytdlp(args, false);
    throw err;
  }
}

/**
 * Custom Extractor Plugin สำหรับ DisTube โดยใช้ yt-dlp
 */
export const ytdlpPlugin = {
  type: "extractor",
  name: "yt-dlp-custom",
  init(distube) {
    this.distube = distube;
  },
  async validate(url) {
    return url.includes("youtube.com") || url.includes("youtu.be") || !url.startsWith("http");
  },
  async resolve(url, options = {}) {
    const cleanUrl = url.replace(/[?&]list=[^&]*/g, "").replace(/[?&]index=[^&]*/g, "");
    const info = await ytdlp([
      "--dump-single-json",
      "--no-warnings",
      "--skip-download",
      "--simulate",
      "--no-playlist",
      cleanUrl,
    ]);
    return new Song(
      {
        plugin: ytdlpPlugin,
        source: "youtube",
        playFromSource: true,
        id: info.id,
        name: info.title || info.fulltitle,
        url: info.webpage_url || info.original_url,
        duration: info.is_live ? 0 : info.duration || 0,
        isLive: info.is_live || false,
        thumbnail: info.thumbnail,
        uploader: { name: info.uploader || "Unknown", url: info.uploader_url || "" },
      },
      { member: options.member }
    );
  },
  async searchSong(query, options = {}) {
    try {
      const info = await ytdlp([
        "--dump-single-json",
        "--no-warnings",
        "--skip-download",
        "--simulate",
        "--no-playlist",
        "--flat-playlist",
        `ytsearch1:${query}`,
      ]);
      const entry = info.entries?.[0] || info;
      if (!entry || !entry.id) return null;
      return new Song(
        {
          plugin: ytdlpPlugin,
          source: "youtube",
          playFromSource: true,
          id: entry.id,
          name: entry.title || "Unknown",
          url: entry.webpage_url || entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
          duration: entry.duration || 0,
          isLive: entry.is_live || false,
          thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url || null,
          uploader: { name: entry.uploader || entry.channel || "Unknown", url: "" },
        },
        { member: options.member }
      );
    } catch {
      return null;
    }
  },
  async getStreamURL(song) {
    const info = await ytdlp([
      "--dump-single-json",
      "--no-warnings",
      "--skip-download",
      "--simulate",
      "--no-playlist",
      "--format",
      "bestaudio/best",
      song.url,
    ]);
    return info.url;
  },
  async getRelatedSongs(song) {
    if (song.source !== "youtube") return [];
    try {
      const results = await this.distube.search(song.name, { limit: 5 });
      return results
        .map((s) => {
          s.plugin = ytdlpPlugin;
          return s;
        })
        .filter((s) => s.id !== song.id);
    } catch {
      return [];
    }
  },
};
