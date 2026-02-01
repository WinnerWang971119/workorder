import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { WorkOrderCategory } from '@workorder/shared';
import * as workorderService from '../services/workorder.service.js';
import * as permissionService from '../services/permission.service.js';
import * as discordService from '../services/discord.service.js';
import { getOrCreateUser } from '../services/user.service.js';

export async function handleEdit(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const workOrderId = interaction.options.getString('id', true);
    const newTitle = interaction.options.getString('title');
    const newDescription = interaction.options.getString('description');
    const newCategory = interaction.options.getString('category') as WorkOrderCategory | null;

    if (!newTitle && !newDescription && !newCategory) {
      await interaction.editReply('No changes provided. Specify at least one field to update.');
      return;
    }

    // Fetch work order
    const workOrder = await workorderService.getWorkOrderById(workOrderId);
    if (!workOrder) {
      await interaction.editReply('Work order not found.');
      return;
    }

    // Resolve DB user
    const dbUser = await getOrCreateUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.displayAvatarURL()
    );
    if (!dbUser) {
      await interaction.editReply('Could not resolve user.');
      return;
    }

    // Permission check: pass both Discord ID (for role lookup) and DB ID (for ownership)
    const canEdit = await permissionService.canEditWorkOrder(
      interaction.user.id,
      dbUser.id,
      workOrder,
      interaction.guildId!,
      interaction.client
    );

    if (!canEdit) {
      await interaction.editReply('You do not have permission to edit this work order.');
      return;
    }

    // Build update payload with only the fields that were provided
    const updates: Record<string, string> = {};
    if (newTitle) updates.title = newTitle;
    if (newDescription) updates.description = newDescription;
    if (newCategory) updates.category = newCategory;

    const updated = await workorderService.updateWorkOrder(workOrderId, updates, dbUser.id, interaction.guildId!);
    if (!updated) {
      await interaction.editReply('Failed to update work order.');
      return;
    }

    // Update the Discord card if one was posted
    await discordService.updateWorkOrderCard(updated, interaction.client);

    const embed = new EmbedBuilder()
      .setColor('#FFCC00')
      .setTitle('Work Order Updated')
      .setDescription(`Work order has been updated.`)
      .addFields({ name: 'ID', value: workOrder.id });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in wo-edit command:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    } else {
      await interaction.editReply('An error occurred while editing the work order.');
    }
  }
}
