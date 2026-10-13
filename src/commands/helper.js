import { MessageFlags, AttachmentBuilder } from "discord.js";
import { sendHelperMessage, respondToInteraction, deferCommand, errorSummary } from "../utils/helper.js";

export async function handleHelperCommand(interaction) {
  await deferCommand(interaction);
  const { guildId, channel } = interaction;
  if (!guildId || !channel) {
    await respondToInteraction(interaction, { content: "❌ คำสั่งนี้ใช้ได้เฉพาะในห้องข้อความของเซิร์ฟเวอร์เท่านั้นค่ะ", flags: MessageFlags.Ephemeral });
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
    } catch (err) {
      console.error("❌ ไม่สามารถส่งข้อความผ่าน /helper talk ได้:", errorSummary(err));
      await respondToInteraction(interaction, {
        content: err.deliveryUncertain ? err.message : (err.code
          ? `ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ห้องและไฟล์แนบ (รหัส ${err.code})`
          : err.message),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await respondToInteraction(interaction, {
      content: "Success: ส่งข้อความในนามบอทผู้ช่วยเรียบร้อยแล้วค่ะ",
    });
  }
}
