import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CATEGORY_LABELS } from '@workorder/shared';
import * as workorderService from '../services/workorder.service.js';
import { supabase } from '../supabase.js';

export async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const workOrders = await workorderService.listUnfinishedWorkOrders(interaction.guildId!);

    if (workOrders.length === 0) {
      await interaction.editReply('No unfinished work orders found.');
      return;
    }

    // Collect all unique user IDs so we can resolve display names
    const userIds = new Set<string>();
    workOrders.forEach((wo) => {
      if (wo.claimed_by_user_id) userIds.add(wo.claimed_by_user_id);
    });

    // Fetch display names for referenced users
    const userMap = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, display_name')
        .in('id', Array.from(userIds));

      users?.forEach((u) => userMap.set(u.id, u.display_name));
    }

    // Show top 10
    const displayed = workOrders.slice(0, 10);

    let description = '**Unfinished Work Orders:**\n\n';
    displayed.forEach((wo, idx) => {
      description += `**${idx + 1}.** ${wo.title} (${CATEGORY_LABELS[wo.category]})\n`;
      description += `   ID: \`${wo.id}\`\n`;
      description += `   Status: ${wo.status} | Priority: ${wo.priority}\n`;
      if (wo.claimed_by_user_id) {
        const name = userMap.get(wo.claimed_by_user_id) || 'Unknown';
        description += `   Claimed by: ${name}\n`;
      }
      description += '\n';
    });

    if (workOrders.length > 10) {
      description += `... and ${workOrders.length - 10} more. View all in the dashboard.`;
    }

    const embed = new EmbedBuilder()
      .setColor('#FFCC00')
      .setTitle('Work Orders')
      .setDescription(description);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in wo-list command:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    } else {
      await interaction.editReply('An error occurred while fetching work orders.');
    }
  }
}
