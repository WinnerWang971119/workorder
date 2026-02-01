import { AuditAction } from '@workorder/shared';
import { supabase } from '../supabase.js';

/**
 * Log an action to the audit log
 */
export async function logAction(
  guildId: string,
  workOrderId: string,
  actorUserId: string,
  action: AuditAction,
  meta: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      guild_id: guildId,
      work_order_id: workOrderId,
      actor_user_id: actorUserId,
      action,
      meta,
    });

    if (error) {
      console.error('Failed to log action:', error);
    }
  } catch (error) {
    console.error('Error logging action:', error);
  }
}
