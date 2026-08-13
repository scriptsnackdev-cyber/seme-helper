import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { logServerCount, getGlobalLevelingConfig } from "../utils/db.js";

export function getSlashCommandDefinitions() {
  return [
      new SlashCommandBuilder()
        .setName("ping")
        .setDescription("ทดสอบการตอบสนองของบอท"),

      new SlashCommandBuilder()
        .setName("set")
        .setDescription("จัดการตั้งค่าระบบต่างๆ ในเซิร์ฟเวอร์")
        .addSubcommandGroup((group) =>
          group
            .setName("welcome")
            .setDescription("ระบบส่งการ์ดต้อนรับสมาชิกใหม่เข้าเซิร์ฟเวอร์")
            .addSubcommand((sub) =>
              sub
                .setName("enable")
                .setDescription("เปิดใช้งานการ์ดต้อนรับ")
            )
            .addSubcommand((sub) =>
              sub
                .setName("disable")
                .setDescription("ปิดใช้งานการ์ดต้อนรับ")
            )
            .addSubcommand((sub) =>
              sub
                .setName("message")
                .setDescription("ตั้งค่าข้อความต้อนรับสมาชิกใหม่")
                .addStringOption((opt) =>
                  opt
                    .setName("text")
                    .setDescription("ข้อความต้อนรับ (ใช้ {user} หรือ {guild} เป็นตัวแปรได้)")
                    .setRequired(true)
                )
            )
            .addSubcommand((sub) =>
              sub
                .setName("role")
                .setDescription("ตั้งค่ายศที่จะแจกให้อัตโนมัติเมื่อสมาชิกใหม่เข้ามา")
                .addRoleOption((opt) =>
                  opt
                    .setName("role")
                    .setDescription("เลือกยศที่จะแจกให้อัตโนมัติ")
                    .setRequired(true)
                )
            )
            .addSubcommand((sub) =>
              sub
                .setName("channel")
                .setDescription("ตั้งค่าห้องสำหรับส่งข้อความและรูปภาพต้อนรับ")
                .addChannelOption((opt) =>
                  opt
                    .setName("channel")
                    .setDescription("เลือกห้องที่ต้องการให้บอทส่งข้อความต้อนรับ")
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
                )
            )
            .addSubcommand((sub) =>
              sub
                .setName("image")
                .setDescription("ตั้งค่ารูปภาพหรือวิดีโอแบนเนอร์ด้านล่างของการ์ดต้อนรับ (รองรับ MP4/MOV)")
                .addAttachmentOption((opt) =>
                  opt
                    .setName("image")
                    .setDescription("แนบไฟล์รูปภาพ GIF หรือวิดีโอ MP4 ที่ต้องการตั้งเป็นแบนเนอร์")
                    .setRequired(true)
                )
            )
            .addSubcommand((sub) =>
              sub
                .setName("remove-image")
                .setDescription("ลบรูปภาพหรือวิดีโอแบนเนอร์ด้านล่างออก (กลับไปใช้ภาพเริ่มต้น)")
            )
        )
        .addSubcommandGroup((group) =>
          group
            .setName("member")
            .setDescription("ระบบยืนยันสิทธิ์สมาชิกและแจกยศแบบกดปุ่ม")
            .addSubcommand((sub) =>
              sub
                .setName("setup")
                .setDescription("ส่งข้อความยืนยันสิทธิ์สมาชิกพร้อมปุ่มรับยศในห้องนี้")
                .addStringOption((opt) =>
                  opt
                    .setName("title")
                    .setDescription("หัวข้อของข้อความ Embed (เช่น ✨ ยืนยันสิทธิ์สมาชิก)")
                    .setRequired(true)
                )
                .addStringOption((opt) =>
                  opt
                    .setName("description")
                    .setDescription("ข้อความรายละเอียดการรับยศ")
                    .setRequired(true)
                )
                .addRoleOption((opt) =>
                  opt
                    .setName("newrole")
                    .setDescription("ยศที่จะแจกให้สมาชิกเมื่อกดปุ่ม")
                    .setRequired(true)
                )
                .addStringOption((opt) =>
                  opt
                    .setName("button")
                    .setDescription("ข้อความแสดงบนปุ่มกด (เช่น ✨ รับยศ Member)")
                    .setRequired(true)
                )
                .addAttachmentOption((opt) =>
                  opt
                    .setName("banner")
                    .setDescription("รูปภาพ GIF หรือวิดีโอ MP4 แบนเนอร์ด้านล่าง (ไม่บังคับ)")
                    .setRequired(false)
                )
                .addRoleOption((opt) =>
                  opt
                    .setName("removerole")
                    .setDescription("ยศที่จะถอดออกจากสมาชิกเมื่อกดรับยศใหม่ (ไม่บังคับ)")
                    .setRequired(false)
                )
            )
            .addSubcommand((sub) =>
              sub
                .setName("form-setup")
                .setDescription("สร้างระบบคัดกรองสมาชิกแบบกรอกฟอร์มคำถาม (แอดมินตรวจอนุมัติยศ)")
                .addStringOption((opt) =>
                  opt
                    .setName("title")
                    .setDescription("หัวข้อ Embed ของฟอร์มคัดกรอง")
                    .setRequired(true)
                )
                .addStringOption((opt) =>
                  opt
                    .setName("description")
                    .setDescription("ข้อความรายละเอียดฟอร์มคัดกรอง")
                    .setRequired(true)
                )
                .addStringOption((opt) =>
                  opt
                    .setName("button")
                    .setDescription("ข้อความบนปุ่มกดเปิดฟอร์ม (เช่น 📝 กรอกฟอร์มรับยศ)")
                    .setRequired(true)
                )
                .addRoleOption((opt) =>
                  opt
                    .setName("pendingrole")
                    .setDescription("Role1: ยศชั่วคราวที่จะแจกทันทีหลังกดส่งฟอร์ม")
                    .setRequired(true)
                )
                .addRoleOption((opt) =>
                  opt
                    .setName("approvedrole")
                    .setDescription("Role2: ยศจริงที่จะเปลี่ยนให้เมื่อแอดมินกดอนุมัติ")
                    .setRequired(true)
                )
                .addChannelOption((opt) =>
                  opt
                    .setName("logchannel")
                    .setDescription("ห้องส่งฟอร์มคำตอบให้แอดมินตรวจสอบอนุมัติ")
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
                )
                .addStringOption((opt) =>
                  opt
                    .setName("question1")
                    .setDescription("คำถามที่ 1")
                    .setRequired(true)
                )
                .addChannelOption((opt) =>
                  opt
                    .setName("announce")
                    .setDescription("ห้องสำหรับส่งข้อความต้อนรับเมื่ออนุมัติสมาชิก พร้อมบอกชื่อ/คำตอบข้อ 1 (ไม่บังคับ)")
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(false)
                )
                .addStringOption((opt) =>
                  opt
                    .setName("question2")
                    .setDescription("คำถามที่ 2 (ไม่บังคับ)")
                    .setRequired(false)
                )
                .addStringOption((opt) =>
                  opt
                    .setName("question3")
                    .setDescription("คำถามที่ 3 (ไม่บังคับ)")
                    .setRequired(false)
                )
                .addAttachmentOption((opt) =>
                  opt
                    .setName("banner")
                    .setDescription("รูปภาพ GIF หรือวิดีโอ MP4 แบนเนอร์ด้านล่าง (ไม่บังคับ)")
                    .setRequired(false)
                )
            )
        )
        .addSubcommandGroup((group) =>
          group
            .setName("leveling")
            .setDescription("ระบบ Level Up เมื่อสมาชิกพิมพ์คุยในเซิร์ฟเวอร์")
            .addSubcommand((sub) =>
              sub
                .setName("status")
                .setDescription("เปิด หรือ ปิด ใช้งานระบบเลเวล")
                .addStringOption((opt) =>
                  opt
                    .setName("status")
                    .setDescription("เปิด หรือ ปิด ใช้งานระบบเลเวล")
                    .setRequired(true)
                    .addChoices(
                      { name: "เปิดใช้งาน (Enable)", value: "enable" },
                      { name: "ปิดใช้งาน (Disable)", value: "disable" }
                    )
                )
                .addChannelOption((opt) =>
                  opt
                    .setName("channel")
                    .setDescription("ห้องสำหรับส่งการ์ดแจ้งเตือน Level Up (หากไม่ระบุจะส่งในห้องที่สมาชิกพิมพ์)")
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(false)
                )
            )
            .addSubcommand((sub) =>
              sub
                .setName("image")
                .setDescription("ตั้งค่ารูปภาพแบนเนอร์พื้นหลังประจำการ์ด Level Up")
                .addAttachmentOption((opt) =>
                  opt
                    .setName("image")
                    .setDescription("แนบไฟล์รูปภาพ PNG, JPG หรือ WEBP ที่ต้องการตั้งเป็นแบนเนอร์")
                    .setRequired(true)
                )
            )
            .addSubcommand((sub) =>
              sub
                .setName("remove-image")
                .setDescription("ลบรูปภาพแบนเนอร์ประจำการ์ด Level Up ออก")
            )
        )
        .addSubcommandGroup((group) =>
          group
            .setName("giverole")
            .setDescription("ตั้งค่ารูปภาพหรือวิดีโอแบนเนอร์สำหรับคำสั่ง /giverole")
            .addSubcommand((sub) =>
              sub
                .setName("image")
                .setDescription("ตั้งค่ารูปภาพหรือวิดีโอแบนเนอร์ประจำคำสั่ง /giverole")
                .addAttachmentOption((opt) =>
                  opt
                    .setName("image")
                    .setDescription("แนบไฟล์รูปภาพ GIF, PNG, JPG หรือวิดีโอ MP4/MOV")
                    .setRequired(true)
                )
            )
            .addSubcommand((sub) =>
              sub
                .setName("remove-image")
                .setDescription("ลบรูปภาพหรือวิดีโอแบนเนอร์ประจำคำสั่ง /giverole ออก")
            )
        )
        .addSubcommandGroup((group) =>
          group
            .setName("helper")
            .setDescription("ตั้งค่าบอทผู้ช่วยประจำเซิร์ฟเวอร์ (Custom Name & Avatar)")
            .addSubcommand((sub) =>
              sub
                .setName("setup")
                .setDescription("ตั้งค่าชื่อและรูปโปรไฟล์ผู้ช่วยประจำเซิร์ฟเวอร์")
                .addStringOption((opt) =>
                  opt
                    .setName("name")
                    .setDescription("ชื่อของบอทผู้ช่วย (เช่น มาสคอตประจำคณะละคร)")
                    .setRequired(true)
                )
                .addAttachmentOption((opt) =>
                  opt
                    .setName("image")
                    .setDescription("แนบไฟล์รูปภาพโปรไฟล์ Avatar ของบอทผู้ช่วย")
                    .setRequired(false)
                )
                .addStringOption((opt) =>
                  opt
                    .setName("image_url")
                    .setDescription("ลิงก์ URL รูปโปรไฟล์ Avatar ของบอทผู้ช่วย (หากไม่สะดวกแนบไฟล์)")
                    .setRequired(false)
                )
            )
            .addSubcommand((sub) =>
              sub
                .setName("status")
                .setDescription("ดูข้อมูลการตั้งค่าบอทผู้ช่วยประจำเซิร์ฟเวอร์ในปัจจุบัน")
            )
            .addSubcommand((sub) =>
              sub
                .setName("reset")
                .setDescription("รีเซ็ตบอทผู้ช่วยกลับเป็นชื่อและรูปเริ่มต้นของบอท")
            )
        ),
      new SlashCommandBuilder()
        .setName("giverole")
        .setDescription("มอบยศ (Role) ให้กับสมาชิกในเซิร์ฟเวอร์")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("สมาชิกที่ต้องการแจกยศ")
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("ยศที่ต้องการแจกให้สมาชิก")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("quiz")
        .setDescription("จัดการระบบแบบทดสอบวัดระดับยศ (Interactive Quiz)")
        .addSubcommand((sub) =>
          sub
            .setName("add-result")
            .setDescription("เพิ่มผลลัพธ์ยศที่จะแจกหลังทำแบบทดสอบ")
            .addStringOption((opt) =>
              opt
                .setName("title")
                .setDescription("ชื่อผลลัพธ์ (ใช้เป็น KEY อ้างอิง เช่น บ้านแมวสีส้ม หรือ Minimalist)")
                .setRequired(true)
            )
            .addRoleOption((opt) =>
              opt
                .setName("role")
                .setDescription("ยศที่จะแจกเมื่อได้ผลลัพธ์นี้")
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("description")
                .setDescription("คำอธิบายเกี่ยวกับผลลัพธ์ยศนี้")
                .setRequired(true)
            )
            .addAttachmentOption((opt) =>
              opt
                .setName("banner")
                .setDescription("รูปภาพ GIF หรือวิดีโอ MP4 แบนเนอร์ผลลัพธ์ยศนี้ (ไม่บังคับ)")
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("add-question")
            .setDescription("เพิ่มคำถามและตัวเลือกตอบของแบบทดสอบ")
            .addStringOption((opt) =>
              opt
                .setName("text")
                .setDescription("ข้อความคำถาม (เช่น คุณชอบใช้เวลาว่างทำอะไร?)")
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("opt1_label")
                .setDescription("ข้อความปุ่มกด ตัวเลือกที่ 1")
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("opt1_result")
                .setDescription("ชื่อผลลัพธ์ที่จะสะสมคะแนนให้ถ้าเลือกข้อ 1 (ต้องตรงกับ title ของ add-result)")
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("opt2_label")
                .setDescription("ข้อความปุ่มกด ตัวเลือกที่ 2")
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("opt2_result")
                .setDescription("ชื่อผลลัพธ์ที่จะสะสมคะแนนให้ถ้าเลือกข้อ 2")
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("opt3_label")
                .setDescription("ข้อความปุ่มกด ตัวเลือกที่ 3 (ไม่บังคับ)")
                .setRequired(false)
            )
            .addStringOption((opt) =>
              opt
                .setName("opt3_result")
                .setDescription("ชื่อผลลัพธ์สำหรับตัวเลือกที่ 3 (ไม่บังคับ)")
                .setRequired(false)
            )
            .addStringOption((opt) =>
              opt
                .setName("opt4_label")
                .setDescription("ข้อความปุ่มกด ตัวเลือกที่ 4 (ไม่บังคับ)")
                .setRequired(false)
            )
            .addStringOption((opt) =>
              opt
                .setName("opt4_result")
                .setDescription("ชื่อผลลัพธ์สำหรับตัวเลือกที่ 4 (ไม่บังคับ)")
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("setup")
            .setDescription("สร้างข้อความต้อนรับควิซพร้อมปุ่มเริ่มทำแบบทดสอบในห้องนี้")
            .addStringOption((opt) =>
              opt
                .setName("title")
                .setDescription("หัวข้อ Embed ของระบบแบบทดสอบ")
                .setRequired(false)
            )
            .addStringOption((opt) =>
              opt
                .setName("description")
                .setDescription("รายละเอียดเกี่ยวกับแบบทดสอบ")
                .setRequired(false)
            )
            .addStringOption((opt) =>
              opt
                .setName("button")
                .setDescription("ข้อความบนปุ่มกดเริ่มทำแบบทดสอบ")
                .setRequired(false)
            )
            .addAttachmentOption((opt) =>
              opt
                .setName("header-banner")
                .setDescription("รูปภาพ GIF หรือวิดีโอ MP4 แบนเนอร์ด้านล่าง (ไม่บังคับ)")
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("delete-result")
            .setDescription("ลบผลลัพธ์ยศตามชื่อที่ระบุ")
            .addStringOption((opt) =>
              opt
                .setName("title")
                .setDescription("ชื่อผลลัพธ์ที่ต้องการลบ")
                .setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("delete-question")
            .setDescription("ลบคำถามตามลำดับข้อ (เช่น ลบข้อ 1)")
            .addIntegerOption((opt) =>
              opt
                .setName("index")
                .setDescription("ลำดับข้อคำถามที่ต้องการลบ (เช่น 1, 2, 3...)")
                .setRequired(true)
            )
        ),
      new SlashCommandBuilder()
        .setName("image")
        .setDescription("จัดการคลังรูปภาพของเซิร์ฟเวอร์ (อัปโหลดแปลงเป็น WebP อัตโนมัติ)")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("อัปโหลดรูปภาพเข้าคลัง (แปลงเป็นไฟล์ WebP อัตโนมัติ)")
            .addStringOption((opt) =>
              opt
                .setName("title")
                .setDescription("ชื่อหมวดหมู่คลังรูปภาพ (เช่น cats, banner)")
                .setRequired(true)
            )
            .addAttachmentOption((opt) => opt.setName("image1").setDescription("รูปภาพที่ 1").setRequired(true))
            .addAttachmentOption((opt) => opt.setName("image2").setDescription("รูปภาพที่ 2 (ไม่บังคับ)").setRequired(false))
            .addAttachmentOption((opt) => opt.setName("image3").setDescription("รูปภาพที่ 3 (ไม่บังคับ)").setRequired(false))
            .addAttachmentOption((opt) => opt.setName("image4").setDescription("รูปภาพที่ 4 (ไม่บังคับ)").setRequired(false))
            .addAttachmentOption((opt) => opt.setName("image5").setDescription("รูปภาพที่ 5 (ไม่บังคับ)").setRequired(false))
            .addAttachmentOption((opt) => opt.setName("image6").setDescription("รูปภาพที่ 6 (ไม่บังคับ)").setRequired(false))
            .addAttachmentOption((opt) => opt.setName("image7").setDescription("รูปภาพที่ 7 (ไม่บังคับ)").setRequired(false))
            .addAttachmentOption((opt) => opt.setName("image8").setDescription("รูปภาพที่ 8 (ไม่บังคับ)").setRequired(false))
            .addAttachmentOption((opt) => opt.setName("image9").setDescription("รูปภาพที่ 9 (ไม่บังคับ)").setRequired(false))
            .addBooleanOption((opt) =>
              opt
                .setName("blur")
                .setDescription("เปิดใช้ Spoiler (เบลอรูปภาพ) เวลาดูด้วย /image view (ไม่บังคับ)")
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("list")
            .setDescription("ดูรายการคลังรูปภาพทั้งหมดในเซิร์ฟเวอร์")
        )
        .addSubcommand((sub) =>
          sub
            .setName("view")
            .setDescription("ดูรูปภาพทั้งหมดในคลังตามชื่อหมวดหมู่ที่ระบุ")
            .addStringOption((opt) =>
              opt
                .setName("title")
                .setDescription("ชื่อหมวดหมู่คลังรูปภาพที่ต้องการดู")
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("delete")
            .setDescription("ลบคลังรูปภาพตามชื่อหมวดหมู่ที่ระบุ")
            .addStringOption((opt) =>
              opt
                .setName("title")
                .setDescription("ชื่อหมวดหมู่คลังรูปภาพที่ต้องการลบ")
                .setRequired(true)
                .setAutocomplete(true)
            )
        ),
  ].map((cmd) => cmd.toJSON());
}

export async function registerGuildCommands(token, clientId, guildId, commands) {
  const rest = new REST({ version: "10" }).setToken(token);
  return await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
}

export function setupReadyEvent(client, token, clientId) {
  client.once("ready", async () => {
    console.log(`🤖 [Bot Status] เข้าสู่ระบบสำเร็จในชื่อ: ${client.user.tag}`);
    console.log(`🌐 [Servers] กำลังให้บริการอยู่ใน ${client.guilds.cache.size} เซิร์ฟเวอร์`);

    // บันทึกรายชื่อเซิร์ฟเวอร์
    logServerCount(client.guilds);

    // สร้าง/โหลด leveling.json
    getGlobalLevelingConfig();

    // สร้างคำสั่ง Slash Commands
    const commands = getSlashCommandDefinitions();
    const rest = new REST({ version: "10" }).setToken(token);

    try {
      console.log("⏳ [Slash Commands] กำลังล้าง Global Commands และลงทะเบียนคำสั่ง Local (Guild Commands)...");
      // ล้าง Global Commands เพื่อแก้คำสั่งซ้ำ 2
      await rest.put(Routes.applicationCommands(clientId), { body: [] }).catch((err) => {
        console.warn("⚠️ ไม่สามารถล้าง Global Commands ได้:", err.message);
      });

      // ลงทะเบียน Local Commands เฉพาะเซิร์ฟเวอร์
      for (const [guildId] of client.guilds.cache) {
        await registerGuildCommands(token, clientId, guildId, commands).catch((err) => {
          console.warn(`⚠️ ไม่สามารถลงทะเบียนคำสั่งให้ Guild ${guildId} ได้:`, err.message);
        });
      }
      console.log("✅ [Slash Commands] ลงทะเบียนคำสั่ง Local (Guild Commands) สำเร็จเรียบร้อยแล้ว (ไม่ซ้ำแล้ว)!");
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการลงทะเบียน Slash Commands:", error);
    }
  });}
