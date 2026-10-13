import { MessageFlags, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";
import { respondToInteraction } from "../utils/helper.js";
import { generateMusicPanel, fmt } from "../utils/musicUI.js";
import { handleAutoReplenish } from "../handlers/disTubeHandler.js";

export async function handleMusicCommand(interaction) {
  const { guild, member, channel, client } = interaction;
  if (!guild) {
    await respondToInteraction(interaction, {
      content: "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้นค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const voiceChannel = member?.voice?.channel;

  // 1. เล่นเพลง หรือ เพิ่มเข้าคิว
  if (subcommand === "play" || subcommand === "add") {
    if (!voiceChannel) {
      await respondToInteraction(interaction, {
        content: "❌ คุณต้องอยู่ในห้องพูดคุย (Voice Channel) ก่อนจึงจะสั่งเล่นเพลงได้ค่ะ",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const query = interaction.options.getString("query");
    await respondToInteraction(interaction, {
      content: `🔍 กำลังค้นหาและเตรียมเล่น: **${query}**...`,
      flags: MessageFlags.Ephemeral,
    });

    try {
      await client.distube.play(voiceChannel, query, {
        textChannel: channel,
        member,
      });
    } catch (err) {
      console.warn("DisTube play error:", err?.message || err);
      await respondToInteraction(interaction, {
        content: `❌ ไม่สามารถเล่นเพลงได้: ${err?.message || "เกิดข้อผิดพลาดในการดึงข้อมูลเพลง"}`,
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // สำหรับคำสั่งควบคุมคิว ต้องมีคิวที่กำลังเล่นอยู่
  const queue = client.distube.getQueue(guild.id);

  if (subcommand === "show") {
    if (!queue) {
      await respondToInteraction(interaction, {
        content: "❌ ไม่มีเพลงที่กำลังเล่นอยู่ตอนนี้นะคะ",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { embeds, components } = generateMusicPanel(queue);
    const msg = await channel.send({ embeds, components }).catch(() => null);
    if (msg) {
      queue._activeMessageId = msg.id;
      queue._activeMsg = msg;
    }
    await respondToInteraction(interaction, {
      content: "✅ เรียกแผงควบคุมเพลงใหม่เรียบร้อยแล้วค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!queue) {
    await respondToInteraction(interaction, {
      content: "❌ ไม่มีเพลงที่กำลังเล่นอยู่ในเซิร์ฟเวอร์ขณะนี้ค่ะ",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (subcommand === "queue") {
    const qMsg = queue.songs
      .slice(0, 10)
      .map((s, i) => `${i === 0 ? "▶️" : `${i}.`} **[${s.name}](${s.url})** (\`${fmt(s.duration)}\`)`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle("📋 รายการคิวเพลงปัจจุบัน")
      .setDescription(
        `${qMsg}\n${queue.songs.length > 10 ? `\n...และยังมีอีก ${queue.songs.length - 10} เพลงในคิว` : ""}`
      )
      .setFooter({ text: `เพลงทั้งหมด ${queue.songs.length} เพลง | ระดับเสียง: ${queue.volume}%` });

    await respondToInteraction(interaction, {
      embeds: [embed],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (subcommand === "nowplaying") {
    const { embeds, components } = generateMusicPanel(queue);
    await respondToInteraction(interaction, {
      embeds,
      components,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (subcommand === "skip") {
    try {
      await queue.skip().catch(() => queue.stop());
      await respondToInteraction(interaction, { content: "⏭️ ข้ามเพลงเรียบร้อยแล้วค่ะ" });
    } catch {
      await respondToInteraction(interaction, { content: "❌ ไม่สามารถข้ามเพลงได้ค่ะ" });
    }
    return;
  }

  if (subcommand === "previous") {
    try {
      await queue.previous();
      await respondToInteraction(interaction, { content: "⏮️ ย้อนกลับไปเพลงก่อนหน้าแล้วค่ะ" });
    } catch {
      await respondToInteraction(interaction, { content: "❌ ไม่มีเพลงก่อนหน้านี้ในประวัติค่ะ" });
    }
    return;
  }

  if (subcommand === "pause") {
    if (queue.paused) {
      await respondToInteraction(interaction, { content: "⏸️ เพลงหยุดชั่วคราวอยู่แล้วค่ะ" });
    } else {
      queue.pause();
      await respondToInteraction(interaction, { content: "⏸️ พักการเล่นเพลงชั่วคราวแล้วค่ะ" });
    }
    return;
  }

  if (subcommand === "resume") {
    if (!queue.paused) {
      await respondToInteraction(interaction, { content: "▶️ เพลงกำลังเล่นอยู่แล้วค่ะ" });
    } else {
      queue.resume();
      await respondToInteraction(interaction, { content: "▶️ เล่นเพลงต่อเรียบร้อยแล้วค่ะ" });
    }
    return;
  }

  if (subcommand === "leave") {
    queue.stop();
    await respondToInteraction(interaction, { content: "⏹️ สั่งหยุดเพลงและออกจากห้องเสียงเรียบร้อยแล้วค่ะ" });
    return;
  }

  if (subcommand === "volume") {
    const percent = interaction.options.getInteger("percent");
    queue.setVolume(percent);
    await respondToInteraction(interaction, { content: `🔊 ปรับระดับเสียงเป็น **${percent}%** เรียบร้อยแล้วค่ะ` });
    return;
  }

  if (subcommand === "loop") {
    const mode = parseInt(interaction.options.getString("mode"));
    queue.setRepeatMode(mode);
    const modeLabels = ["ปิดการวนซ้ำ", "วนซ้ำเพลงเดียว (Track)", "วนซ้ำทั้งคิว (Queue)"];
    await respondToInteraction(interaction, { content: `🔁 ตั้งค่าโหมดวนซ้ำเป็น: **${modeLabels[mode] || mode}**` });
    return;
  }

  if (subcommand === "shuffle") {
    await queue.shuffle();
    await respondToInteraction(interaction, { content: "🔀 สลับลำดับคิวเพลงแบบสุ่มเรียบร้อยแล้วค่ะ" });
    return;
  }

  if (subcommand === "seek") {
    const seconds = interaction.options.getInteger("seconds");
    queue.seek(seconds);
    await respondToInteraction(interaction, { content: `⏩ ข้ามไปยังวินาทีที่ **${seconds}** เรียบร้อยแล้วค่ะ` });
    return;
  }

  if (subcommand === "clear") {
    queue.songs.splice(1);
    await respondToInteraction(interaction, { content: "🧹 ล้างคิวเพลงที่ต่อแถวทั้งหมดเรียบร้อยแล้วค่ะ (กำลังเล่นเพลงปัจจุบันอยู่)" });
    return;
  }

  if (subcommand === "autoplay") {
    const state = queue.toggleAutoplay();
    if (state) handleAutoReplenish(queue, queue.songs[0]);
    await respondToInteraction(interaction, { content: `📻 ระบบ Autoplay: **${state ? "เปิดใช้งาน (ON) - เติม 10 เพลงอัตโนมัติ" : "ปิดใช้งาน (OFF)"}**` });
    return;
  }
}

/**
 * ฟังก์ชันจัดการ Button Interactions แผงควบคุมเพลง (music_*)
 */
export async function handleMusicButtonInteraction(interaction) {
  const { customId, guild, member, client } = interaction;

  // 1. ปุ่มเปิด Modal เพิ่มเพลง (ไม่ต้องมีคิวเพลงก็กดเปิดได้)
  if (customId === "music_add_modal") {
    const modal = new ModalBuilder()
      .setCustomId("music_add_modal_submit")
      .setTitle("➕ เพิ่มเพลงเข้าคิว");
    const input = new TextInputBuilder()
      .setCustomId("music_query_input")
      .setLabel("พิมพ์ชื่อเพลงหรือลิงก์ YouTube")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("เช่น ชื่อเพลง หรือ ลิงก์ YouTube...")
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  const queue = client.distube.getQueue(guild?.id);

  if (!queue) {
    await interaction.reply({
      content: "❌ ไม่มีคิวเพลงที่กำลังเล่นอยู่แล้วค่ะ",
      flags: [MessageFlags.Ephemeral],
    }).catch(() => {});
    return;
  }

  // ตรวจสอบห้องเสียงของผู้กดปุ่ม
  if (!member?.voice?.channel) {
    await interaction.reply({
      content: "❌ คุณต้องอยู่ในห้องพูดคุย (Voice Channel) เดียวกันเพื่อกดปุ่มควบคุมเพลงค่ะ",
      flags: [MessageFlags.Ephemeral],
    }).catch(() => {});
    return;
  }

  try {
    if (customId !== "music_queue_btn") {
      await interaction.deferUpdate().catch(() => {});
    }

    switch (customId) {
      case "music_skip":
        await queue.skip().catch(() => queue.stop());
        break;
      case "music_pause":
        queue.paused ? queue.resume() : queue.pause();
        break;
      case "music_leave":
        queue.stop();
        break;
      case "music_loop": {
        const mode = queue.repeatMode === 1 ? 0 : 1;
        queue.setRepeatMode(mode);
        break;
      }
      case "music_mute":
        queue.setVolume(queue.volume === 0 ? 50 : 0);
        break;
      case "music_autoplay": {
        const newAutoplayState = queue.toggleAutoplay();
        if (newAutoplayState) handleAutoReplenish(queue, queue.songs[0]);
        const statusText = newAutoplayState ? "✅ เปิดใช้ Autoplay แล้วค่ะ (จะเติม 10 เพลงอัตโนมัติ)" : "❌ ปิด Autoplay แล้วค่ะ";
        await interaction.followUp({ content: statusText, flags: [MessageFlags.Ephemeral] }).catch(() => {});
        break;
      }
      case "music_queue_btn": {
        const qMsg = queue.songs
          .slice(0, 10)
          .map((s, i) => `${i === 0 ? "▶️" : `${i}.`} **${s.name}**`)
          .join("\n");
        await interaction.reply({
          content: `📋 **คิวเพลงปัจจุบัน:**\n${qMsg}\n${queue.songs.length > 10 ? `...และยังมีอีก ${queue.songs.length - 10} เพลง` : ""}`,
          flags: [MessageFlags.Ephemeral],
        }).catch(() => {});
        return;
      }
    }

    // อัปเดตแผงเพลง
    const { embeds, components } = generateMusicPanel(queue);
    if (queue._activeMsg) {
      await queue._activeMsg.edit({ embeds, components }).catch(() => {});
    } else if (interaction.message) {
      await interaction.message.edit({ embeds, components }).catch(() => {});
    }
  } catch (err) {
    console.warn("Music button interaction error:", err?.message || err);
  }
}
