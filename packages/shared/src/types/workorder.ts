/**
 * Work Order category enumeration
 */
export enum WorkOrderCategory {
  MECH = 'MECH',
  ELECTRICAL = 'ELECTRICAL',
  SOFTWARE = 'SOFTWARE',
  GENERAL = 'GENERAL',
}

/**
 * Work Order status enumeration
 */
export enum WorkOrderStatus {
  OPEN = 'OPEN',
  DONE = 'DONE',
}

/**
 * Audit action types
 */
export enum AuditAction {
  CREATE = 'CREATE',
  EDIT = 'EDIT',
  REMOVE = 'REMOVE',
  ASSIGN = 'ASSIGN',
  CLAIM = 'CLAIM',
  UNCLAIM = 'UNCLAIM',
  STATUS_CHANGE = 'STATUS_CHANGE',
}

/**
 * User entity in the system
 */
export interface User {
  id: string;
  discord_user_id: string;
  display_name: string;
  avatar_url: string | null;
  last_seen_at: string;
}

/**
 * Guild (Discord server) configuration
 */
export interface GuildConfig {
  guild_id: string;
  admin_role_ids: string[];
  member_role_ids: string[];
  work_orders_channel_id: string | null;
  timezone: string;
  updated_at: string;
}

/**
 * Work Order entity
 */
export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  category: WorkOrderCategory;
  status: WorkOrderStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  created_by_user_id: string;
  assigned_to_user_id: string | null;
  claimed_by_user_id: string | null;
  discord_message_id: string | null;
  discord_channel_id: string | null;
  discord_thread_id: string | null;
  discord_guild_id: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Audit log entry
 */
export interface AuditLog {
  id: string;
  guild_id: string;
  work_order_id: string;
  actor_user_id: string;
  action: AuditAction;
  meta: Record<string, unknown>;
  created_at: string;
}
