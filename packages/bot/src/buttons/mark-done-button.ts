import { ButtonInteraction } from 'discord.js';
import { WorkOrderStatus, AuditAction } from '@workorder/shared';
import * as workorderService from '../services/workorder.service.js';
import * as discordService from '../services/discord.service.js';
import { logAction } from '../services/audit.service.js';
import { getOrCreateUser } from '../services/user.service.js';

export async function handleMarkDoneButton(interaction: ButtonInteraction): Promise<void> {
  try {
    await interaction.deferUpdate();

    const workOrderId = interaction.customId.replace('done-', '');

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

    // Only the person who claimed it can mark it done (compare DB UUIDs)
    if (workOrder.claimed_by_user_id !== dbUser.id) {
      await interaction.followUp({ content: 'Only the person who claimed this work order can mark it done.', ephemeral: true });
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
      await interaction.followUp({ content: 'Failed to mark work order as done.', ephemeral: true });
      return;
    }

    // Log status change action separately for usage stats
    await logAction(interaction.guildId!, workOrderId, dbUser.id, AuditAction.STATUS_CHANGE, {
      from: WorkOrderStatus.OPEN,
      to: WorkOrderStatus.DONE,
    });

    // Re-render the embed (buttons will be empty for DONE status)
    const embed = discordService.createWorkOrderEmbed(updated, undefined, interaction.user.username);
    const buttons = discordService.createWorkOrderButtons(updated);
    const components = buttons.components.length > 0 ? [buttons] : [];

    await interaction.editReply({ embeds: [embed], components });
  } catch (error) {
    console.error('Error in mark done button handler:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    }
  }
}
