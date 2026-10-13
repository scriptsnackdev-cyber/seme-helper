import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { Song, Playlist } from "distube";

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
    // ตรวจสอบว่าเป็นลิงก์ Playlist โดยตรงเท่านั้น (เช่น /playlist?list=PL... โดยไม่มีตัวระบุคลิปเดี่ยว watch?v= หรือ youtu.be/)
    const hasVideoId = url.includes("watch?v=") || url.includes("youtu.be/");
    const isExplicitPlaylist = !hasVideoId && (url.includes("/playlist") || url.includes("list="));

    if (isExplicitPlaylist) {
      try {
        const matchIndex = url.match(/[?&]index=(\d+)/);
        const startIndex = matchIndex ? Math.max(1, parseInt(matchIndex[1], 10)) : 1;
        const info = await ytdlp([
          "--dump-single-json",
          "--no-warnings",
          "--skip-download",
          "--simulate",
          "--flat-playlist",
          "--playlist-start",
          String(startIndex),
          "--playlist-end",
          String(startIndex + 9),
          url,
        ]);

        if (info.entries && info.entries.length > 0) {
          const songs = info.entries.map(
            (entry) =>
              new Song(
                {
                  plugin: ytdlpPlugin,
                  source: "youtube",
                  playFromSource: true,
                  id: entry.id,
                  name: entry.title || "Unknown",
                  url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                  duration: entry.duration || 0,
                  isLive: false,
                  thumbnail: entry.thumbnails?.[0]?.url || null,
                  uploader: { name: entry.uploader || entry.channel || "Unknown", url: "" },
                },
                { member: options.member }
              )
          );

          const playlist = new Playlist(
            {
              name: info.title || "YouTube Playlist",
              url: info.webpage_url || url,
              songs,
              source: "youtube",
            },
            { member: options.member }
          );
          playlist._playlistContext = { url, nextIndex: startIndex + songs.length };
          return playlist;
        }
      } catch (err) {
        console.warn("⚠️ [Playlist Extract Fallback]:", err?.message || err);
      }
    }

    // หากเป็นคลิปเพลงเดี่ยว ให้ตัด list= และ index= ออกเสมอ เพื่อไม่ให้ YouTube Mix ดึงเพลงมาพ่วง
    const cleanUrl = url.replace(/[?&]list=[^&]*/g, "").replace(/[?&]index=[^&]*/g, "");
    const info = await ytdlp([
      "--dump-single-json",
      "--no-warnings",
      "--skip-download",
      "--simulate",
      "--no-playlist",
      cleanUrl,
    ]);
    const song = new Song(
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
    if (url.includes("list=")) {
      song._sourceMixUrl = url;
    }
    return song;
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

/**
 * ดึง 10 เพลงถัดไปสำหรับระบบ Auto (Autoplay)
 * - หากมี Playlist Context: ดึง 10 เพลงถัดไปจาก Playlist นั้น
 * - หากไม่มี: ค้นหา 10 เพลงที่คล้ายกันโดยใช้ชื่อศิลปินและเพลงปัจจุบัน
 * @param {import('distube').Queue} queue 
 * @param {import('distube').Song} currentSong 
 * @returns {Promise<import('distube').Song[]>}
 */
export async function fetchAuto10Songs(queue, currentSong) {
  const member = currentSong?.member || queue.clientMember;
  let rawEntries = [];

  // 1. ถ้ามี Playlist Context เดิม ให้ดึงเพลงถัดไปจาก Playlist นั้น
  if (queue._playlistContext && queue._playlistContext.url) {
    try {
      const { url, nextIndex } = queue._playlistContext;
      const info = await ytdlp([
        "--dump-single-json",
        "--no-warnings",
        "--skip-download",
        "--simulate",
        "--flat-playlist",
        "--playlist-start",
        String(nextIndex || 1),
        "--playlist-end",
        String((nextIndex || 1) + 9),
        url,
      ]);

      if (info.entries && info.entries.length > 0) {
        rawEntries = info.entries;
        queue._playlistContext.nextIndex = (nextIndex || 1) + info.entries.length;
      }
    } catch (e) {
      console.warn("⚠️ [Autoplay Playlist Fetch Error]:", e?.message || e);
    }
  }

  // 2. ถ้าไม่มี Playlist Context หรือดึงจาก Playlist ไม่ได้ ให้ค้นหาเพลงที่คล้ายกันจากศิลปิน/ชื่อเพลง
  if (!rawEntries.length && currentSong) {
    try {
      const uploader =
        currentSong.uploader?.name && currentSong.uploader.name !== "Unknown"
          ? currentSong.uploader.name
          : "";
      const cleanTitle = (currentSong.name || "").replace(/\[.*?\]|\(.*?\)|official|music|video|audio/gi, "").trim();
      const searchQuery = uploader ? `${uploader} ${cleanTitle}` : cleanTitle;

      const info = await ytdlp([
        "--dump-single-json",
        "--no-warnings",
        "--skip-download",
        "--simulate",
        "--flat-playlist",
        `ytsearch15:${searchQuery}`,
      ]);

      if (info.entries && info.entries.length > 0) {
        rawEntries = info.entries;
      }
    } catch (e) {
      console.warn("⚠️ [Autoplay Search Fetch Error]:", e?.message || e);
    }
  }

  if (!rawEntries.length) return [];

  // กรองเพลงที่ไม่ซ้ำกับเพลงก่อนหน้าและเพลงในคิวปัจจุบัน
  const prevIds = new Set((queue.previousSongs || []).map((s) => s.id));
  if (currentSong?.id) prevIds.add(currentSong.id);
  (queue.songs || []).forEach((s) => prevIds.add(s.id));

  const validEntries = rawEntries.filter((e) => e && e.id && !prevIds.has(e.id)).slice(0, 10);

  return validEntries.map(
    (entry) =>
      new Song(
        {
          plugin: ytdlpPlugin,
          source: "youtube",
          playFromSource: true,
          id: entry.id,
          name: entry.title || "Unknown",
          url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
          duration: entry.duration || 0,
          isLive: false,
          thumbnail: entry.thumbnails?.[0]?.url || null,
          uploader: { name: entry.uploader || entry.channel || "Unknown", url: "" },
        },
        { member }
      )
  );
}
