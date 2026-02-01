import { WorkOrderCategory, WorkOrderStatus, AuditAction } from './types/workorder.js';

/**
 * Category labels for display
 */
export const CATEGORY_LABELS: Record<WorkOrderCategory, string> = {
  [WorkOrderCategory.MECH]: 'Mechanical',
  [WorkOrderCategory.ELECTRICAL]: 'Electrical',
  [WorkOrderCategory.SOFTWARE]: 'Software',
  [WorkOrderCategory.GENERAL]: 'General',
};

/**
 * Status labels for display
 */
export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.OPEN]: 'Open',
  [WorkOrderStatus.DONE]: 'Done',
};

/**
 * Status colors for UI display
 */
export const STATUS_COLORS: Record<WorkOrderStatus, string> = {
  [WorkOrderStatus.OPEN]: '#FFCC00', // Yellow
  [WorkOrderStatus.DONE]: '#00AA00', // Green
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
};
