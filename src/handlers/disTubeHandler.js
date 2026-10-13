import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from "discord.js";
import { generateMusicPanel, generateFinishedPanel } from "../utils/musicUI.js";
import { fetchAuto10Songs } from "../utils/musicPlugin.js";

/**
 * เติม 10 เพลงอัตโนมัติเมื่อเปิด Auto และเพลงใกล้หมด
 */
export async function handleAutoReplenish(queue, song) {
  if (!queue || !queue.autoplay || queue._isReplenishing) return;
  if (queue.songs.length > 1) return;

  queue._isReplenishing = true;
  try {
    const currentSong = song || queue.songs[0];
    const autoSongs = await fetchAuto10Songs(queue, currentSong);
    if (autoSongs && autoSongs.length > 0) {
      queue.addToQueue(autoSongs);
      const embed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setDescription(`📻 **[Auto]** เพิ่ม 10 เพลงถัดไปเข้าคิวให้อัตโนมัติแล้วค่ะ! (ดูคิวได้ใน \`/music queue\`)`);
      queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    console.warn("⚠️ [handleAutoReplenish Error]:", err?.message || err);
  } finally {
    queue._isReplenishing = false;
  }
}

export function setupDisTubeEvents(client) {
  if (!client.distube) return;

  client.distube
    .on("playSong", async (queue, song) => {
      console.log(`🎵 [DisTube PlaySong]: ${song.name} (${song.duration}s)`);
      const { embeds, components } = generateMusicPanel(queue);
      const msg = await queue.textChannel?.send({ embeds, components }).catch(() => null);
      if (!msg) return;

      const currentMsgId = msg.id;
      queue._activeMessageId = currentMsgId;
      queue._activeMsg = msg;

      if (queue._liveInterval) clearInterval(queue._liveInterval);

      queue._liveInterval = setInterval(async () => {
        try {
          if (queue._activeMessageId !== currentMsgId) {
            return clearInterval(queue._liveInterval);
          }
          const currentQueue = client.distube.getQueue(queue.id);
          if (!currentQueue || !currentQueue.songs.length || currentQueue.paused) return;

          const { embeds: updateEmbeds, components: updateComponents } = generateMusicPanel(currentQueue);
          await msg.edit({ embeds: updateEmbeds, components: updateComponents }).catch(() => {
            clearInterval(queue._liveInterval);
          });
        } catch {
          clearInterval(queue._liveInterval);
        }
      }, 10000);
    })
    .on("addSong", async (queue, song) => {
      const embed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("✅ เพิ่มเพลงเข้าคิวแล้ว!")
        .setDescription(`**[${song.name}](${song.url})**`)
        .setThumbnail(song.thumbnail || null);
      queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
    })
    .on("addList", async (queue, playlist) => {
      if (playlist._playlistContext) {
        queue._playlistContext = playlist._playlistContext;
      }
      const embed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle("📑 เพิ่มเพลย์ลิสต์แล้ว!")
        .setDescription(`**[${playlist.name}](${playlist.url})** (${playlist.songs.length} เพลง)`);
      queue.textChannel?.send({ embeds: [embed] }).catch(() => {});
    })
    .on("finishSong", async (queue, song) => {
      if (queue._liveInterval) clearInterval(queue._liveInterval);

      if (queue._activeMsg && song) {
        try {
          const { embeds, components } = generateFinishedPanel(song, queue._activeMsg.components);
          await queue._activeMsg.edit({ embeds, components }).catch(() => {});
        } catch {}
      }

      // ตรวจสอบระบบ Autoplay เติม 10 เพลงเมื่อเพลงจบและคิวใกล้หมด (เฉพาะเมื่อเปิด Auto)
      if (queue.autoplay && queue.songs.length <= 1) {
        handleAutoReplenish(queue, song);
      }
    })
    .on("finish", async (queue) => {
      if (queue._liveInterval) clearInterval(queue._liveInterval);
    })
    .on("ffmpegDebug", (debug) => {
      if (debug.includes("error") || debug.includes("Error") || debug.includes("Output #0")) {
        console.log("🎬 [FFmpeg]:", debug.trim());
      }
    })
    .on("error", (error, queueOrChannel) => {
      console.warn("⚠️ [DisTube Error]:", error?.message || error);
      if (queueOrChannel?._liveInterval) clearInterval(queueOrChannel._liveInterval);
      if (queueOrChannel?.textChannel) {
        queueOrChannel.textChannel
          .send({ content: `❌ เกิดข้อผิดพลาดในการเล่นเพลง: ${error?.message || "ไม่สามารถเล่นเพลงนี้ได้"}` })
          .catch(() => {});
      }
    })
    .on("empty", async (queue) => {
      if (queue._liveInterval) clearInterval(queue._liveInterval);

      if (queue._activeMsg) {
        try {
          const disabledRows = queue._activeMsg.components.map((row) =>
            new ActionRowBuilder().addComponents(
              row.components.map((comp) => ButtonBuilder.from(comp).setDisabled(true))
            )
          );

          await queue._activeMsg.edit({
            embeds: [
              new EmbedBuilder()
                .setColor(0xef4444)
                .setDescription("❌ ไม่มีคนอยู่ในห้องเสียง คิวเพลงหยุดทำงานแล้วค่ะ กด `/music play` เพื่อเล่นใหม่"),
            ],
            components: disabledRows,
          });
        } catch {}
      }
    });
}
