import "dotenv/config";
import { Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";

// ==========================================
// ⚙️ ตั้งค่า (Configuration)
// ==========================================
const GUILD_ID = "1533048014568951898";

// สิทธิ์สำหรับหัวหน้าบ้าน
const LEADER_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.MentionEveryone,
];

// รายการยศหัวหน้าบ้านทั้ง 4 บ้าน
const HOUSE_LEADER_ROLES = [
  {
    key: "spade",
    name: "𓆩👑♠️ | 𝕾𝖕𝖆𝖉𝖊 𝕷𝖊𝖆𝖉𝖊𝖗 • ผู้นำโพธิดำ | ♠️👑𓆪",
    color: "#2C3E50",
    hoist: true,
    channelName: "【🗝️】หลังม่านหัวหน้าโพธิดำ",
    reason: "ยศหัวหน้าบ้านโพธิดำ",
  },
  {
    key: "heart",
    name: "𓆩👑♥️ | 𝕳𝖊𝖆𝖗𝖙 𝕷𝖊𝖆𝖉𝖊𝖗 • ผู้นำโพธิแดง | ♥️👑𓆪",
    color: "#C0392B",
    hoist: true,
    channelName: "【🗝️】หลังม่านหัวหน้าโพธิแดง",
    reason: "ยศหัวหน้าบ้านโพธิแดง",
  },
  {
    key: "diamond",
    name: "𓆩👑♦️ | 𝕯𝖎𝖆𝖒𝖔𝖓𝖉 𝕷𝖊𝖆𝖉𝖊𝖗 • ผู้นำข้าวหลามตัด | ♦️👑𓆪",
    color: "#D35400",
    hoist: true,
    channelName: "【🗝️】หลังม่านหัวหน้าข้าวหลามตัด",
    reason: "ยศหัวหน้าบ้านข้าวหลามตัด",
  },
  {
    key: "club",
    name: "𓆩👑♣️ | 𝕮𝖑𝖚𝖇 𝕷𝖊𝖆𝖉𝖊𝖗 • ผู้นำดอกจิก | ♣️👑𓆪",
    color: "#16A085",
    hoist: true,
    channelName: "【🗝️】หลังม่านหัวหน้าดอกจิก",
    reason: "ยศหัวหน้าบ้านดอกจิก",
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

  console.log(`🏰 กำลังทำงานในเซิร์ฟเวอร์: "${guild.name}"...`);

  try {
    // โหลด Roles และ Channels ล่าสุด
    await guild.roles.fetch();
    const channels = await guild.channels.fetch();

    // ค้นหายศ Director (ถ้ามี)
    const directorRole = guild.roles.cache.find((r) => r.name.includes("Director"));

    const createdLeaderRoles = new Map();

    // 1. สร้างยศหัวหน้าบ้านทั้ง 4 บ้าน
    console.log("\n👑 กำลังสร้างยศหัวหน้าบ้านทั้ง 4...");
    for (const roleData of HOUSE_LEADER_ROLES) {
      let role = guild.roles.cache.find((r) => r.name === roleData.name);
      if (!role) {
        role = await guild.roles.create({
          name: roleData.name,
          color: roleData.color,
          hoist: roleData.hoist,
          permissions: LEADER_PERMISSIONS,
          reason: roleData.reason,
        });
        console.log(`  ✅ สร้างยศสำเร็จ: ${role.name}`);
      } else {
        console.log(`  ℹ️ มียศอยู่แล้ว: ${role.name}`);
      }
      createdLeaderRoles.set(roleData.key, role);
    }

    // 2. เซ็ตสิทธิ์ห้อง 【🗝️】หลังม่าน ให้เห็นเฉพาะเจ้าของบ้านนั้นๆ (+ Director)
    console.log("\n🔒 กำลังตั้งค่าสิทธิ์ความเป็นส่วนตัวห้อง 【🗝️】หลังม่าน แต่ละบ้าน...");
    for (const roleData of HOUSE_LEADER_ROLES) {
      const leaderRole = createdLeaderRoles.get(roleData.key);
      const targetChannel = channels.find((ch) => ch && ch.name === roleData.channelName);

      if (targetChannel && leaderRole) {
        const overwrites = [
          // 1. ปิดไม่ให้ @everyone เห็นห้อง
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          // 2. เปิดให้หัวหน้าบ้านนั้นๆ เห็นและใช้งานห้องได้
          {
            id: leaderRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AddReactions,
            ],
          },
        ];

        // 3. หากมียศ Director ให้เห็นด้วย
        if (directorRole) {
          overwrites.push({
            id: directorRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          });
        }

        await targetChannel.permissionOverwrites.set(overwrites);
        console.log(`  🔒 ล็อคห้อง "${targetChannel.name}" สำเร็จ -> เห็นเฉพาะยศ "${leaderRole.name}"`);
      } else {
        console.warn(`  ⚠️ ไม่พบห้อง ${roleData.channelName} หรือยศ ${roleData.name}`);
      }
    }

    // 3. เซ็ตหมวดหมู่ 「🎩 สภาคณะละคร-ประชุมสี่บ้าน」 ให้เห็นเฉพาะหัวหน้าทั้ง 4 บ้าน + Director
    console.log("\n🎩 กำลังตั้งค่าสิทธิ์หมวดหมู่การประชุมของสี่หัวหน้าบ้าน...");
    const councilCategory = channels.find((ch) => ch && ch.type === 4 && ch.name.includes("สภาคณะละคร"));
    if (councilCategory) {
      const councilOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ];

      // ให้หัวหน้าทั้ง 4 บ้านเห็นหมวดหมู่นี้
      for (const [, lRole] of createdLeaderRoles) {
        councilOverwrites.push({
          id: lRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        });
      }

      if (directorRole) {
        councilOverwrites.push({
          id: directorRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        });
      }

      await councilCategory.permissionOverwrites.set(councilOverwrites);

      // ซิงค์สิทธิ์ให้ห้องลูกในหมวดหมู่นี้ด้วย
      const childChannels = channels.filter((ch) => ch && ch.parentId === councilCategory.id);
      for (const [, child] of childChannels) {
        await child.lockPermissions().catch(() => null);
      }
      console.log(`  🔒 ล็อคหมวดหมู่ "${councilCategory.name}" สำเร็จ -> เห็นเฉพาะหัวหน้า 4 บ้าน และ Director`);
    }

    console.log("\n🎉 จัดการยศหัวหน้าบ้านและเซ็ตสิทธิ์ความเป็นส่วนตัวเรียบร้อยสมบูรณ์แล้วค่ะ!");
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
