import { ButtonInteraction } from 'discord.js';
import * as workorderService from '../services/workorder.service.js';
import * as permissionService from '../services/permission.service.js';
import * as discordService from '../services/discord.service.js';
import { getOrCreateUser } from '../services/user.service.js';

export async function handleClaimButton(interaction: ButtonInteraction): Promise<void> {
  try {
    await interaction.deferUpdate();

    const workOrderId = interaction.customId.replace('claim-', '');

    const workOrder = await workorderService.getWorkOrderById(workOrderId);
    if (!workOrder) {
      await interaction.followUp({ content: 'Work order not found.', ephemeral: true });
      return;
    }

    const dbUser = await getOrCreateUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.displayAvatarURL()
    );
    if (!dbUser) {
      await interaction.followUp({ content: 'Could not resolve user.', ephemeral: true });
      return;
    }

    // Compare DB UUIDs, not Discord IDs
    if (!permissionService.canClaimWorkOrder(dbUser.id, workOrder)) {
      await interaction.followUp({ content: 'This work order is already claimed by someone else.', ephemeral: true });
      return;
    }

    const updated = await workorderService.claimWorkOrder(workOrderId, dbUser.id, interaction.guildId!);
    if (!updated) {
      await interaction.followUp({ content: 'Failed to claim work order.', ephemeral: true });
      return;
    }

    // Re-render the embed and buttons on the existing message
    const embed = discordService.createWorkOrderEmbed(updated, undefined, interaction.user.username);
    const buttons = discordService.createWorkOrderButtons(updated);
    const components = buttons.components.length > 0 ? [buttons] : [];

    await interaction.editReply({ embeds: [embed], components });
  } catch (error) {
    console.error('Error in claim button handler:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    }
  }
}
