/**
 * Work Order category enumeration.
 * Kept for backward-compatibility with code that references these
 * values. New work orders use subsystem_id instead.
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
  CANCELLED = 'CANCELLED',
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
  CANCEL = 'CANCEL',
  CLEAR = 'CLEAR',
  RECOVER = 'RECOVER',
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
 * A subsystem is a guild-scoped category that admins can
 * create, rename, reorder, and delete from the dashboard.
 */
export interface Subsystem {
  id: string;
  guild_id: string;
  name: string;
  display_name: string;
  emoji: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Work Order entity.
 * After the subsystems migration the `category` column is removed
 * from the database and replaced by `subsystem_id`.
 */
export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  subsystem_id: string;
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
  cad_link: string | null;
  notify_user_ids: string[];
  notify_role_ids: string[];
  created_at: string;
  updated_at: string;

  /** Populated via a Supabase join when needed */
  subsystem?: Subsystem;
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
