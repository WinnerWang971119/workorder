# Danger Zone: Clear Work Orders - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Danger Zone section to the admin page that bulk-clears work orders with a two-phase delete (soft-delete with 1-day recovery, then automatic hard-delete via pg_cron).

**Architecture:** New `cleared_at` column on `work_orders` tracks when a bulk clear happened. Server actions handle clear/recover operations. The admin page shows either a "clear" UI or a "recovery" UI based on whether pending cleared work orders exist. A pg_cron job hard-deletes expired rows hourly.

**Tech Stack:** Supabase PostgreSQL (migration + pg_cron), Next.js server actions, React client component (Tailwind CSS)

---

### Task 1: Add CLEAR and RECOVER to shared AuditAction enum

**Files:**
- Modify: `packages/shared/src/types/workorder.ts:25-34`
- Modify: `packages/shared/src/constants.ts:81-90`

**Step 1: Add enum values**

In `packages/shared/src/types/workorder.ts`, add two new values to the `AuditAction` enum:

```typescript
CLEAR = 'CLEAR',
RECOVER = 'RECOVER',
```

**Step 2: Add display labels**

In `packages/shared/src/constants.ts`, add to the `ACTION_LABELS` record:

```typescript
[AuditAction.CLEAR]: 'Cleared',
[AuditAction.RECOVER]: 'Recovered',
```

**Step 3: Build shared package**

Run: `pnpm shared:build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add packages/shared/src/types/workorder.ts packages/shared/src/constants.ts
git commit -m "feat(shared): add CLEAR and RECOVER audit actions"
```

---

### Task 2: Database migration - add cleared_at column and pg_cron job

**Files:**
- Create: `supabase/migrations/009_add_cleared_at_and_cron.sql`

**Step 1: Write the migration**

```sql
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
  'hard-delete-cleared-work-orders',   -- job name
  '0 * * * *',                          -- every hour at minute 0
  $$DELETE FROM work_orders
    WHERE cleared_at IS NOT NULL
      AND cleared_at < NOW() - INTERVAL '1 day'
      AND is_deleted = true$$
);
```

**Step 2: Apply migration**

Run the migration against your Supabase database via the Supabase dashboard SQL editor or CLI.

**Step 3: Commit**

```bash
git add supabase/migrations/009_add_cleared_at_and_cron.sql
git commit -m "feat(db): add cleared_at column and pg_cron hard-delete job"
```

---

### Task 3: Add server actions for clear, recover, and status check

**Files:**
- Modify: `packages/web/lib/actions/workorder-actions.ts` (append new actions at the end)

**Step 1: Add clearWorkOrdersAction**

Append to `workorder-actions.ts`:

```typescript
/**
 * Bulk soft-delete work orders by status. Admin only.
 * Sets is_deleted = true and cleared_at = NOW() so the pg_cron job
 * will hard-delete them after 1 day if not recovered.
 */
export async function clearWorkOrdersAction(
  statuses: string[]
): Promise<ActionResult & { count?: number }> {
  const { isAdmin, userId, guildId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!isAdmin) return { success: false, error: 'Admin permission required' }
  if (!guildId) return { success: false, error: 'No guild ID found' }
  if (statuses.length === 0) return { success: false, error: 'Select at least one status' }

  // Bulk update matching work orders
  const { data, error: updateErr } = await supabase
    .from('work_orders')
    .update({ is_deleted: true, cleared_at: new Date().toISOString() })
    .eq('discord_guild_id', guildId)
    .eq('is_deleted', false)
    .in('status', statuses)
    .select('id')

  if (updateErr) return { success: false, error: 'Failed to clear work orders' }

  const count = data?.length ?? 0

  // Log a single audit entry for the bulk operation (no specific work_order_id)
  if (count > 0) {
    await supabase.from('audit_logs').insert({
      guild_id: guildId,
      work_order_id: data![0].id, // reference the first cleared WO
      actor_user_id: userId,
      action: 'CLEAR',
      meta: { statuses, count },
    })
  }

  return { success: true, count }
}
```

**Step 2: Add recoverWorkOrdersAction**

```typescript
/**
 * Recover all bulk-cleared work orders. Admin only.
 * Restores is_deleted = false and clears the cleared_at timestamp.
 */
export async function recoverWorkOrdersAction(): Promise<ActionResult & { count?: number }> {
  const { isAdmin, userId, guildId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!isAdmin) return { success: false, error: 'Admin permission required' }
  if (!guildId) return { success: false, error: 'No guild ID found' }

  const { data, error: updateErr } = await supabase
    .from('work_orders')
    .update({ is_deleted: false, cleared_at: null })
    .eq('discord_guild_id', guildId)
    .eq('is_deleted', true)
    .not('cleared_at', 'is', null)
    .select('id')

  if (updateErr) return { success: false, error: 'Failed to recover work orders' }

  const count = data?.length ?? 0

  if (count > 0) {
    await supabase.from('audit_logs').insert({
      guild_id: guildId,
      work_order_id: data![0].id,
      actor_user_id: userId,
      action: 'RECOVER',
      meta: { count },
    })
  }

  return { success: true, count }
}
```

**Step 3: Add getClearStatusAction**

```typescript
/**
 * Check if there are pending bulk-cleared work orders awaiting hard-delete.
 * Returns the count and the earliest cleared_at timestamp.
 */
export async function getClearStatusAction(): Promise<{
  hasPending: boolean
  count: number
  clearedAt: string | null
}> {
  const { isAdmin, guildId, supabase } = await checkAdmin()
  if (!isAdmin || !guildId) return { hasPending: false, count: 0, clearedAt: null }

  const { data, error } = await supabase
    .from('work_orders')
    .select('cleared_at')
    .eq('discord_guild_id', guildId)
    .eq('is_deleted', true)
    .not('cleared_at', 'is', null)
    .order('cleared_at', { ascending: true })
    .limit(1)

  if (error || !data || data.length === 0) {
    return { hasPending: false, count: 0, clearedAt: null }
  }

  // Get total count
  const { count } = await supabase
    .from('work_orders')
    .select('*', { count: 'exact', head: true })
    .eq('discord_guild_id', guildId)
    .eq('is_deleted', true)
    .not('cleared_at', 'is', null)

  return {
    hasPending: true,
    count: count ?? 0,
    clearedAt: data[0].cleared_at,
  }
}
```

**Step 4: Build web to check for type errors**

Run: `pnpm web:build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add packages/web/lib/actions/workorder-actions.ts
git commit -m "feat(web): add clear, recover, and status check server actions"
```

---

### Task 4: Add Danger Zone UI to admin page

**Files:**
- Modify: `packages/web/app/admin/page.tsx`

**Step 1: Add state variables**

After the existing state declarations (around line 35), add:

```typescript
// Danger zone state
const [clearStatuses, setClearStatuses] = useState<string[]>([])
const [clearing, setClearing] = useState(false)
const [recovering, setRecovering] = useState(false)
const [confirmText, setConfirmText] = useState('')
const [showConfirm, setShowConfirm] = useState(false)
const [pendingClear, setPendingClear] = useState<{
  hasPending: boolean
  count: number
  clearedAt: string | null
}>({ hasPending: false, count: 0, clearedAt: null })
```

**Step 2: Add data loading for clear status**

Import the server actions at the top of the file:

```typescript
import { clearWorkOrdersAction, recoverWorkOrdersAction, getClearStatusAction } from '@/lib/actions/workorder-actions'
```

Add a `loadClearStatus` function and call it in `useEffect` after `loadSubsystems`:

```typescript
const loadClearStatus = useCallback(async () => {
  const status = await getClearStatusAction()
  setPendingClear(status)
}, [])
```

In the `loadData` function inside `useEffect`, after `await loadSubsystems(config.guild_id)`, add:

```typescript
await loadClearStatus()
```

**Step 3: Add handler functions**

```typescript
const handleClear = async () => {
  if (confirmText !== 'CLEAR') return
  setClearing(true)
  setMessage(null)
  try {
    const result = await clearWorkOrdersAction(clearStatuses)
    if (result.success) {
      setMessage({ text: `${result.count} work order(s) cleared. You have 24 hours to recover.`, type: 'success' })
      setShowConfirm(false)
      setConfirmText('')
      setClearStatuses([])
      await loadClearStatus()
    } else {
      setMessage({ text: result.error || 'Failed to clear', type: 'error' })
    }
  } catch {
    setMessage({ text: 'An unexpected error occurred.', type: 'error' })
  } finally {
    setClearing(false)
  }
}

const handleRecover = async () => {
  setRecovering(true)
  setMessage(null)
  try {
    const result = await recoverWorkOrdersAction()
    if (result.success) {
      setMessage({ text: `${result.count} work order(s) recovered.`, type: 'success' })
      await loadClearStatus()
    } else {
      setMessage({ text: result.error || 'Failed to recover', type: 'error' })
    }
  } catch {
    setMessage({ text: 'An unexpected error occurred.', type: 'error' })
  } finally {
    setRecovering(false)
  }
}

const toggleStatus = (status: string) => {
  setClearStatuses((prev) =>
    prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
  )
}

// Calculate hours remaining until hard-delete
const getHoursRemaining = () => {
  if (!pendingClear.clearedAt) return 0
  const clearedTime = new Date(pendingClear.clearedAt).getTime()
  const deadline = clearedTime + 24 * 60 * 60 * 1000
  const remaining = Math.max(0, deadline - Date.now())
  return Math.ceil(remaining / (60 * 60 * 1000))
}
```

**Step 4: Add the Danger Zone JSX**

After the Subsystems Management section closing `</div>` (around line 499), add:

```jsx
{/* ---- Danger Zone ---- */}
<div className="border-2 border-red-500/50 rounded-lg p-6 space-y-6 bg-card">
  <div>
    <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
    <p className="text-sm text-muted-foreground mt-1">
      Irreversible actions. Cleared work orders are permanently deleted after 24 hours.
    </p>
  </div>

  {pendingClear.hasPending ? (
    /* Recovery mode */
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
          {pendingClear.count} work order(s) pending deletion.
          Hard delete in {getHoursRemaining()} hour(s).
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Cleared on {new Date(pendingClear.clearedAt!).toLocaleString()}
        </p>
      </div>
      <Button
        onClick={handleRecover}
        disabled={recovering}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        {recovering ? 'Recovering...' : 'Recover Work Orders'}
      </Button>
    </div>
  ) : (
    /* Clear mode */
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Select statuses to clear
        </label>
        <div className="flex gap-4">
          {['OPEN', 'DONE', 'CANCELLED'].map((status) => (
            <label key={status} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={clearStatuses.includes(status)}
                onChange={() => toggleStatus(status)}
                className="rounded border-input"
              />
              {status}
            </label>
          ))}
        </div>
      </div>

      {!showConfirm ? (
        <Button
          onClick={() => setShowConfirm(true)}
          disabled={clearStatuses.length === 0}
          variant="destructive"
        >
          Clear Work Orders
        </Button>
      ) : (
        <div className="space-y-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
          <p className="text-sm text-red-700 dark:text-red-400">
            Type <span className="font-mono font-bold">CLEAR</span> to confirm.
            This will soft-delete all {clearStatuses.join(', ')} work orders.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type CLEAR"
            className="w-full px-3 py-2 border border-red-500/30 rounded-lg text-sm bg-background text-foreground"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleClear}
              disabled={confirmText !== 'CLEAR' || clearing}
              variant="destructive"
            >
              {clearing ? 'Clearing...' : 'Confirm Clear'}
            </Button>
            <Button
              onClick={() => { setShowConfirm(false); setConfirmText('') }}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )}
</div>
```

**Step 5: Build and verify**

Run: `pnpm web:build`
Expected: Build succeeds with no errors.

**Step 6: Commit**

```bash
git add packages/web/app/admin/page.tsx
git commit -m "feat(web): add Danger Zone UI for bulk clear/recover work orders"
```

---

### Task 5: Update WorkOrder interface with cleared_at field

**Files:**
- Modify: `packages/shared/src/types/workorder.ts:80-103`

**Step 1: Add cleared_at to interface**

Add after the `is_deleted` field:

```typescript
cleared_at: string | null;
```

**Step 2: Build shared**

Run: `pnpm shared:build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add packages/shared/src/types/workorder.ts
git commit -m "feat(shared): add cleared_at field to WorkOrder interface"
```

---

### Task 6: Final build verification

**Step 1: Full build**

Run: `pnpm build`
Expected: All packages build successfully (shared, bot, web).

**Step 2: Commit all if any remaining changes**

Verify with `git status` that everything is committed.
