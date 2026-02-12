# Danger Zone: Clear Work Orders - Design

## Summary

Add a "Danger Zone" section to the admin page that allows admins to bulk-clear work orders with a two-phase delete: soft-delete immediately with a 1-day grace period for recovery, then automatic hard-delete via pg_cron.

## Data Model Changes (Migration 009)

- Add `cleared_at TIMESTAMPTZ DEFAULT NULL` column to `work_orders`
- When bulk-cleared: `is_deleted = true`, `cleared_at = NOW()`
- When recovered: `is_deleted = false`, `cleared_at = NULL`
- Enable `pg_cron` extension
- Schedule hourly cron job: hard-delete rows where `cleared_at < NOW() - INTERVAL '1 day'` AND `is_deleted = true`
- Audit logs cascade-delete via existing FK constraint

## Admin Page UI

### Danger Zone Section (bottom of admin page)
- Red-bordered section with "Danger Zone" header
- Status filter checkboxes: OPEN, DONE, CANCELLED (at least one required)
- Red "Clear Work Orders" button
- Confirmation dialog requiring user to type "CLEAR"

### Recovery Mode (shown when pending clear exists)
- Replaces the clear UI
- Shows: "X work orders cleared on [date]. Hard delete in Y hours."
- Green "Recover" button to undo
- Automatically returns to clear UI after cron hard-deletes

### State Detection
- On page load, query for work orders with `cleared_at IS NOT NULL` and `is_deleted = true`
- If found: show recovery mode
- If not found: show clear UI

## Server Actions

### clearWorkOrdersAction(guildId, statuses[])
- Auth + admin permission check
- Bulk update: `SET is_deleted = true, cleared_at = NOW()`
- Filter: `discord_guild_id = guildId`, `status IN (statuses)`, `is_deleted = false`
- Log audit entry: action "CLEAR", meta includes status filter

### recoverWorkOrdersAction(guildId)
- Auth + admin permission check
- Bulk update: `SET is_deleted = false, cleared_at = NULL`
- Filter: `cleared_at IS NOT NULL`, `is_deleted = true`, `discord_guild_id = guildId`
- Log audit entry: action "RECOVER"

### getClearStatusAction(guildId)
- Returns count of cleared work orders and earliest `cleared_at` timestamp
- Used by UI to determine which mode to display

## Cron Job Details

- Extension: `pg_cron` (must be enabled in Supabase dashboard)
- Frequency: hourly (`0 * * * *`)
- Query: `DELETE FROM work_orders WHERE cleared_at IS NOT NULL AND cleared_at < NOW() - INTERVAL '1 day' AND is_deleted = true`
- Runs at database level (bypasses RLS, appropriate for system cleanup)
- Work orders created after the clear are unaffected (they have `cleared_at = NULL`)

## Audit Trail

New audit actions:
- `CLEAR` - logged once per bulk clear, meta: `{ statuses: [...], count: N }`
- `RECOVER` - logged once per recovery, meta: `{ count: N }`
