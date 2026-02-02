'use server'

import { createClient } from '@/lib/supabase/server'
import { AuditAction } from '@workorder/shared'

interface ActionResult {
  success: boolean
  error?: string
}

/**
 * Helper: get the current user's Supabase ID from the server-side session.
 */
async function getCurrentUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Helper: get the current user's Discord roles and guild ID from metadata.
 */
async function getCurrentUserMeta() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const meta = user.user_metadata || {}
  return {
    userId: user.id,
    discordRoles: (meta.discord_roles || []) as string[],
    guildId: (meta.discord_guild_id || '') as string,
  }
}

/**
 * Helper: check if the user is an admin for their guild.
 */
async function checkAdmin() {
  const supabase = await createClient()
  const meta = await getCurrentUserMeta()
  if (!meta) return { isAdmin: false, userId: '', supabase }

  const { data: config } = await supabase
    .from('guild_configs')
    .select('admin_role_ids')
    .eq('guild_id', meta.guildId)
    .single()

  const adminRoleIds: string[] = config?.admin_role_ids || []
  const userIsAdmin = meta.discordRoles.some((role: string) => adminRoleIds.includes(role))

  return { isAdmin: userIsAdmin, userId: meta.userId, guildId: meta.guildId, supabase }
}

/**
 * Helper: insert an audit log entry.
 */
async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  guildId: string,
  workOrderId: string,
  actorUserId: string,
  action: AuditAction,
  meta: Record<string, unknown> = {}
) {
  await supabase.from('audit_logs').insert({
    guild_id: guildId,
    work_order_id: workOrderId,
    actor_user_id: actorUserId,
    action,
    meta,
  })
}

/**
 * Claim a work order. Any authenticated user can claim if the work order
 * is OPEN and not already claimed by someone else.
 */
export async function claimWorkOrderAction(workOrderId: string): Promise<ActionResult> {
  const userId = await getCurrentUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  // Fetch the work order to check current state
  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }
  if (wo.status !== 'OPEN') return { success: false, error: 'Work order is not open' }
  if (wo.claimed_by_user_id && wo.claimed_by_user_id !== userId) {
    return { success: false, error: 'Already claimed by another user' }
  }
  if (wo.claimed_by_user_id === userId) {
    return { success: false, error: 'You already claimed this work order' }
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ claimed_by_user_id: userId })
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to claim work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.CLAIM)
  return { success: true }
}

/**
 * Unclaim a work order. The claimer or an admin can unclaim.
 */
export async function unclaimWorkOrderAction(workOrderId: string): Promise<ActionResult> {
  const { isAdmin, userId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }
  if (wo.status !== 'OPEN') return { success: false, error: 'Work order is not open' }
  if (!wo.claimed_by_user_id) return { success: false, error: 'Work order is not claimed' }
  if (wo.claimed_by_user_id !== userId && !isAdmin) {
    return { success: false, error: 'You can only unclaim your own work orders' }
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ claimed_by_user_id: null })
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to unclaim work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.UNCLAIM)
  return { success: true }
}

/**
 * Mark a work order as done. The claimer, assignee, or an admin can finish.
 */
export async function finishWorkOrderAction(workOrderId: string): Promise<ActionResult> {
  const { isAdmin, userId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }
  if (wo.status !== 'OPEN') return { success: false, error: 'Work order is already done' }

  const canFinish =
    wo.claimed_by_user_id === userId ||
    wo.assigned_to_user_id === userId ||
    isAdmin

  if (!canFinish) {
    return { success: false, error: 'You do not have permission to finish this work order' }
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ status: 'DONE' })
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to finish work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.STATUS_CHANGE, {
    old_status: 'OPEN',
    new_status: 'DONE',
  })
  return { success: true }
}

/**
 * Assign a work order to a user. Admin only.
 */
export async function assignWorkOrderAction(
  workOrderId: string,
  assigneeId: string
): Promise<ActionResult> {
  const { isAdmin, userId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!isAdmin) return { success: false, error: 'Admin permission required' }

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ assigned_to_user_id: assigneeId })
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to assign work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.ASSIGN, {
    assigned_to: assigneeId,
  })
  return { success: true }
}

/**
 * Remove (soft-delete) a work order. Admin only.
 */
export async function removeWorkOrderAction(workOrderId: string): Promise<ActionResult> {
  const { isAdmin, userId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!isAdmin) return { success: false, error: 'Admin permission required' }

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ is_deleted: true })
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to remove work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.REMOVE)
  return { success: true }
}

/**
 * Edit a work order's fields. Creator or admin can edit.
 */
export async function updateWorkOrderAction(
  workOrderId: string,
  updates: {
    title?: string
    description?: string
    priority?: string
    subsystem_id?: string
  }
): Promise<ActionResult> {
  const { isAdmin, userId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }

  const canEditWo = wo.created_by_user_id === userId || isAdmin
  if (!canEditWo) {
    return { success: false, error: 'You do not have permission to edit this work order' }
  }

  // Only include fields that are actually provided
  const updateData: Record<string, unknown> = {}
  if (updates.title !== undefined) updateData.title = updates.title
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.priority !== undefined) updateData.priority = updates.priority
  if (updates.subsystem_id !== undefined) updateData.subsystem_id = updates.subsystem_id

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'No changes provided' }
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update(updateData)
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to update work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.EDIT, {
    changes: updateData,
  })
  return { success: true }
}
