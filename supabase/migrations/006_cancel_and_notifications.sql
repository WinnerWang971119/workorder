-- Migration: Add CANCELLED status, CANCEL audit action, and notification columns
-- Allows work orders to be cancelled (distinct from soft-delete) and stores
-- Discord user/role IDs that should be mentioned when a work order is created.

-- 1. Expand the status check constraint to include CANCELLED
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;
ALTER TABLE work_orders ADD CONSTRAINT work_orders_status_check
  CHECK (status IN ('OPEN', 'DONE', 'CANCELLED'));

-- 2. Expand the audit action check constraint to include CANCEL
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN ('CREATE', 'EDIT', 'REMOVE', 'ASSIGN', 'CLAIM', 'UNCLAIM', 'STATUS_CHANGE', 'CANCEL'));

-- 3. Add notification target columns to work_orders
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS notify_user_ids TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS notify_role_ids TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 4. Composite index for common list query pattern (status + soft-delete filter)
CREATE INDEX IF NOT EXISTS idx_work_orders_status_deleted
  ON work_orders(status, is_deleted);
