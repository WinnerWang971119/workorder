import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  Client,
  Message,
} from 'discord.js';
import {
  WorkOrder,
  WorkOrderStatus,
  PRIORITY_EMOJIS,
  PRIORITY_LABELS,
  getDisplayStatus,
  getEmbedColor,
} from '@workorder/shared';
import { supabase } from '../supabase.js';

/**
 * Create a Discord embed for a work order card.
 * Color reflects priority for open items and turns green when finished.
 * Subsystem display_name and emoji come from the joined subsystem row.
 */
export function createWorkOrderEmbed(
  workOrder: WorkOrder,
  creatorName?: string,
  claimerName?: string,
  assigneeName?: string
): EmbedBuilder {
  // Use subsystem data when available, fall back to generic defaults
  const subsystemEmoji = workOrder.subsystem?.emoji || '';
  const subsystemLabel = workOrder.subsystem?.display_name || 'Unknown';
  const priorityEmoji = PRIORITY_EMOJIS[workOrder.priority] || '';
  const priorityLabel = PRIORITY_LABELS[workOrder.priority] || workOrder.priority;

  const embed = new EmbedBuilder()
    .setColor(getEmbedColor(workOrder))
    .setTitle(`${subsystemEmoji} [${subsystemLabel}] ${workOrder.title}`)
    .setDescription(workOrder.description || '*No description provided*')
    .addFields(
      { name: 'Status', value: getDisplayStatus(workOrder), inline: true },
      { name: 'Priority', value: `${priorityEmoji} ${priorityLabel}`, inline: true },
      { name: 'Subsystem', value: `${subsystemEmoji} ${subsystemLabel}`, inline: true }
    );

  if (creatorName) {
    embed.addFields({ name: 'Created By', value: creatorName, inline: true });
  }

  if (claimerName) {
    embed.addFields({ name: 'Claimed By', value: claimerName, inline: true });
  }

  if (assigneeName) {
    embed.addFields({ name: 'Assigned To', value: assigneeName, inline: true });
  }

  // Show CAD link if present
  if (workOrder.cad_link) {
    embed.addFields({ name: 'CAD Link', value: `[Open CAD](${workOrder.cad_link})` });
  }

  // Show cancelled state
  if (workOrder.status === WorkOrderStatus.CANCELLED) {
    embed.addFields({ name: 'Cancelled', value: 'This work order has been cancelled.' });
  }

  // Show removal state clearly
  if (workOrder.is_deleted) {
    embed.setColor(0xFF0000);
    embed.addFields({ name: 'Removed', value: 'This work order has been removed by an admin.' });
  }

  embed.setFooter({ text: `ID: ${workOrder.id}` });
  embed.setTimestamp(new Date(workOrder.created_at));

  return embed;
}

/**
 * Create action buttons for a work order card.
 * Buttons are contextual: only show valid actions for the current state.
 */
export function createWorkOrderButtons(workOrder: WorkOrder): ActionRowBuilder<ButtonBuilder> {
  const buttons = new ActionRowBuilder<ButtonBuilder>();

  // No buttons on deleted, done, or cancelled work orders
  if (workOrder.is_deleted || workOrder.status === WorkOrderStatus.DONE || workOrder.status === WorkOrderStatus.CANCELLED) {
    return buttons;
  }

  // Always show Claim if unclaimed
  if (!workOrder.claimed_by_user_id) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`claim-${workOrder.id}`)
        .setLabel('Claim')
        .setStyle(ButtonStyle.Primary)
    );
  }

  // Show Unclaim and Mark Done if someone has claimed it
  if (workOrder.claimed_by_user_id) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(`unclaim-${workOrder.id}`)
        .setLabel('Unclaim')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`done-${workOrder.id}`)
        .setLabel('Mark Done')
        .setStyle(ButtonStyle.Success)
    );
  }

  // Cancel button always available on OPEN work orders (creator/admin verified at click time)
  buttons.addComponents(
    new ButtonBuilder()
      .setCustomId(`cancel-${workOrder.id}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
  );

  return buttons;
}

/**
 * Post a work order card to a Discord channel.
 * Saves both message_id and channel_id back to the database
 * so the card can be updated later.
 */
export async function postWorkOrderCard(
  channelId: string,
  workOrder: WorkOrder,
  client: Client,
  creatorName?: string
): Promise<Message | null> {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      console.error(`Channel ${channelId} not found or is not text-based`);
      return null;
    }

    const embed = createWorkOrderEmbed(workOrder, creatorName);
    const buttons = createWorkOrderButtons(workOrder);

    const components = buttons.components.length > 0 ? [buttons] : [];
    const notifyUserIds = workOrder.notify_user_ids || [];
    const notifyRoleIds = workOrder.notify_role_ids || [];
    const hasMentions = notifyUserIds.length > 0 || notifyRoleIds.length > 0;
    const mentions = [
      ...notifyUserIds.map((id) => `<@${id}>`),
      ...notifyRoleIds.map((id) => `<@&${id}>`),
    ].join(' ');

    const message = await (channel as TextChannel).send({
      content: hasMentions ? mentions : undefined,
      allowedMentions: hasMentions ? { users: notifyUserIds, roles: notifyRoleIds } : undefined,
      embeds: [embed],
      components,
    });

    // Persist message and channel IDs so we can edit the card later
    const { error } = await supabase
      .from('work_orders')
      .update({
        discord_message_id: message.id,
        discord_channel_id: channelId,
      })
      .eq('id', workOrder.id);

    if (error) {
      console.error('Failed to save message ID to work order:', error);
    }

    return message;
  } catch (error) {
    console.error('Failed to post work order card:', error);
    return null;
  }
}

/**
 * Update an existing work order card in Discord.
 * Uses the stored channel_id and message_id to fetch and edit the message.
 */
export async function updateWorkOrderCard(
  workOrder: WorkOrder,
  client: Client,
  claimerName?: string,
  assigneeName?: string
): Promise<void> {
  // Need both IDs to locate the message
  if (!workOrder.discord_message_id || !workOrder.discord_channel_id) {
    return;
  }

  try {
    const channel = await client.channels.fetch(workOrder.discord_channel_id);
    if (!channel || !channel.isTextBased()) {
      console.error(`Channel ${workOrder.discord_channel_id} not found for card update`);
      return;
    }

    const message = await (channel as TextChannel).messages.fetch(workOrder.discord_message_id);
    if (!message) {
      console.error(`Message ${workOrder.discord_message_id} not found for card update`);
      return;
    }

    const embed = createWorkOrderEmbed(workOrder, undefined, claimerName, assigneeName);
    const buttons = createWorkOrderButtons(workOrder);
    const components = buttons.components.length > 0 ? [buttons] : [];

    await message.edit({
      embeds: [embed],
      components,
    });
  } catch (error) {
    // Message may have been deleted by a moderator; log and continue
    console.error('Failed to update work order card:', error);
  }
}
