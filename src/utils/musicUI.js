import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

/**
 * สร้าง Embed และ Components สำหรับแผงควบคุมเพลง
 * @param {import('distube').Queue} queue 
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
export function generateMusicPanel(queue) {
  if (!queue || !queue.songs.length) {
    return {
      embeds: [new EmbedBuilder().setColor(0xef4444).setDescription("❌ ตอนนี้ไม่มีเพลงกำลังเล่นอยู่แล้วค่ะ")],
      components: [],
    };
  }

  const song = queue.songs[0];
  const current = queue.currentTime;
  const total = song.duration;
  const progress = total > 0 ? makeProgressBar(current, total) : "🔴 ถ่ายทอดสด (LIVE)";

  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setDescription(`**[${song.name}](${song.url})**`)
    .addFields({ name: "📊 ความคืบหน้า", value: progress })
    .setThumbnail(song.thumbnail || null)
    .setTimestamp();

  if (song.uploader?.name) embed.setAuthor({ name: `📺 ${song.uploader.name}` });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("music_skip").setEmoji("⏭️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_pause")
      .setEmoji(queue.paused ? "▶️" : "⏸️")
      .setStyle(queue.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_leave").setEmoji("⏹️").setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("music_loop")
      .setEmoji("🔁")
      .setStyle(queue.repeatMode > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_mute")
      .setEmoji(queue.volume === 0 ? "🔇" : "🔊")
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("music_autoplay")
      .setLabel("📻 Auto")
      .setStyle(queue.autoplay ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_queue_btn").setLabel("📋 คิวเพลง").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("music_add_modal").setLabel("➕ เพิ่มเพลง").setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row1, row2] };
}

/**
 * สร้าง Embed และ Components เมื่อเพลงเล่นจบแล้ว (สีเขียว success และปิดปุ่ม)
 * @param {import('distube').Song} song 
 * @param {ActionRowBuilder[]} [existingComponents]
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
export function generateFinishedPanel(song, existingComponents = []) {
  const total = song?.duration || 0;
  const progress = total > 0
    ? `\`${fmt(total)}\` ${"▓".repeat(15)} \`${fmt(total)}\``
    : "🔴 สิ้นสุดการถ่ายทอดสด";

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setDescription(`**[${song?.name || "ไม่ทราบชื่อเพลง"}](${song?.url || ""})**`)
    .addFields({ name: "📊 ความคืบหน้า (เล่นจบแล้ว)", value: progress })
    .setThumbnail(song?.thumbnail || null)
    .setTimestamp();

  if (song?.uploader?.name) embed.setAuthor({ name: `📺 ${song.uploader.name}` });

  const disabledComponents = (existingComponents || []).map((row) => {
    return new ActionRowBuilder().addComponents(
      (row.components || []).map((comp) => ButtonBuilder.from(comp).setDisabled(true))
    );
  });

  return { embeds: [embed], components: disabledComponents };
}

export function makeProgressBar(current, total) {
  const size = 15;
  const progress = Math.min(Math.round((current / total) * size), size);
  const bar = "▓".repeat(progress) + "░".repeat(size - progress);
  return `\`${fmt(current)}\` ${bar} \`${fmt(total)}\``;
}

export function fmt(sec) {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}
