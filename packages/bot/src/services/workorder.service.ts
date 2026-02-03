import { WorkOrder, WorkOrderStatus, AuditAction } from '@workorder/shared';
import { supabase } from '../supabase.js';
import { logAction } from './audit.service.js';

/** Select expression that joins subsystem data onto a work order row */
const WO_SELECT = '*, subsystem:subsystems(*)';

/**
 * Create a new work order
 */
export async function createWorkOrder(
  data: {
    title: string;
    description?: string;
    subsystem_id: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    notify_user_ids?: string[];
    notify_role_ids?: string[];
  },
  createdByUserId: string,
  guildId: string
): Promise<WorkOrder | null> {
  try {
    const insertData: Record<string, unknown> = {
      title: data.title,
      description: data.description || '',
      subsystem_id: data.subsystem_id,
      priority: data.priority || 'MEDIUM',
      created_by_user_id: createdByUserId,
      discord_guild_id: guildId,
    };
    if (data.notify_user_ids) insertData.notify_user_ids = data.notify_user_ids;
    if (data.notify_role_ids) insertData.notify_role_ids = data.notify_role_ids;

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .insert(insertData)
      .select(WO_SELECT)
      .single();

    if (error) {
      console.error('Failed to create work order:', error);
      return null;
    }

    // Log the action
    if (workOrder) {
      await logAction(guildId, workOrder.id, createdByUserId, AuditAction.CREATE, {
        title: data.title,
        subsystem_id: data.subsystem_id,
      });
    }

    return workOrder;
  } catch (error) {
    console.error('Error creating work order:', error);
    return null;
  }
}

/**
 * Update a work order
 */
export async function updateWorkOrder(
  id: string,
  updates: Partial<WorkOrder>,
  actorId: string,
  guildId: string
): Promise<WorkOrder | null> {
  try {
    // Strip the joined subsystem object before sending to Supabase
    const { subsystem: _ignored, ...cleanUpdates } = updates as any;

    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .update(cleanUpdates)
      .eq('id', id)
      .select(WO_SELECT)
      .single();

    if (error) {
      console.error('Failed to update work order:', error);
      return null;
    }

    // Log the action
    if (workOrder) {
      await logAction(guildId, id, actorId, AuditAction.EDIT, cleanUpdates);
    }

    return workOrder;
  } catch (error) {
    console.error('Error updating work order:', error);
    return null;
  }
}

/**
 * Soft delete a work order
 */
export async function softDeleteWorkOrder(
  id: string,
  actorId: string,
  guildId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('work_orders')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) {
      console.error('Failed to soft delete work order:', error);
      return;
    }

    // Log the action
    await logAction(guildId, id, actorId, AuditAction.REMOVE, {});
  } catch (error) {
    console.error('Error soft deleting work order:', error);
  }
}

/**
 * Assign a work order to a user
 */
export async function assignWorkOrder(
  id: string,
  assigneeId: string,
  actorId: string,
  guildId: string
): Promise<WorkOrder | null> {
  try {
    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .update({ assigned_to_user_id: assigneeId })
      .eq('id', id)
      .select(WO_SELECT)
      .single();

    if (error) {
      console.error('Failed to assign work order:', error);
      return null;
    }

    // Log the action
    if (workOrder) {
      await logAction(guildId, id, actorId, AuditAction.ASSIGN, {
        assigned_to_user_id: assigneeId,
      });
    }

    return workOrder;
  } catch (error) {
    console.error('Error assigning work order:', error);
    return null;
  }
}

/**
 * Claim a work order
 */
export async function claimWorkOrder(
  id: string,
  userId: string,
  guildId: string
): Promise<WorkOrder | null> {
  try {
    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .update({ claimed_by_user_id: userId })
      .eq('id', id)
      .select(WO_SELECT)
      .single();

    if (error) {
      console.error('Failed to claim work order:', error);
      return null;
    }

    // Log the action
    if (workOrder) {
      await logAction(guildId, id, userId, AuditAction.CLAIM, {});
    }

    return workOrder;
  } catch (error) {
    console.error('Error claiming work order:', error);
    return null;
  }
}

/**
 * Unclaim a work order
 */
export async function unclaimWorkOrder(
  id: string,
  userId: string,
  guildId: string
): Promise<WorkOrder | null> {
  try {
    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .update({ claimed_by_user_id: null })
      .eq('id', id)
      .select(WO_SELECT)
      .single();

    if (error) {
      console.error('Failed to unclaim work order:', error);
      return null;
    }

    // Log the action
    if (workOrder) {
      await logAction(guildId, id, userId, AuditAction.UNCLAIM, {});
    }

    return workOrder;
  } catch (error) {
    console.error('Error unclaiming work order:', error);
    return null;
  }
}

/**
 * List unfinished work orders for a guild.
 * Joins subsystem data so callers have display_name and emoji.
 */
export async function listUnfinishedWorkOrders(guildId: string): Promise<WorkOrder[]> {
  try {
    const { data: workOrders, error } = await supabase
      .from('work_orders')
      .select(WO_SELECT)
      .eq('discord_guild_id', guildId)
      .eq('status', WorkOrderStatus.OPEN)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to list work orders:', error);
      return [];
    }

    return workOrders || [];
  } catch (error) {
    console.error('Error listing work orders:', error);
    return [];
  }
}

/**
 * Cancel a work order. Sets status to CANCELLED and logs the action.
 */
export async function cancelWorkOrder(
  id: string,
  actorId: string,
  guildId: string
): Promise<WorkOrder | null> {
  try {
    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .update({ status: WorkOrderStatus.CANCELLED })
      .eq('id', id)
      .select(WO_SELECT)
      .single();

    if (error) {
      console.error('Failed to cancel work order:', error);
      return null;
    }

    if (workOrder) {
      await logAction(guildId, id, actorId, AuditAction.CANCEL, {
        from: WorkOrderStatus.OPEN,
        to: WorkOrderStatus.CANCELLED,
      });
    }

    return workOrder;
  } catch (error) {
    console.error('Error cancelling work order:', error);
    return null;
  }
}

/**
 * Get a work order by ID, including joined subsystem data.
 */
export async function getWorkOrderById(id: string): Promise<WorkOrder | null> {
  try {
    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .select(WO_SELECT)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to get work order:', error);
      return null;
    }

    return workOrder;
  } catch (error) {
    console.error('Error getting work order:', error);
    return null;
  }
}
