import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import * as workorderService from '../services/workorder.service.js';
import * as permissionService from '../services/permission.service.js';
import * as discordService from '../services/discord.service.js';
import { getOrCreateUser } from '../services/user.service.js';

export async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const workOrderId = interaction.options.getString('id', true);

    // Admin-only check
    const canRemove = await permissionService.canRemoveWorkOrder(
      interaction.user.id,
      interaction.guildId!,
      interaction.client
    );

    if (!canRemove) {
      await interaction.editReply('You do not have permission to remove work orders (admin only).');
      return;
    }

    const workOrder = await workorderService.getWorkOrderById(workOrderId);
    if (!workOrder) {
      await interaction.editReply('Work order not found.');
      return;
    }

    const dbUser = await getOrCreateUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.displayAvatarURL()
    );
    if (!dbUser) {
      await interaction.editReply('Could not resolve user.');
      return;
    }

    await workorderService.softDeleteWorkOrder(workOrderId, dbUser.id, interaction.guildId!);

    // Re-fetch the updated work order to update the card
    const deletedWo = await workorderService.getWorkOrderById(workOrderId);
    if (deletedWo) {
      await discordService.updateWorkOrderCard(deletedWo, interaction.client);
    }

    const embed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('Work Order Removed')
      .setDescription(`Work order "${workOrder.title}" has been removed.`)
      .addFields({ name: 'ID', value: workOrder.id });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in wo-remove command:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    } else {
      await interaction.editReply('An error occurred while removing the work order.');
    }
  }
}
