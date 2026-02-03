import { ChatInputCommandInteraction } from 'discord.js';
import * as workorderService from '../services/workorder.service.js';
import * as discordService from '../services/discord.service.js';
import { getOrCreateUser } from '../services/user.service.js';
import { supabase } from '../supabase.js';

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const title = interaction.options.getString('title', true);
    const subsystemId = interaction.options.getString('subsystem', true);
    const description = interaction.options.getString('description') || undefined;
    const priority = (interaction.options.getString('priority') || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH';

    // Collect optional notification targets selected in the command UI
    const notifyUserIds = uniqueIds(
      ['notify_user_1', 'notify_user_2', 'notify_user_3']
        .map((optionName) => interaction.options.getUser(optionName))
        .filter(isDefined)
        .map((user) => user.id)
    );
    const notifyRoleIds = uniqueIds(
      ['notify_role_1', 'notify_role_2', 'notify_role_3']
        .map((optionName) => interaction.options.getRole(optionName))
        .filter(isDefined)
        .map((role) => role.id)
    );

    // Upsert user to avoid race conditions
    const dbUser = await getOrCreateUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.displayAvatarURL()
    );

    if (!dbUser) {
      await interaction.editReply('Failed to create work order: could not register user.');
      return;
    }

    // Create work order using the DB user UUID, including notification targets
    const workOrder = await workorderService.createWorkOrder(
      {
        title,
        description,
        subsystem_id: subsystemId,
        priority,
        notify_user_ids: notifyUserIds.length > 0 ? notifyUserIds : undefined,
        notify_role_ids: notifyRoleIds.length > 0 ? notifyRoleIds : undefined,
      },
      dbUser.id,
      interaction.guildId!
    );

    if (!workOrder) {
      await interaction.editReply('Failed to create work order.');
      return;
    }

    // Post card to the guild's configured work-orders channel
    const { data: guildConfig } = await supabase
      .from('guild_configs')
      .select('work_orders_channel_id')
      .eq('guild_id', interaction.guildId!)
      .single();

    let cardMessage: Awaited<ReturnType<typeof discordService.postWorkOrderCard>> = null;
    if (guildConfig?.work_orders_channel_id) {
      cardMessage = await discordService.postWorkOrderCard(
        guildConfig.work_orders_channel_id,
        workOrder,
        interaction.client,
        interaction.user.username
      );
    }

    // Simple confirmation reply instead of a duplicate card.
    // If the card was posted to the channel, link to it so the creator can jump there.
    if (guildConfig?.work_orders_channel_id && cardMessage) {
      const link = `https://discord.com/channels/${interaction.guildId}/${guildConfig.work_orders_channel_id}/${cardMessage.id}`;
      await interaction.editReply(`Work order **${workOrder.title}** created. [Jump to card](${link})`);
    } else {
      await interaction.editReply(`Work order **${workOrder.title}** created.`);
    }
  } catch (error) {
    console.error('Error in wo-create command:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred while creating the work order.', ephemeral: true });
    } else {
      await interaction.editReply('An error occurred while creating the work order.');
    }
  }
}
