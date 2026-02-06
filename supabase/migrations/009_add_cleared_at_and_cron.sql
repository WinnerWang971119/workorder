-- Migration 009: Add cleared_at column and pg_cron hard-delete job
--
-- Supports the two-phase bulk clear feature:
-- 1. Soft-delete sets is_deleted = true AND cleared_at = NOW()
-- 2. After 1 day, pg_cron hard-deletes these rows permanently
-- 3. Recovery (within the grace period) sets is_deleted = false, cleared_at = NULL

-- Add the cleared_at timestamp to track when a work order was bulk-cleared
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ DEFAULT NULL;

-- Index for the cron job to efficiently find expired cleared rows
CREATE INDEX IF NOT EXISTS idx_work_orders_cleared_at
  ON work_orders (cleared_at)
  WHERE cleared_at IS NOT NULL AND is_deleted = true;

-- Enable pg_cron extension (must also be enabled in Supabase dashboard > Extensions)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule hourly cleanup: hard-delete work orders cleared more than 1 day ago.
-- Uses cron.schedule which is idempotent if the job name already exists.
SELECT cron.schedule(
  'hard-delete-cleared-work-orders',
  '0 * * * *',
  $$DELETE FROM work_orders
    WHERE cleared_at IS NOT NULL
      AND cleared_at < NOW() - INTERVAL '1 day'
      AND is_deleted = true$$
);
