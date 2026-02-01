import { ButtonInteraction } from 'discord.js';
import * as workorderService from '../services/workorder.service.js';
import * as permissionService from '../services/permission.service.js';
import * as discordService from '../services/discord.service.js';
import { getOrCreateUser } from '../services/user.service.js';

export async function handleUnclaimButton(interaction: ButtonInteraction): Promise<void> {
  try {
    await interaction.deferUpdate();

    const workOrderId = interaction.customId.replace('unclaim-', '');

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

    // Check permission: claimer can unclaim, admin can unclaim anyone
    const canUnclaim = await permissionService.canUnclaimWorkOrder(
      interaction.user.id,
      dbUser.id,
      workOrder,
      interaction.guildId!,
      interaction.client
    );

    if (!canUnclaim) {
      await interaction.followUp({ content: 'You do not have permission to unclaim this work order.', ephemeral: true });
      return;
    }

    const updated = await workorderService.unclaimWorkOrder(workOrderId, dbUser.id, interaction.guildId!);
    if (!updated) {
      await interaction.followUp({ content: 'Failed to unclaim work order.', ephemeral: true });
      return;
    }

    // Re-render the embed and buttons
    const embed = discordService.createWorkOrderEmbed(updated);
    const buttons = discordService.createWorkOrderButtons(updated);
    const components = buttons.components.length > 0 ? [buttons] : [];

    await interaction.editReply({ embeds: [embed], components });
  } catch (error) {
    console.error('Error in unclaim button handler:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    }
  }
}
