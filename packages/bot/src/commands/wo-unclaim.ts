import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import * as workorderService from '../services/workorder.service.js';
import * as permissionService from '../services/permission.service.js';
import * as discordService from '../services/discord.service.js';
import { getOrCreateUser } from '../services/user.service.js';

export async function handleUnclaim(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const workOrderId = interaction.options.getString('id', true);

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

    // Permission check: claimer can unclaim their own, admin can unclaim anyone's
    const canUnclaim = await permissionService.canUnclaimWorkOrder(
      interaction.user.id,
      dbUser.id,
      workOrder,
      interaction.guildId!,
      interaction.client
    );

    if (!canUnclaim) {
      await interaction.editReply('You do not have permission to unclaim this work order.');
      return;
    }

    const updated = await workorderService.unclaimWorkOrder(workOrderId, dbUser.id, interaction.guildId!);
    if (!updated) {
      await interaction.editReply('Failed to unclaim work order.');
      return;
    }

    // Update Discord card
    await discordService.updateWorkOrderCard(updated, interaction.client);

    const embed = new EmbedBuilder()
      .setColor('#FFCC00')
      .setTitle('Work Order Unclaimed')
      .setDescription(`You have unclaimed "${workOrder.title}".`)
      .addFields({ name: 'ID', value: workOrder.id });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in wo-unclaim command:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    } else {
      await interaction.editReply('An error occurred while unclaiming the work order.');
    }
  }
}
