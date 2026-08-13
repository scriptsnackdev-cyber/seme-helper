import { getHelperSettings } from "./db.js";

/**
 * ส่งข้อความไปยังห้องเป้าหมายด้วยตัวตนของ Helper ประจำเซิร์ฟเวอร์ (ผ่าน Webhook)
 * หากไม่ได้ตั้งค่า Helper หรือเกิดปัญหา จะ fallback ไปใช้ channel.send() อัตโนมัติ
 *
 * @param {import('discord.js').TextBasedChannel} channel - ห้องเป้าหมาย
 * @param {import('discord.js').MessageCreateOptions} payload - ข้อมูลข้อความ (content, embeds, files, components)
 * @param {string} [guildId] - ID ของเซิร์ฟเวอร์ (ไม่บังคับ)
 */
export async function sendHelperMessage(channel, payload, guildId = null) {
  if (!channel) return null;
  const targetGuildId = guildId || channel.guild?.id;

  if (!targetGuildId) {
    return await channel.send(payload);
  }

  const helperConfig = getHelperSettings(targetGuildId);

  // ถ้าไม่ได้เปิดใช้งาน หรือไม่ได้ตั้งชื่อ ให้ใช้ channel.send ตามปกติ
  if (!helperConfig || !helperConfig.enabled || !helperConfig.name) {
    return await channel.send(payload);
  }

  try {
    // ตรวจสอบสิทธิ์การจัดการ Webhook ของบอทในเซิร์ฟเวอร์
    const botMember = channel.guild?.members.me || (await channel.guild?.members.fetchMe().catch(() => null));
    if (botMember && !channel.permissionsFor(botMember)?.has("ManageWebhooks")) {
      return await channel.send(payload);
    }

    if (!channel.fetchWebhooks) {
      return await channel.send(payload);
    }

    const webhooks = await channel.fetchWebhooks().catch(() => null);
    let webhook = null;

    if (webhooks) {
      // ค้นหา Webhook ที่สร้างโดยบอทของเรา
      webhook = webhooks.find((w) => w.owner?.id === channel.client.user.id);
    }

    // ถ้ายังไม่มี Webhook ในห้องนี้ ให้สร้างขึ้นใหม่
    if (!webhook) {
      webhook = await channel.createWebhook({
        name: helperConfig.name,
        avatar: helperConfig.avatar || undefined,
        reason: "Seme Helper Persona Webhook",
      });
    }

    // ส่งข้อความผ่าน Webhook พร้อมกำหนด username และ avatarURL
    const webhookPayload = {
      ...payload,
      username: helperConfig.name,
      avatarURL: helperConfig.avatar || undefined,
    };

    return await webhook.send(webhookPayload);
  } catch (err) {
    console.warn("⚠️ ไม่สามารถส่งผ่าน Webhook ได้ (fallback ไปใช้ channel.send):", err.message);
    return await channel.send(payload);
  }
}
