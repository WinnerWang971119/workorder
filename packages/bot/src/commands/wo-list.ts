import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { PRIORITY_EMOJIS, getDisplayStatus } from '@workorder/shared';
import * as workorderService from '../services/workorder.service.js';
import { supabase } from '../supabase.js';

/**
 * The order in which priority groups appear in the list.
 * HIGH first so the most urgent items are always visible.
 */
const PRIORITY_ORDER = ['HIGH', 'MEDIUM', 'LOW'] as const;
const MAX_DISPLAY = 15;

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

    // Group work orders by priority so the list is scannable
    const grouped: Record<string, typeof workOrders> = {
      HIGH: [],
      MEDIUM: [],
      LOW: [],
    };
    workOrders.forEach((wo) => {
      const bucket = grouped[wo.priority];
      if (bucket) {
        bucket.push(wo);
      } else {
        grouped['MEDIUM'].push(wo);
      }
    });

    let description = '';
    let count = 0;

    for (const priority of PRIORITY_ORDER) {
      const items = grouped[priority];
      if (items.length === 0) continue;

      const emoji = PRIORITY_EMOJIS[priority] || '';
      description += `\n**${emoji} ${priority} PRIORITY (${items.length})**\n`;

      for (const wo of items) {
        if (count >= MAX_DISPLAY) break;

        const subEmoji = wo.subsystem?.emoji || '';
        const subLabel = wo.subsystem?.display_name || 'Unknown';
        const status = getDisplayStatus(wo);

        description += `> **${count + 1}.** ${wo.title} (${subEmoji} ${subLabel})\n`;
        description += `>  \`${wo.id}\`\n`;
        description += `>  ${status}`;
        if (wo.claimed_by_user_id) {
          const name = userMap.get(wo.claimed_by_user_id) || 'Unknown';
          description += ` by **${name}**`;
        }
        description += '\n\n';
        count++;
      }

      if (count >= MAX_DISPLAY) break;
    }

    const remaining = workOrders.length - count;
    if (remaining > 0) {
      description += `*... and ${remaining} more. View all in the dashboard.*`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`Work Orders (${workOrders.length})`)
      .setDescription(description)
      .setTimestamp();

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
