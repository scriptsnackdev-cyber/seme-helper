import { getReactionRoleSettings } from "../utils/db.js";
import { assertRoleManageable } from "../utils/permission.js";
import { errorSummary, getReactionEmojiKey } from "../utils/helper.js";

const memberQueues = new Map();

export function setupMessageReactionEvents(client) {
  function handleReaction(reaction, user, details, addRole) {
    const guildId = reaction.message.guildId;
    if (!guildId || user.bot || user.id === client.user.id || details?.burst) return;

    try {
      const panel = getReactionRoleSettings(guildId)[reaction.message.id];
      if (!panel || panel.channelId !== reaction.message.channelId) return;
      const entry = panel.entries.find((item) => item.emojiKey === getReactionEmojiKey(reaction.emoji));
      if (!entry) return;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;

      // Reserve the queue before fetching to preserve the order of rapid add/remove events.
      const queueKey = `${guildId}_${user.id}`;
      const task = (memberQueues.get(queueKey) ?? Promise.resolve())
        .then(async () => {
          const member = await guild.members.fetch(user.id);
          if (member.user.bot) return;
          const role = await guild.roles.fetch(entry.roleId);
          await assertRoleManageable(guild, role);
          if (addRole) await member.roles.add(role);
          else await member.roles.remove(role);
        })
        .catch((error) => {
          console.warn("จัดการยศจาก reaction ไม่สำเร็จ:", {
            guildId, messageId: reaction.message.id, roleId: entry.roleId, ...errorSummary(error),
          });
        })
        .finally(() => {
          if (memberQueues.get(queueKey) === task) memberQueues.delete(queueKey);
        });
      memberQueues.set(queueKey, task);
      return task;
    } catch (error) {
      console.warn("อ่านการตั้งค่า Reaction Roles ไม่สำเร็จ:", errorSummary(error));
    }
  }

  client.on("messageReactionAdd", (reaction, user, details) => handleReaction(reaction, user, details, true));
  client.on("messageReactionRemove", (reaction, user, details) => handleReaction(reaction, user, details, false));
}
