import {
  Client,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} from "discord.js";
import "dotenv/config";
import fs from "fs";
import path from "path";
import sharp from "sharp";

// ต้องเพิ่ม GuildMessages + MessageContent เพื่ออ่านข้อความ/แนบไฟล์
// ต้องเพิ่ม GuildMembers เพื่อรับ event ตอนมีคนเข้าเซิร์ฟเวอร์ใหม่ (guildMemberAdd)
// อย่าลืมเปิด "Message Content Intent" และ "Server Members Intent" ที่ Discord Developer Portal ด้วย!
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const pendingVerifications = new Map();

// ===== ระบบเก็บเซ็ตรูปภาพ =====
const IMAGE_SETS_FILE = "./imageSets.json";
const IMAGE_STORAGE_DIR = "./imageStorage";
let imageSets = {};

if (fs.existsSync(IMAGE_SETS_FILE)) {
  try {
    imageSets = JSON.parse(fs.readFileSync(IMAGE_SETS_FILE, "utf-8"));
  } catch (err) {
    console.error("⚠️ อ่านไฟล์ imageSets.json ไม่ได้:", err);
  }
}

if (!fs.existsSync(IMAGE_STORAGE_DIR)) {
  fs.mkdirSync(IMAGE_STORAGE_DIR, { recursive: true });
}

function saveImageSets() {
  fs.writeFileSync(IMAGE_SETS_FILE, JSON.stringify(imageSets, null, 2));
}

// กันชื่อเซ็ตมีอักขระที่ใช้เป็นชื่อโฟลเดอร์ไม่ได้
function sanitizeFolderName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

// โหลดรูปจาก URL แล้วแปลงเป็น .webp เก็บไว้ที่ destPath
async function downloadAndConvertToWebp(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`โหลดรูปไม่สำเร็จ (HTTP ${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await sharp(buffer).webp({ quality: 90 }).toFile(destPath);
}

client.once("ready", async () => {
  console.log(`🤖 Bot สำหรับจัดการยศรันแล้ว! (${client.user.tag})`);

  // ลงทะเบียน slash command /view แบบผูกกับ guild เดียว -> ขึ้นทันที (ไม่ต้องรอเป็นชม.เหมือน global)
  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);

  if (!guild) {
    console.error(`⚠️ ไม่พบ guild ID ${process.env.DISCORD_GUILD_ID} (เช็คว่าบอทอยู่ในเซิร์ฟเวอร์นี้ และ DISCORD_GUILD_ID ใน .env ถูกต้องหรือไม่)`);
    return;
  }

  await guild.commands.create({
    name: "view",
    description: "ดึงรูปจากเซ็ตที่เคยบันทึกไว้กลับมาส่งใหม่",
    options: [
      {
        name: "name",
        description: "ชื่อเซ็ตรูป เช่น 【รูปเซ็ตที่1】",
        type: 3, // STRING
        required: true,
        autocomplete: true,
      },
    ],
  });

  await guild.commands.create({
    name: "add-image",
    description: "สร้างเซ็ตรูปภาพใหม่ (เฉพาะแอดมิน)",
    options: [
      {
        name: "name",
        description: "ชื่อเซ็ตรูป เช่น รูปเซ็ตที่1",
        type: 3, // STRING
        required: true,
      },
    ],
  });

  await guild.commands.create({
    name: "remove-image",
    description: "ลบเซ็ตรูปภาพออกจากระบบ (เฉพาะแอดมิน)",
    options: [
      {
        name: "name",
        description: "ชื่อเซ็ตรูปภาพที่ต้องการลบ เช่น รูปเซ็ตที่1",
        type: 3, // STRING
        required: true,
        autocomplete: true,
      },
    ],
  });
});

// (ลบระบบดักข้อความอัตโนมัติออกแล้ว ใช้คำสั่ง /add-image แทน)

// แจ้งเตือนแอดมินทันทีที่มีคนเข้าเซิร์ฟเวอร์ใหม่ (ก่อนยืนยันตัวตน)
client.on("guildMemberAdd", async (member) => {
  // 1. ให้ยศคนเข้าใหม่ทันที (ยศนี้จะถูกถอดออกอัตโนมัติตอนยืนยันตัวตนสำเร็จ)
  const roleNewcomerId = process.env.ROLE_NEWCOMER_ID;
  if (roleNewcomerId) {
    await member.roles.add(roleNewcomerId).catch((err) =>
      console.error("⚠️ ให้ยศคนเข้าใหม่ไม่สำเร็จ:", err)
    );
  }

  // 2. แจ้งเตือนแอดมินที่ห้อง CHANNEL_WELCOME_ID
  const channelWelcomeId = process.env.CHANNEL_WELCOME_ID;
  if (!channelWelcomeId) return;

  try {
    const channel = await member.guild.channels.fetch(channelWelcomeId);
    if (!channel) return;

    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🚪 มีสมาชิกใหม่เข้าเซิร์ฟเวอร์`)
      .setDescription(
        `${member} เข้าร่วมเซิร์ฟเวอร์แล้วครับ (ID: ${member.id})\n\n` +
        `**ลำดับที่เข้า:** สมาชิกคนที่ ${member.guild.memberCount}\n` +
        `**เข้าร่วมเมื่อ:** ${new Date().toLocaleString("th-TH")}\n` +
        `**สร้างบัญชีเมื่อ:** ${member.user.createdAt.toLocaleDateString("th-TH")}`
      )
      .setColor(0xffffff)
      .setThumbnail(member.user.displayAvatarURL());

    await channel.send({ embeds: [welcomeEmbed] });
  } catch (err) {
    console.error("⚠️ ส่งแจ้งเตือนสมาชิกใหม่ไม่สำเร็จ:", err);
  }
});

client.on("interactionCreate", async (interaction) => {

  // Autocomplete สำหรับ /view และ /remove-image -> แสดงรายชื่อเซ็ตที่บันทึกไว้
  if (interaction.isAutocomplete() && (interaction.commandName === "view" || interaction.commandName === "remove-image")) {
    const focused = interaction.options.getFocused();
    const choices = Object.keys(imageSets)
      .filter((name) => name.includes(focused))
      .slice(0, 25)
      .map((name) => ({ name, value: name }));
    await interaction.respond(choices);
    return;
  }

  // คำสั่ง /add-image -> สร้างเซ็ตรูปใหม่ (เฉพาะแอดมิน) โดยรอรับรูปในข้อความถัดไป
  if (interaction.isChatInputCommand() && interaction.commandName === "add-image") {
    const adminRoleId = process.env.ROLE_ADMIN_ID;
    const member = interaction.member;

    if (!adminRoleId || !member.roles.cache.has(adminRoleId)) {
      await interaction.reply({ content: "❌ คำสั่งนี้ใช้ได้เฉพาะแอดมินเท่านั้น", ephemeral: true });
      return;
    }

    const rawName = interaction.options.getString("name").trim();
    const setName = rawName.startsWith("【") && rawName.endsWith("】") ? rawName : `【${rawName}】`;

    // ตรวจสอบชื่อเซ็ตซ้ำ
    if (imageSets[setName]) {
      await interaction.reply({
        content: `❌ มีเซ็ตรูปภาพชื่อ ${setName} อยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น หรือลบเซ็ตเดิมก่อนด้วยคำสั่ง /remove-image`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `📸 กำลังรอรับรูปสำหรับเซ็ต ${setName}\nกรุณาส่งรูปภาพ (แนบได้หลายรูปในข้อความเดียว) ในห้องนี้ ภายใน 60 วินาที`,
      ephemeral: true,
    });

    const collector = interaction.channel.createMessageCollector({
      filter: (m) => m.author.id === interaction.user.id && m.attachments.size > 0,
      max: 1,
      time: 60000,
    });

    collector.on("collect", async (msg) => {
      const setDir = path.join(IMAGE_STORAGE_DIR, sanitizeFolderName(setName));
      if (!fs.existsSync(setDir)) fs.mkdirSync(setDir, { recursive: true });

      try {
        const attachments = [...msg.attachments.values()];
        const savedFiles = [];

        for (let i = 0; i < attachments.length; i++) {
          const destPath = path.join(setDir, `${i + 1}.webp`);
          await downloadAndConvertToWebp(attachments[i].url, destPath);
          savedFiles.push(destPath);
        }

        imageSets[setName] = {
          channelId: msg.channel.id,
          messageId: msg.id,
          savedBy: msg.author.id,
          savedAt: Date.now(),
          files: savedFiles,
        };
        saveImageSets();

        await msg.react("✅").catch(() => { });
        await interaction.followUp({
          content: `✅ บันทึกเซ็ต ${setName} เรียบร้อย (${savedFiles.length} รูป)`,
          ephemeral: true,
        });
      } catch (err) {
        console.error("⚠️ บันทึกเซ็ตรูปไม่สำเร็จ:", err);
        await interaction.followUp({
          content: `❌ บันทึกรูปไม่สำเร็จ: ${err.message}`,
          ephemeral: true,
        });
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        interaction
          .followUp({
            content: `⏰ หมดเวลา ไม่ได้รับรูปภาพ ยกเลิกการสร้างเซ็ต ${setName}`,
            ephemeral: true,
          })
          .catch(() => { });
      }
    });

    return;
  }

  // คำสั่ง /view ส่งรูปที่เก็บไว้ในเครื่องกลับมา
  if (interaction.isChatInputCommand() && interaction.commandName === "view") {
    const setName = interaction.options.getString("name");
    const data = imageSets[setName];

    if (!data) {
      await interaction.reply({
        content: `❌ ไม่พบเซ็ตรูปชื่อ ${setName}`,
        ephemeral: true,
      });
      return;
    }

    const missingFiles = data.files.filter((f) => !fs.existsSync(f));
    if (missingFiles.length > 0) {
      await interaction.reply({
        content: `❌ ไฟล์รูปบางไฟล์ในเซ็ตนี้หายไปจากเครื่อง ส่งไม่ได้ครบ กรุณาแจ้งแอดมิน`,
        ephemeral: true,
      });
      return;
    }

    const spoilerFiles = data.files.map((file) => new AttachmentBuilder(file, { name: path.basename(file) }).setSpoiler(true));
    await interaction.reply({ content: setName, files: spoilerFiles });
    return;
  }

  // คำสั่ง /remove-image -> ลบเซ็ตรูปภาพออกจากระบบ (เฉพาะแอดมิน)
  if (interaction.isChatInputCommand() && interaction.commandName === "remove-image") {
    const adminRoleId = process.env.ROLE_ADMIN_ID;
    const member = interaction.member;

    if (!adminRoleId || !member.roles.cache.has(adminRoleId)) {
      await interaction.reply({ content: "❌ คำสั่งนี้ใช้ได้เฉพาะแอดมินเท่านั้น", ephemeral: true });
      return;
    }

    const rawName = interaction.options.getString("name").trim();
    const setName = rawName.startsWith("【") && rawName.endsWith("】") ? rawName : `【${rawName}】`;
    const data = imageSets[setName];

    if (!data) {
      await interaction.reply({
        content: `❌ ไม่พบเซ็ตรูปชื่อ ${setName}`,
        ephemeral: true,
      });
      return;
    }

    const setDir = path.join(IMAGE_STORAGE_DIR, sanitizeFolderName(setName));
    try {
      if (fs.existsSync(setDir)) {
        fs.rmSync(setDir, { recursive: true, force: true });
      }

      delete imageSets[setName];
      saveImageSets();

      await interaction.reply({
        content: `✅ ลบเซ็ตรูปภาพ ${setName} และรูปทั้งหมดออกจากระบบเรียบร้อยแล้ว`,
        ephemeral: true,
      });
    } catch (err) {
      console.error("⚠️ ลบเซ็ตรูปไม่สำเร็จ:", err);
      await interaction.reply({
        content: `❌ ลบเซ็ตรูปไม่สำเร็จ: ${err.message}`,
        ephemeral: true,
      });
    }
    return;
  }

  if (interaction.isButton() && interaction.customId === "start_verify") {
    const modal = new ModalBuilder()
      .setCustomId("verify_modal")
      .setTitle("ฟอร์มยืนยันตัวตน");

    const nameInput = new TextInputBuilder()
      .setCustomId("verify_name")
      .setLabel("ชื่อที่อยากให้เรียก")
      .setPlaceholder("ระบุชื่อเล่นหรือชื่อเรียกของคุณ")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const birthdayInput = new TextInputBuilder()
      .setCustomId("verify_birthday")
      .setLabel("วันเดือนปีเกิด (DD/MM/YYYY) *ไม่เผยแพร่*")
      .setPlaceholder("ตัวอย่าง: 15/08/2005 (ข้อมูลจะถูกเก็บเป็นความลับสูงสุด)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const row1 = new ActionRowBuilder().addComponents(nameInput);
    const row2 = new ActionRowBuilder().addComponents(birthdayInput);

    modal.addComponents(row1, row2);
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === "verify_modal") {
    // ต้อง defer ทันทีเป็นอันดับแรกสุด ก่อน await อื่นๆ
    // เพราะ Discord ให้เวลาตอบ interaction แค่ 3 วิ ถ้า guild.members.fetch ช้ากว่านั้น
    // token จะหมดอายุ -> เกิด "Unknown interaction" error
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const name = interaction.fields.getTextInputValue("verify_name");
    const birthday = interaction.fields.getTextInputValue("verify_birthday")?.trim();

    const guild = interaction.guild;

    const roleDekId = process.env.ROLE_DEK_ID;
    const roleNewcomerId = process.env.ROLE_NEWCOMER_ID;
    const channelGeneralId = process.env.CHANNEL_GENERAL_ID;
    const channelVerifyAdminId = process.env.CHANNEL_VERIFY_ADMIN_ID;

    try {
      const member = await guild.members.fetch(userId);

      // 1. ให้ยศเด็กทันทีทุกกรณี (และถอนยศคนมาใหม่ออก)
      if (roleDekId) await member.roles.add(roleDekId);
      if (roleNewcomerId) await member.roles.remove(roleNewcomerId);

      // 2. ส่งการต้อนรับเข้าห้องพูดคุยทั่วไปเสมอ (ไม่บอกวันเกิด ไม่บอกลำดับสมาชิก ตามรูปตัวอย่าง)
      const generalChannel = await guild.channels.fetch(channelGeneralId);
      if (generalChannel) {
        const welcomeEmbed = new EmbedBuilder()
          .setTitle(`อ♡ธ ยินดีต้อนรับสู่ 【🌈│เรนโบว์จ๋า พี่มาแล้ว│🍭】 ครับ อ♡ธ`)
          .setDescription(
            `สวัสดีครับ ยินดีต้อนรับ ${member} ชื่อ : (${name})\n\n` +
            `เข้าร่วมเมื่อ • ${new Date().toLocaleDateString("th-TH")}`
          )
          .setColor(0xffffff)
          .setThumbnail(member.displayAvatarURL());

        await generalChannel.send({ embeds: [welcomeEmbed] });
      }

      // เคส 1: กรอกเฉพาะชื่ออย่างเดียว (ได้รับยศเด็กทันที จบขั้นตอน)
      if (!birthday) {
        await interaction.editReply({ content: "✅ ยืนยันตัวตนเรียบร้อยแล้วครับ! ขอให้สนุกกับการพูดคุยครับ" });
      }
      // เคส 2: กรอกชื่อ + วันเกิด (ได้รับยศเด็กก่อน และส่งให้แอดมินพิจารณาให้ยศคนโตแทน)
      else {
        const verifyAdminChannel = await guild.channels.fetch(channelVerifyAdminId);

        if (!verifyAdminChannel) {
          await interaction.editReply({ content: "✅ กรุณาแจ้งแอดมินโดยตรงครับ" });
          return;
        }

        const requestKey = `verify_${userId}_${Date.now()}`;

        pendingVerifications.set(requestKey, {
          userId,
          name,
          birthday,
        });

        const adminEmbed = new EmbedBuilder()
          .setTitle("🚨 คำขออนุมัติยศ")
          .setDescription(
            `**ผู้ยื่นคำขอ:** ${interaction.user} (ID: ${userId})\n` +
            `**ชื่อที่ระบุ:** ${name}\n` +
            `**วันเดือนปีเกิด:** ${birthday}\n\n`
          )
          .setColor(0xffffff)
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_${requestKey}`)
            .setLabel("อนุมัติ ✅")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_${requestKey}`)
            .setLabel("ปฏิเสธ ❌")
            .setStyle(ButtonStyle.Danger)
        );

        await verifyAdminChannel.send({ embeds: [adminEmbed], components: [row] });

        await interaction.editReply({ content: "✅ ยืนยันตัวตนเรียบร้อยแล้วครับ! ขอให้สนุกกับการพูดคุยครับ" });
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: "❌ เกิดข้อผิดพลาดในการยืนยันตัวตน กรุณาติดต่อแอดมินที่ห้องแจ้งปัญหาครับ" });
    }
  }

  if (interaction.isButton() && (interaction.customId.startsWith("approve_") || interaction.customId.startsWith("reject_"))) {
    const isApprove = interaction.customId.startsWith("approve_");
    const requestKey = interaction.customId.replace(isApprove ? "approve_" : "reject_", "");

    const requestData = pendingVerifications.get(requestKey);

    if (!requestData) {
      await interaction.reply({ content: "❌ ไม่พบข้อมูลคำขอนี้ หรืออาจถูกดำเนินการไปแล้ว", ephemeral: true });
      return;
    }

    await interaction.deferUpdate();

    const { userId } = requestData;
    const guild = interaction.guild;

    try {
      const member = await guild.members.fetch(userId);

      if (isApprove) {
        // อนุมัติยศคนโต: ลบยศเด็กออก และแอดสิทธิ์ยศคนโตเข้าไปแทน
        const roleKhontoId = process.env.ROLE_KHONTO_ID;
        const roleDekId = process.env.ROLE_DEK_ID;

        if (roleKhontoId) await member.roles.add(roleKhontoId);
        if (roleDekId) await member.roles.remove(roleDekId);

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setTitle("✅ อนุมัติ")
          .setColor(0x2ecc71);

        await interaction.message.edit({ embeds: [embed], components: [] });
      } else {
        // ปฏิเสธ: ไม่ทำอะไรเพิ่ม (เพราะได้ยศเด็กไปตั้งแต่แรกแล้ว)
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setTitle("❌ ปฏิเสธ")
          .setColor(0xe74c3c);

        await interaction.message.edit({ embeds: [embed], components: [] });
      }

      pendingVerifications.delete(requestKey);

    } catch (err) {
      console.error(err);
      await interaction.followUp({ content: `❌ ไม่สามารถดำเนินการได้ (ผู้ใช้อาจออกจากเซิร์ฟเวอร์แล้ว)`, ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);