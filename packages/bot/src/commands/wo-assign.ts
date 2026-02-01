import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import * as workorderService from '../services/workorder.service.js';
import * as permissionService from '../services/permission.service.js';
import * as discordService from '../services/discord.service.js';
import { getOrCreateUser } from '../services/user.service.js';

export async function handleAssign(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const workOrderId = interaction.options.getString('id', true);
    const targetUser = interaction.options.getUser('user', true);

    // Admin-only check
    const canAssign = await permissionService.canAssignWorkOrder(
      interaction.user.id,
      interaction.guildId!,
      interaction.client
    );

    if (!canAssign) {
      await interaction.editReply('You do not have permission to assign work orders (admin only).');
      return;
    }

    const workOrder = await workorderService.getWorkOrderById(workOrderId);
    if (!workOrder) {
      await interaction.editReply('Work order not found.');
      return;
    }

    // Resolve actor DB user
    const actorDbUser = await getOrCreateUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.displayAvatarURL()
    );
    if (!actorDbUser) {
      await interaction.editReply('Could not resolve your user record.');
      return;
    }

    // Resolve assignee DB user
    const assigneeDbUser = await getOrCreateUser(
      targetUser.id,
      targetUser.username,
      targetUser.displayAvatarURL()
    );
    if (!assigneeDbUser) {
      await interaction.editReply('Could not resolve assignee user record.');
      return;
    }

    const updated = await workorderService.assignWorkOrder(
      workOrderId,
      assigneeDbUser.id,
      actorDbUser.id,
      interaction.guildId!
    );

    if (!updated) {
      await interaction.editReply('Failed to assign work order.');
      return;
    }

    // Update Discord card
    await discordService.updateWorkOrderCard(updated, interaction.client, undefined, targetUser.username);

    const embed = new EmbedBuilder()
      .setColor('#FFCC00')
      .setTitle('Work Order Assigned')
      .setDescription(`Work order has been assigned to <@${targetUser.id}>.`)
      .addFields({ name: 'ID', value: workOrder.id });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in wo-assign command:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    } else {
      await interaction.editReply('An error occurred while assigning the work order.');
    }
  }
}
