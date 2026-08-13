import "dotenv/config";
import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from "discord.js";

// ==========================================
// ⚙️ ตั้งค่า (Configuration)
// ==========================================
const GUILD_ID = "1533048014568951898";

// แมปหมวดหมู่ประจำบ้านกับยศหัวหน้าบ้าน
const HOUSE_CATEGORY_CONFIG = [
  {
    categoryName: "「♠️ โรงเต็นท์โพธิดำ」",
    leaderRoleName: "𓆩👑♠️ | 𝕾𝖕𝖆𝖉𝖊 𝕷𝖊𝖆𝖉𝖊𝖗 • ผู้นำโพธิดำ | ♠️👑𓆪",
  },
  {
    categoryName: "「♥️ โรงเต็นท์โพธิแดง」",
    leaderRoleName: "𓆩👑♥️ | 𝕳𝖊𝖆𝖗𝖙 𝕷𝖊𝖆𝖉𝖊𝖗 • ผู้นำโพธิแดง | ♥️👑𓆪",
  },
  {
    categoryName: "「♦️ โรงเต็นท์ข้าวหลามตัด」",
    leaderRoleName: "𓆩👑♦️ | 𝕯𝖎𝖆𝖒𝖔𝖓𝖉 𝕷𝖊𝖆𝖉𝖊𝖗 • ผู้นำข้าวหลามตัด | ♦️👑𓆪",
  },
  {
    categoryName: "「♣️ โรงเต็นท์ดอกจิก」",
    leaderRoleName: "𓆩👑♣️ | 𝕮𝖑𝖚𝖇 𝕷𝖊𝖆𝖉𝖊𝖗 • ผู้นำดอกจิก | ♣️👑𓆪",
  },
];

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

  console.log(`🏰 กำลังอัปเดตสิทธิ์หมวดหมู่ประจำบ้านในเซิร์ฟเวอร์: "${guild.name}"...`);

  try {
    await guild.roles.fetch();
    const channels = await guild.channels.fetch();

    const directorRole = guild.roles.cache.find((r) => r.name.includes("Director"));

    for (const item of HOUSE_CATEGORY_CONFIG) {
      const category = channels.find((ch) => ch && ch.type === ChannelType.GuildCategory && ch.name === item.categoryName);
      const leaderRole = guild.roles.cache.find((r) => r.name === item.leaderRoleName);

      if (!category) {
        console.warn(`⚠️ ไม่พบหมวดหมู่: "${item.categoryName}"`);
        continue;
      }

      if (!leaderRole) {
        console.warn(`⚠️ ไม่พบยศ: "${item.leaderRoleName}"`);
        continue;
      }

      console.log(`\n🔒 กำลังตั้งค่าสิทธิ์ให้หมวดหมู่ "${category.name}"...`);

      const overwrites = [
        // 1. ปิดไม่ให้ @everyone มองเห็นหมวดหมู่นี้
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        // 2. ให้หัวหน้าบ้านมีสิทธิ์เต็มในการจัดการหมวดหมู่นี้ (สร้างห้อง, ลบห้อง, จัดการข้อความ)
        {
          id: leaderRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ManageChannels, // สร้างห้อง / ลบห้อง / แก้ไขห้องในหมวดหมู่นี้ได้เอง
            PermissionFlagsBits.ManageMessages, // จัดการข้อความ ลบ/ปักหมุด
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.UseExternalEmojis,
            PermissionFlagsBits.MentionEveryone,
          ],
        },
      ];

      // 3. ให้ Director เข้าถึงและจัดการได้ด้วย (ถ้ามี)
      if (directorRole) {
        overwrites.push({
          id: directorRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        });
      }

      // บันทึกสิทธิ์ที่ระดับ Category
      await category.permissionOverwrites.set(overwrites);

      // ซิงค์สิทธิ์ให้ห้องทั้งหมดที่อยู่ภายใต้ Category นี้
      const childChannels = channels.filter((ch) => ch && ch.parentId === category.id);
      for (const [, child] of childChannels) {
        await child.lockPermissions().catch((e) => console.warn(`ซิงค์ห้อง ${child.name} ไม่ได้:`, e.message));
        console.log(`  └─ 🔄 ซิงค์สิทธิ์ห้อง "${child.name}" เข้ากับหมวดหมู่สำเร็จ`);
      }

      console.log(`✅ ตั้งค่าหมวดหมู่ "${category.name}" สำเร็จ -> สิทธิ์เต็มสำหรับ "${leaderRole.name}"`);
    }

    console.log("\n🎉 อัปเดตสิทธิ์หมวดหมู่ประจำบ้านทั้ง 4 หลังเรียบร้อยสมบูรณ์แล้วค่ะ!");
  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาด:", err);
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
