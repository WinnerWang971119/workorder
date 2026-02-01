import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import * as workorderService from '../services/workorder.service.js';
import * as permissionService from '../services/permission.service.js';
import * as discordService from '../services/discord.service.js';
import { getOrCreateUser } from '../services/user.service.js';

export async function handleClaim(interaction: ChatInputCommandInteraction): Promise<void> {
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

    // Permission check uses DB user ID (compares with claimed_by_user_id which is a DB UUID)
    if (!permissionService.canClaimWorkOrder(dbUser.id, workOrder)) {
      await interaction.editReply('This work order is already claimed by someone else.');
      return;
    }

    const updated = await workorderService.claimWorkOrder(workOrderId, dbUser.id, interaction.guildId!);
    if (!updated) {
      await interaction.editReply('Failed to claim work order.');
      return;
    }

    // Update Discord card
    await discordService.updateWorkOrderCard(updated, interaction.client, interaction.user.username);

    const embed = new EmbedBuilder()
      .setColor('#FFCC00')
      .setTitle('Work Order Claimed')
      .setDescription(`You have claimed "${workOrder.title}".`)
      .addFields({ name: 'ID', value: workOrder.id });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in wo-claim command:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    } else {
      await interaction.editReply('An error occurred while claiming the work order.');
    }
  }
}
