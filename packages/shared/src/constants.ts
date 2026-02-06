import { WorkOrderStatus, AuditAction } from './types/workorder.js';
import type { WorkOrder } from './types/workorder.js';

/**
 * Status labels for display
 */
export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.OPEN]: 'Open',
  [WorkOrderStatus.DONE]: 'Done',
  [WorkOrderStatus.CANCELLED]: 'Cancelled',
};

/**
 * Status colors for UI display
 */
export const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.OPEN]: '#FFCC00',
  [WorkOrderStatus.DONE]: '#00AA00',
  [WorkOrderStatus.CANCELLED]: '#808080',
};

/**
 * Priority levels
 */
export const PRIORITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

/**
 * Priority labels for display
 */
export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

/**
 * Priority emojis for visual display in Discord
 */
export const PRIORITY_EMOJIS: Record<string, string> = {
  LOW: '\uD83D\uDFE2',
  MEDIUM: '\uD83D\uDFE1',
  HIGH: '\uD83D\uDD34',
};

/**
 * Priority-based embed colors for more nuanced visual feedback
 */
export const PRIORITY_COLORS: Record<string, number> = {
  LOW: 0x95E1D3,
  MEDIUM: 0xFFD93D,
  HIGH: 0xFF6B6B,
};

/**
 * Derive a human-friendly display status from work order state.
 * Uses claimed_by_user_id and status fields to determine one of
 * three display states: Unclaimed, Claimed, or Finished.
 */
export function getDisplayStatus(workOrder: WorkOrder): string {
  if (workOrder.status === WorkOrderStatus.CANCELLED) return 'Cancelled';
  if (workOrder.status === WorkOrderStatus.DONE) return '\u2705 Finished';
  if (workOrder.claimed_by_user_id) return '\uD83D\uDC64 Claimed';
  return '\uD83D\uDCCB Unclaimed';
}

/**
 * Pick an embed color based on work order state.
 * Finished work orders are always green. Otherwise the color
 * reflects priority so urgent items stand out visually.
 */
export function getEmbedColor(workOrder: WorkOrder): number {
  if (workOrder.status === WorkOrderStatus.CANCELLED) return 0x808080;
  if (workOrder.status === WorkOrderStatus.DONE) return 0x00AA00;
  if (workOrder.claimed_by_user_id) return 0x3498DB;
  return PRIORITY_COLORS[workOrder.priority] ?? 0xFFCC00;
}

/**
 * Audit action labels for display
 */
export const ACTION_LABELS: Record<AuditAction, string> = {
  [AuditAction.CREATE]: 'Created',
  [AuditAction.EDIT]: 'Edited',
  [AuditAction.REMOVE]: 'Removed',
  [AuditAction.ASSIGN]: 'Assigned',
  [AuditAction.CLAIM]: 'Claimed',
  [AuditAction.UNCLAIM]: 'Unclaimed',
  [AuditAction.STATUS_CHANGE]: 'Status Changed',
  [AuditAction.CANCEL]: 'Cancelled',
  [AuditAction.CLEAR]: 'Cleared',
  [AuditAction.RECOVER]: 'Recovered',
};
