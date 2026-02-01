import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { WorkOrderCategory } from '@workorder/shared';
import * as workorderService from '../services/workorder.service.js';
import * as discordService from '../services/discord.service.js';
import { getOrCreateUser } from '../services/user.service.js';
import { supabase } from '../supabase.js';

export async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const title = interaction.options.getString('title', true);
    const category = interaction.options.getString('category', true) as WorkOrderCategory;
    const description = interaction.options.getString('description') || undefined;
    const priority = (interaction.options.getString('priority') || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH';

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

    // Create work order using the DB user UUID
    const workOrder = await workorderService.createWorkOrder(
      { title, description, category, priority },
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

    if (guildConfig?.work_orders_channel_id) {
      await discordService.postWorkOrderCard(
        guildConfig.work_orders_channel_id,
        workOrder,
        interaction.client,
        interaction.user.username
      );
    }

    const embed = new EmbedBuilder()
      .setColor('#FFCC00')
      .setTitle('Work Order Created')
      .setDescription(`"${title}" has been created.`)
      .addFields({ name: 'ID', value: workOrder.id });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in wo-create command:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred while creating the work order.', ephemeral: true });
    } else {
      await interaction.editReply('An error occurred while creating the work order.');
    }
  }
}
