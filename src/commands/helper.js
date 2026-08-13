import { AttachmentBuilder } from "discord.js";
import { sendHelperMessage } from "../utils/helper.js";

export async function handleHelperCommand(interaction) {
  const { guildId, channel } = interaction;
  if (!guildId || !channel) {
    await interaction.reply({ content: "❌ คำสั่งนี้ใช้ได้เฉพาะในห้องข้อความของเซิร์ฟเวอร์เท่านั้นค่ะ", ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "talk") {
    const message = interaction.options.getString("message");
    const imageAttachment = interaction.options.getAttachment("image");

    const sendPayload = {
      content: message,
    };

    if (imageAttachment) {
      const attachment = new AttachmentBuilder(imageAttachment.url, { name: imageAttachment.name });
      sendPayload.files = [attachment];
    }

    try {
      await sendHelperMessage(channel, sendPayload, guildId);

      // ตอบกลับแบบ Ephemeral ลับเฉพาะผู้ส่งเห็น ปิดบังตัวตนของผู้พิมพ์ 100%
      await interaction.reply({
        content: "✅ ส่งข้อความในนามบอทผู้ช่วยเรียบร้อยแล้วค่ะ! 🎭",
        ephemeral: true,
      });
    } catch (err) {
      console.error("❌ ไม่สามารถส่งข้อความผ่าน /helper talk ได้:", err);
      await interaction.reply({
        content: `❌ เกิดข้อผิดพลาดในการส่งข้อความ: ${err.message}`,
        ephemeral: true,
      });
    }
  }
}
