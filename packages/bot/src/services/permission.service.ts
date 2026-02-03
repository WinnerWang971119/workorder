import { AppRole } from '@workorder/shared';
import { Client } from 'discord.js';
import { supabase } from '../supabase.js';
import type { WorkOrder } from '@workorder/shared';

/**
 * Get a user's highest role in a guild based on GuildConfig.
 * Requires the Discord client to fetch guild member data.
 */
export async function getUserRole(
  discordUserId: string,
  guildId: string,
  client: Client
): Promise<AppRole> {
  try {
    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    if (!guild) return AppRole.MEMBER;

    const member = await guild.members.fetch(discordUserId);
    if (!member) return AppRole.MEMBER;

    // Fetch guild config from database
    const { data: config, error } = await supabase
      .from('guild_configs')
      .select('admin_role_ids, member_role_ids')
      .eq('guild_id', guildId)
      .single();

    if (error || !config) {
      return AppRole.MEMBER;
    }

    // Check if user has any of the configured admin roles
    const adminRoleIds: string[] = config.admin_role_ids || [];
    const hasAdminRole = member.roles.cache.some((role) => adminRoleIds.includes(role.id));

    if (hasAdminRole) {
      return AppRole.ADMIN;
    }

    return AppRole.MEMBER;
  } catch (error) {
    console.error('Failed to get user role:', error);
    return AppRole.MEMBER;
  }
}

/**
 * Check if a Discord user can edit a work order.
 * Creator (by DB user ID) can edit their own; admins can edit any.
 */
export async function canEditWorkOrder(
  discordUserId: string,
  dbUserId: string,
  workOrder: WorkOrder,
  guildId: string,
  client: Client
): Promise<boolean> {
  // Creator can edit their own work orders (compare DB UUIDs)
  if (workOrder.created_by_user_id === dbUserId) {
    return true;
  }

  // Admins can edit any work order
  const role = await getUserRole(discordUserId, guildId, client);
  return role === AppRole.ADMIN;
}

/**
 * Check if a Discord user can remove a work order (admin only)
 */
export async function canRemoveWorkOrder(
  discordUserId: string,
  guildId: string,
  client: Client
): Promise<boolean> {
  const role = await getUserRole(discordUserId, guildId, client);
  return role === AppRole.ADMIN;
}

/**
 * Check if a Discord user can assign a work order (admin only)
 */
export async function canAssignWorkOrder(
  discordUserId: string,
  guildId: string,
  client: Client
): Promise<boolean> {
  const role = await getUserRole(discordUserId, guildId, client);
  return role === AppRole.ADMIN;
}

/**
 * Check if a DB user can claim a work order.
 * Cannot claim if already claimed by someone else.
 */
export function canClaimWorkOrder(dbUserId: string, workOrder: WorkOrder): boolean {
  if (workOrder.claimed_by_user_id && workOrder.claimed_by_user_id !== dbUserId) {
    return false;
  }
  return true;
}

/**
 * Check if a Discord user can cancel a work order.
 * The creator or an admin can cancel.
 */
export async function canCancelWorkOrder(
  discordUserId: string,
  dbUserId: string,
  workOrder: WorkOrder,
  guildId: string,
  client: Client
): Promise<boolean> {
  if (workOrder.created_by_user_id === dbUserId) {
    return true;
  }
  const role = await getUserRole(discordUserId, guildId, client);
  return role === AppRole.ADMIN;
}

/**
 * Check if a user can unclaim a work order.
 * The claimer themselves or an admin can unclaim.
 */
export async function canUnclaimWorkOrder(
  discordUserId: string,
  dbUserId: string,
  workOrder: WorkOrder,
  guildId: string,
  client: Client
): Promise<boolean> {
  // User can unclaim if they are the one who claimed it (compare DB UUIDs)
  if (workOrder.claimed_by_user_id === dbUserId) {
    return true;
  }

  // Admin can unclaim anyone's claim
  const role = await getUserRole(discordUserId, guildId, client);
  return role === AppRole.ADMIN;
}
