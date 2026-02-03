import { ButtonInteraction } from 'discord.js';
import { WorkOrderStatus, AuditAction, AppRole } from '@workorder/shared';
import * as workorderService from '../services/workorder.service.js';
import * as discordService from '../services/discord.service.js';
import * as permissionService from '../services/permission.service.js';
import { logAction } from '../services/audit.service.js';
import { getOrCreateUser } from '../services/user.service.js';

/**
 * Handle the Cancel button click on a work order card.
 * The creator of the work order or an admin can cancel it.
 */
export async function handleCancelButton(interaction: ButtonInteraction): Promise<void> {
  try {
    await interaction.deferUpdate();

    const workOrderId = interaction.customId.replace('cancel-', '');

    const workOrder = await workorderService.getWorkOrderById(workOrderId);
    if (!workOrder) {
      await interaction.followUp({ content: 'Work order not found.', ephemeral: true });
      return;
    }

    if (workOrder.status !== WorkOrderStatus.OPEN || workOrder.is_deleted) {
      await interaction.followUp({ content: 'This work order cannot be cancelled.', ephemeral: true });
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

    // Permission: creator or admin
    const isCreator = workOrder.created_by_user_id === dbUser.id;
    if (!isCreator) {
      const role = await permissionService.getUserRole(interaction.user.id, interaction.guildId!, interaction.client);
      if (role !== AppRole.ADMIN) {
        await interaction.followUp({
          content: 'Only the creator or an admin can cancel this work order.',
          ephemeral: true,
        });
        return;
      }
    }

    // Update status to CANCELLED
    const updated = await workorderService.updateWorkOrder(
      workOrderId,
      { status: WorkOrderStatus.CANCELLED },
      dbUser.id,
      interaction.guildId!
    );

    if (!updated) {
      await interaction.followUp({ content: 'Failed to cancel work order.', ephemeral: true });
      return;
    }

    // Log the cancellation as a dedicated CANCEL action
    await logAction(interaction.guildId!, workOrderId, dbUser.id, AuditAction.CANCEL, {
      from: WorkOrderStatus.OPEN,
      to: WorkOrderStatus.CANCELLED,
    });

    // Re-render the embed (buttons will be empty for CANCELLED status)
    const embed = discordService.createWorkOrderEmbed(updated);
    const buttons = discordService.createWorkOrderButtons(updated);
    const components = buttons.components.length > 0 ? [buttons] : [];

    await interaction.editReply({ embeds: [embed], components });
  } catch (error) {
    console.error('Error in cancel button handler:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    }
  }
}
