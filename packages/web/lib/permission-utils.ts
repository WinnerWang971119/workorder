import type { WorkOrder } from '@workorder/shared'

/**
 * Check if user's Discord roles include any of the guild's admin role IDs.
 */
export function isAdmin(
  discordRoles: string[],
  adminRoleIds: string[]
): boolean {
  return discordRoles.some((role) => adminRoleIds.includes(role))
}

/**
 * Can the user claim this work order?
 * Only if OPEN and not already claimed by someone else.
 */
export function canClaim(
  userId: string,
  workOrder: WorkOrder
): boolean {
  if (workOrder.status !== 'OPEN') return false
  if (workOrder.claimed_by_user_id && workOrder.claimed_by_user_id !== userId) return false
  if (workOrder.claimed_by_user_id === userId) return false
  return true
}

/**
 * Can the user unclaim this work order?
 * The claimer themselves or an admin can unclaim.
 */
export function canUnclaim(
  userId: string,
  workOrder: WorkOrder,
  userIsAdmin: boolean
): boolean {
  if (workOrder.status !== 'OPEN') return false
  if (!workOrder.claimed_by_user_id) return false
  return workOrder.claimed_by_user_id === userId || userIsAdmin
}

/**
 * Can the user mark this work order as done?
 * The claimer, the assignee, or an admin can finish.
 */
export function canFinish(
  userId: string,
  workOrder: WorkOrder,
  userIsAdmin: boolean
): boolean {
  if (workOrder.status !== 'OPEN') return false
  return (
    workOrder.claimed_by_user_id === userId ||
    workOrder.assigned_to_user_id === userId ||
    userIsAdmin
  )
}

/**
 * Can the user edit this work order?
 * The creator or an admin can edit.
 */
export function canEdit(
  userId: string,
  workOrder: WorkOrder,
  userIsAdmin: boolean
): boolean {
  return workOrder.created_by_user_id === userId || userIsAdmin
}

/**
 * Can the user assign this work order?
 * Admin only.
 */
export function canAssign(userIsAdmin: boolean): boolean {
  return userIsAdmin
}

/**
 * Can the user remove (soft-delete) this work order?
 * Admin only.
 */
export function canRemove(userIsAdmin: boolean): boolean {
  return userIsAdmin
}

/**
 * Can the user cancel this work order?
 * Must be OPEN, and user must be the creator or an admin.
 */
export function canCancel(
  userId: string,
  workOrder: WorkOrder,
  userIsAdmin: boolean
): boolean {
  if (workOrder.status !== 'OPEN') return false
  return workOrder.created_by_user_id === userId || userIsAdmin
}
