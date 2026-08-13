import "dotenv/config";
import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from "discord.js";

// ==========================================
// ⚙️ ตั้งค่า (Configuration)
// ==========================================
const GUILD_ID = "1533048014568951898";

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

  console.log(`🏰 กำลังตั้งค่าสิทธิ์การมองเห็นสำหรับคนเข้าใหม่ในเซิร์ฟเวอร์: "${guild.name}"...`);

  try {
    await guild.roles.fetch();
    const channels = await guild.channels.fetch();

    // รายชื่อคำค้นหาสำหรับยศสมาชิกที่ผ่านการรับยศแล้ว (ทั้งภาษาไทยและสัญลักษณ์)
    const VERIFIED_KEYWORDS = [
      "ผู้ใหญ่",
      "ผู้ชมรุ่นเยาว์",
      "โพธิดำ",
      "โพธิแดง",
      "ข้าวหลามตัด",
      "ดอกจิก",
      "Director",
      "ผู้นำ",
      "🍷",
      "🎈",
      "♠️",
      "♥️",
      "♦️",
      "♣️",
    ];

    const verifiedRoles = guild.roles.cache.filter((role) => {
      // ข้ามยศ @everyone และยศคนเข้าใหม่ (Newcomer/ผู้มาเยือน)
      if (role.id === guild.roles.everyone.id) return false;
      if (role.name.includes("ผู้มาเยือน") || role.name.includes("Newcomer") || role.name.includes("🎟️")) return false;

      return VERIFIED_KEYWORDS.some((kw) => role.name.includes(kw));
    });

    console.log(`📋 พบยศสมาชิกที่รับยศแล้วทั้งหมด ${verifiedRoles.size} ยศ:`);
    verifiedRoles.forEach((r) => console.log(`  - ${r.name}`));

    // ====================================================
    // 1. ตั้งค่าหมวดหมู่: 「🎪 ข้อมูลประจำคณะละครสัตว์」
    // ====================================================
    const infoCategory = channels.find(
      (ch) => ch && ch.type === ChannelType.GuildCategory && ch.name.includes("ข้อมูลประจำคณะละครสัตว์")
    );

    if (infoCategory) {
      console.log(`\n⚙️ 1. กำลังตั้งค่าหมวดหมู่: "${infoCategory.name}"...`);

      // สิทธิ์ระดับหมวดหมู่: @everyone ดูได้แต่อ่านได้อย่างเดียว พิมพ์ไม่ได้ สร้าง thread ไม่ได้
      await infoCategory.permissionOverwrites.set([
        {
          id: guild.roles.everyone.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ],
          deny: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.CreatePublicThreads,
            PermissionFlagsBits.CreatePrivateThreads,
            PermissionFlagsBits.SendMessagesInThreads,
          ],
        },
      ]);

      // ซิงค์สิทธิ์ห้องส่วนใหญ่ในหมวดหมู่นี้
      const infoChildren = channels.filter((ch) => ch && ch.parentId === infoCategory.id);
      for (const [, child] of infoChildren) {
        if (child.name.includes("แจ้งปัญหา")) {
          // ข้อยกเว้น: ห้อง 【⚠️】ติดต่อสอบถาม-แจ้งปัญหา -> @everyone พิมพ์ได้
          await child.permissionOverwrites.set([
            {
              id: guild.roles.everyone.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AddReactions,
              ],
            },
          ]);
          console.log(`  └─ ✅ ปลดล็อคห้อง "${child.name}" -> @everyone พิมพ์แจ้งปัญหาได้`);
        } else {
          await child.lockPermissions().catch(() => null);
          console.log(`  └─ 🔒 ล็อคห้อง "${child.name}" -> อ่านได้อย่างเดียว (กดปุ่มรับยศได้)`);
        }
      }
    }

    // ====================================================
    // 2. ตั้งค่าหมวดหมู่: 「🎭 ลานแสดงใหญ่-ส่วนกลาง」
    // ====================================================
    const mainCategory = channels.find(
      (ch) => ch && ch.type === ChannelType.GuildCategory && ch.name.includes("ลานแสดงใหญ่-ส่วนกลาง")
    );

    if (mainCategory) {
      console.log(`\n⚙️ 2. กำลังตั้งค่าหมวดหมู่: "${mainCategory.name}"...`);

      const mainOverwrites = [
        // 1. ซ่อนหมวดหมู่นี้จากคนเข้าใหม่ที่ยังไม่ได้รับยศ
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ];

      // 2. เปิดให้เฉพาะสมาชิกที่รับยศแล้วมองเห็นและพิมพ์คุยได้
      for (const [, role] of verifiedRoles) {
        mainOverwrites.push({
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AddReactions,
            PermissionFlagsBits.UseExternalEmojis,
          ],
        });
      }

      await mainCategory.permissionOverwrites.set(mainOverwrites);

      // ซิงค์สิทธิ์ให้ห้องทั้งหมดในหมวดหมู่นี้
      const mainChildren = channels.filter((ch) => ch && ch.parentId === mainCategory.id);
      for (const [, child] of mainChildren) {
        await child.lockPermissions().catch(() => null);
        console.log(`  └─ 🔄 ซิงค์สิทธิ์ห้อง "${child.name}" -> เห็นเฉพาะคนรับยศแล้ว`);
      }

      console.log(`✅ ตั้งค่าหมวดหมู่ "${mainCategory.name}" สำเร็จ!`);
    }

    console.log("\n🎉 ตั้งค่าระบบสิทธิ์สำหรับคนเข้าใหม่และสมาชิกรับยศเรียบร้อยสมบูรณ์แล้วค่ะ!");
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
