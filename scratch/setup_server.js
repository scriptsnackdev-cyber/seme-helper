import "dotenv/config";
import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from "discord.js";

// ==========================================
// ⚙️ ตั้งค่า (Configuration)
// ==========================================
// Guild ID ของเซิร์ฟเวอร์
const GUILD_ID = "1533048014568951898";

// ⚠️ โค้ดนี้ "ไม่มีการลบห้องใดๆ ทั้งสิ้น" (สร้างเฉพาะห้องและหมวดหมู่ใหม่เพิ่มเติมเท่านั้น)

// โครงสร้างหมวดหมู่และห้อง: ธีมคณะละครสัตว์ + 4 บ้านไพ่ + โซนบริหารร่วม 4 เจ้าของบ้าน
const SERVER_STRUCTURE = [
  // ----------------------------------------------------
  // 1. โซนข้อมูลและกฎระเบียบส่วนกลาง (Public Info)
  // ----------------------------------------------------
  {
    category: "「🎪 ข้อมูลประจำคณะละครสัตว์」",
    channels: [
      {
        name: "【🎟️】จุดจำหน่ายตั๋ว-ต้อนรับ",
        type: ChannelType.GuildText,
        readOnly: true, // @everyone อ่านได้อย่างเดียว (สำหรับวางปุ่มรับยศ/ควิซ)
      },
      {
        name: "【📜】กฎระเบียบคณะละคร",
        type: ChannelType.GuildText,
        readOnly: true, // @everyone อ่านได้อย่างเดียว
      },
      {
        name: "【📢】ประกาศจากคณะละคร",
        type: ChannelType.GuildText,
        readOnly: true, // @everyone อ่านได้อย่างเดียว
      },
      {
        name: "【⚠️】ติดต่อสอบถาม-แจ้งปัญหา",
        type: ChannelType.GuildText,
      },
    ],
  },

  // ----------------------------------------------------
  // 2. โซนลานแสดงใหญ่ (แชทส่วนกลาง สมาชิกทุกบ้านคุยรวมกัน)
  // ----------------------------------------------------
  {
    category: "「🎭 ลานแสดงใหญ่-ส่วนกลาง」",
    channels: [
      {
        name: "【💬】เวทีคุยเล่นรวม",
        type: ChannelType.GuildText,
      },
      {
        name: "【📸】คลังภาพและโมเมนต์",
        type: ChannelType.GuildText,
      },
      {
        name: "【🃏】โต๊ะเล่นกล-คำสั่งบอท",
        type: ChannelType.GuildText,
      },
      {
        name: "【💸】ตู้ทิปและโดเนท",
        type: ChannelType.GuildText,
      },
    ],
  },

  // ----------------------------------------------------
  // 3. บ้าน ♠️ โพธิดำ (Spade Tent)
  // ----------------------------------------------------
  {
    category: "「♠️ โรงเต็นท์โพธิดำ」",
    channels: [
      {
        name: "【♠️】ห้องนั่งเล่นโพธิดำ",
        type: ChannelType.GuildText,
      },
      {
        name: "【🗝️】หลังม่านหัวหน้าโพธิดำ",
        type: ChannelType.GuildText,
      },
    ],
  },

  // ----------------------------------------------------
  // 4. บ้าน ♥️ โพธิแดง (Heart Tent)
  // ----------------------------------------------------
  {
    category: "「♥️ โรงเต็นท์โพธิแดง」",
    channels: [
      {
        name: "【♥️】ห้องนั่งเล่นโพธิแดง",
        type: ChannelType.GuildText,
      },
      {
        name: "【🗝️】หลังม่านหัวหน้าโพธิแดง",
        type: ChannelType.GuildText,
      },
    ],
  },

  // ----------------------------------------------------
  // 5. บ้าน ♦️ ข้าวหลามตัด (Diamond Tent)
  // ----------------------------------------------------
  {
    category: "「♦️ โรงเต็นท์ข้าวหลามตัด」",
    channels: [
      {
        name: "【♦️】ห้องนั่งเล่นข้าวหลามตัด",
        type: ChannelType.GuildText,
      },
      {
        name: "【🗝️】หลังม่านหัวหน้าข้าวหลามตัด",
        type: ChannelType.GuildText,
      },
    ],
  },

  // ----------------------------------------------------
  // 6. บ้าน ♣️ ดอกจิก (Club Tent)
  // ----------------------------------------------------
  {
    category: "「♣️ โรงเต็นท์ดอกจิก」",
    channels: [
      {
        name: "【♣️】ห้องนั่งเล่นดอกจิก",
        type: ChannelType.GuildText,
      },
      {
        name: "【🗝️】หลังม่านหัวหน้าดอกจิก",
        type: ChannelType.GuildText,
      },
    ],
  },

  // ----------------------------------------------------
  // 7. โซนประชุมและบริหารร่วมกันของ 4 เจ้าของบ้าน (House Masters Council)
  // ----------------------------------------------------
  {
    category: "「🎩 สภาคณะละคร-ประชุมสี่บ้าน」",
    channels: [
      {
        name: "【👑】โต๊ะกลมประชุมสี่หัวหน้า",
        type: ChannelType.GuildText,
      },
      {
        name: "【📜】บันทึกมติและนโยบาย",
        type: ChannelType.GuildText,
      },
      {
        name: "【🛠️】ห้องตั้งค่าระบบบอท",
        type: ChannelType.GuildText,
      },
    ],
  },
];

// ==========================================
// 🚀 เริ่มต้นการทำงานของสคริปต์ (รันเมื่อสั่งเท่านั้น)
// ==========================================
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  console.log(`🤖 เข้าสู่ระบบด้วยบอท: ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) {
    console.error(`❌ ไม่พบเซิร์ฟเวอร์สำหรับ GUILD_ID: ${GUILD_ID} (บอทอาจยังไม่ได้อยู่ในเซิร์ฟเวอร์นี้)`);
    process.exit(1);
  }

  console.log(`🏰 พบเซิร์ฟเวอร์: "${guild.name}" (ID: ${guild.id})`);
  console.log(`📌 กำลังเริ่มสร้างหมวดหมู่และห้องใหม่ธีมละครสัตว์ 4 บ้าน (ไม่มีการลบห้องเดิม)...`);

  try {
    for (const group of SERVER_STRUCTURE) {
      console.log(`\n📁 กำลังสร้างหมวดหมู่: ${group.category}`);

      // 1. สร้าง Category
      const createdCategory = await guild.channels.create({
        name: group.category,
        type: ChannelType.GuildCategory,
      });

      // 2. สร้าง Channels ย่อยใน Category นั้นๆ
      for (const chInfo of group.channels) {
        const channelOptions = {
          name: chInfo.name,
          type: chInfo.type,
          parent: createdCategory.id,
          nsfw: chInfo.nsfw || false,
        };

        // ตั้งค่าสิทธิ์เบื้องต้น (เช่น ห้องประกาศ/กฎ ให้ @everyone อ่านได้อย่างเดียว)
        if (chInfo.readOnly) {
          channelOptions.permissionOverwrites = [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.SendMessages],
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            },
          ];
        }

        const createdChannel = await guild.channels.create(channelOptions);
        console.log(`  └─ [💬 Text] สร้างห้อง: ${createdChannel.name}`);
      }
    }

    console.log("\n🎉 สร้างโครงสร้างห้องธีมคณะละครสัตว์ 4 บ้านทั้งหมดสำเร็จเรียบร้อยแล้วค่ะ!");
  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการสร้างห้อง:", err);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("❌ ไม่พบ DISCORD_TOKEN ในไฟล์ .env");
  process.exit(1);
}

client.login(token);
