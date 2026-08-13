import "dotenv/config";
import { Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";

// ==========================================
// ⚙️ ตั้งค่า (Configuration)
// ==========================================
const GUILD_ID = "1533048014568951898";

// สิทธิ์พื้นฐานสำหรับสมาชิกทั่วไป (อ่านได้ พิมพ์ได้ ส่งรูปได้ ไม่มีสิทธิ์จัดการใดๆ)
const BASIC_MEMBER_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.UseExternalEmojis,
];

// รายการยศทั้งหมดที่ออกแบบตามสไตล์คณะละครสัตว์
const SERVER_ROLES = [

  // ----------------------------------------------------
  // ♠️♥️♦️♣️ 2. ยศประจำ 4 บ้าน
  // ----------------------------------------------------
  {
    name: "𓆩♠️ | 𝕾𝖕𝖆𝖉𝖊 • ภาคีโพธิดำ | ♠️𓆪",
    color: "#34495E", // สีกรมท่าเข้ม/ดำขลับ
    hoist: true,
    permissions: BASIC_MEMBER_PERMISSIONS,
    reason: "ยศสมาชิกบ้านโพธิดำ",
  },
  {
    name: "𓆩♥️ | 𝕳𝖊𝖆𝖗𝖙 • ภาคีโพธิแดง | ♥️𓆪",
    color: "#E74C3C", // สีแดงกำมะหยี่
    hoist: true,
    permissions: BASIC_MEMBER_PERMISSIONS,
    reason: "ยศสมาชิกบ้านโพธิแดง",
  },
  {
    name: "𓆩♦️ | 𝕯𝖎𝖆𝖒𝖔𝖓𝖉 • ภาคีข้าวหลามตัด | ♦️𓆪",
    color: "#F39C12", // สีส้มอำพัน/ทองสว่าง
    hoist: true,
    permissions: BASIC_MEMBER_PERMISSIONS,
    reason: "ยศสมาชิกบ้านข้าวหลามตัด",
  },
  {
    name: "𓆩♣️ | 𝕮𝖑𝖚𝖇 • ภาคีดอกจิก | ♣️𓆪",
    color: "#1ABC9C", // สีเขียวมรกต/ทีล
    hoist: true,
    permissions: BASIC_MEMBER_PERMISSIONS,
    reason: "ยศสมาชิกบ้านดอกจิก",
  },

  // ----------------------------------------------------
  // 👥 3. ยศสถานะสมาชิก (รับกฎแล้ว)
  // ----------------------------------------------------
  {
    name: "𓆩🍷 | 𝕬𝖉𝖚𝖑𝖙 • สมาชิกผู้ใหญ่ | 🍷𓆪",
    color: "#9B59B6", // สีม่วงเข้ม (สำหรับผู้ใหญ่ 18+)
    hoist: true,
    permissions: BASIC_MEMBER_PERMISSIONS,
    reason: "ยศสมาชิกที่รับกฎแล้ว (อายุ 18+ เข้าห้อง NSFW ได้)",
  },
  {
    name: "𓆩🎈 | 𝕵𝖚𝖓𝖎𝖔𝖗 • ผู้ชมรุ่นเยาว์ | 🎈𓆪",
    color: "#74B9FF", // สีฟ้าสดใส (สำหรับเด็ก/อายุต่ำกว่า 18)
    hoist: true,
    permissions: BASIC_MEMBER_PERMISSIONS,
    reason: "ยศสมาชิกที่รับกฎแล้ว (อายุต่ำกว่า 18 ปี)",
  },

  // ----------------------------------------------------
  // 🎟️ 4. ยศคนเข้าใหม่ (ยังไม่ได้รับกฎ)
  // ----------------------------------------------------
  {
    name: "𓆩🎟️ | 𝕹𝖊𝖜𝖈𝖔𝖒𝖊𝖗 • ผู้มาเยือน | 🎟️𓆪",
    color: "#95A5A6", // สีเทา (ยังไม่ยืนยัน)
    hoist: false,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      // ยังพิมพ์ไม่ได้จนกว่าจะกดยอมรับกฎ
    ],
    reason: "ยศเริ่มต้นสำหรับผู้ที่เพิ่งเข้าเซิร์ฟเวอร์",
  },
];

// ==========================================
// 🚀 ฟังก์ชันสร้างยศ (ปิดการรันไว้)
// ==========================================
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  console.log(`🤖 เข้าสู่ระบบด้วยบอท: ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) {
    console.error(`❌ ไม่พบเซิร์ฟเวอร์สำหรับ GUILD_ID: ${GUILD_ID}`);
    process.exit(1);
  }

  console.log(`🏰 กำลังเตรียมสร้างยศให้เซิร์ฟเวอร์: "${guild.name}"...`);

  try {
    for (const roleData of SERVER_ROLES) {
      // ตรวจสอบว่ามียศชื่อนี้อยู่แล้วหรือไม่ เพื่อไม่ให้สร้างซ้ำ
      const existingRole = guild.roles.cache.find((r) => r.name === roleData.name);
      if (existingRole) {
        console.log(`⚠️ มียศ "${roleData.name}" อยู่แล้ว (ข้ามการสร้าง)`);
        continue;
      }

      const createdRole = await guild.roles.create({
        name: roleData.name,
        color: roleData.color,
        hoist: roleData.hoist,
        permissions: roleData.permissions,
        reason: roleData.reason,
      });

      console.log(`✅ สร้างยศสำเร็จ: ${createdRole.name} (สี: ${roleData.color})`);
    }

    console.log("\n🎉 สร้างยศทั้งหมดเรียบร้อยแล้วค่ะ!");
  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการสร้างยศ:", err);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("❌ ไม่พบ DISCORD_TOKEN ใน .env");
  process.exit(1);
}

client.login(token);
