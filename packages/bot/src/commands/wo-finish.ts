import { ChatInputCommandInteraction } from 'discord.js';
import { WorkOrderStatus, AuditAction } from '@workorder/shared';
import * as workorderService from '../services/workorder.service.js';
import * as permissionService from '../services/permission.service.js';
import * as discordService from '../services/discord.service.js';
import { logAction } from '../services/audit.service.js';
import { getOrCreateUser } from '../services/user.service.js';

/**
 * Mark a work order as finished.
 * The person who claimed it can finish it, and admins can finish
 * any work order regardless of who claimed it.
 */
export async function handleFinish(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const workOrderId = interaction.options.getString('id', true);

    const workOrder = await workorderService.getWorkOrderById(workOrderId);
    if (!workOrder) {
      await interaction.editReply('Work order not found.');
      return;
    }

    if (workOrder.status === WorkOrderStatus.DONE) {
      await interaction.editReply('This work order is already finished.');
      return;
    }

    if (workOrder.is_deleted) {
      await interaction.editReply('This work order has been removed.');
      return;
    }

    const dbUser = await getOrCreateUser(
      interaction.user.id,
      interaction.user.username,
      interaction.user.displayAvatarURL()
    );
    if (!dbUser) {
      await interaction.editReply('Failed to finish work order: could not resolve user.');
      return;
    }

    // Claimers can finish their own work orders, admins can finish any
    const isClaimer = workOrder.claimed_by_user_id === dbUser.id;
    const isAdmin = await permissionService.getUserRole(
      interaction.user.id,
      interaction.guildId!,
      interaction.client
    );

    if (!isClaimer && isAdmin !== 'ADMIN') {
      await interaction.editReply(
        'You do not have permission to finish this work order. ' +
        'Only the person who claimed it or an admin can mark it as finished.'
      );
      return;
    }

    // Update status to DONE
    const updated = await workorderService.updateWorkOrder(
      workOrderId,
      { status: WorkOrderStatus.DONE },
      dbUser.id,
      interaction.guildId!
    );

    if (!updated) {
      await interaction.editReply('Failed to mark work order as finished.');
      return;
    }

    // Log status change for audit trail
    await logAction(interaction.guildId!, workOrderId, dbUser.id, AuditAction.STATUS_CHANGE, {
      from: WorkOrderStatus.OPEN,
      to: WorkOrderStatus.DONE,
    });

    // Update the card in the work orders channel so it reflects the new state
    await discordService.updateWorkOrderCard(updated, interaction.client);

    // Show the finished card to the user
    const embed = discordService.createWorkOrderEmbed(updated, undefined, undefined);
    await interaction.editReply({ embeds: [embed], components: [] });
  } catch (error) {
    console.error('Error in wo-finish command:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred while finishing the work order.', ephemeral: true });
    } else {
      await interaction.editReply('An error occurred while finishing the work order.');
    }
  }
}
