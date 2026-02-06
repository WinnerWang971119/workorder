'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { clearWorkOrdersAction, recoverWorkOrdersAction, getClearStatusAction } from '@/lib/actions/workorder-actions'

interface Subsystem {
  id: string
  guild_id: string
  name: string
  display_name: string
  emoji: string
  color: string
  sort_order: number
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [guildId, setGuildId] = useState('')
  const [adminRoles, setAdminRoles] = useState('')
  const [memberRoles, setMemberRoles] = useState('')
  const [channelId, setChannelId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Subsystem state
  const [subsystems, setSubsystems] = useState<Subsystem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ name: '', display_name: '', emoji: '', color: '#808080' })
  const [subsystemSaving, setSubsystemSaving] = useState(false)

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

  const loadSubsystems = useCallback(async (gid: string) => {
    if (!gid) return
    const { data } = await supabase
      .from('subsystems')
      .select('*')
      .eq('guild_id', gid)
      .order('sort_order', { ascending: true })
    setSubsystems(data || [])
  }, [supabase])

  const loadClearStatus = useCallback(async () => {
    const status = await getClearStatusAction()
    setPendingClear(status)
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        // Load existing guild configs (show the first one for now)
        const { data: configs, error } = await supabase
          .from('guild_configs')
          .select('*')
          .limit(1)

        if (!error && configs && configs.length > 0) {
          const config = configs[0]
          setGuildId(config.guild_id)
          setAdminRoles((config.admin_role_ids || []).join(', '))
          setMemberRoles((config.member_role_ids || []).join(', '))
          setChannelId(config.work_orders_channel_id || '')
          await loadSubsystems(config.guild_id)
          await loadClearStatus()
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase, router, loadSubsystems, loadClearStatus])

  const handleSave = async () => {
    if (!guildId.trim()) {
      setMessage({ text: 'Guild ID is required.', type: 'error' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const adminRoleIds = adminRoles.split(',').map((s) => s.trim()).filter(Boolean)
      const memberRoleIds = memberRoles.split(',').map((s) => s.trim()).filter(Boolean)

      const { error } = await supabase
        .from('guild_configs')
        .upsert(
          {
            guild_id: guildId.trim(),
            admin_role_ids: adminRoleIds,
            member_role_ids: memberRoleIds,
            work_orders_channel_id: channelId.trim() || null,
          },
          { onConflict: 'guild_id' }
        )

      if (error) {
        console.error('Error saving config:', error)
        setMessage({ text: 'Failed to save configuration.', type: 'error' })
      } else {
        setMessage({ text: 'Configuration saved successfully.', type: 'success' })
        await loadSubsystems(guildId.trim())
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage({ text: 'An unexpected error occurred.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // --- Subsystem CRUD ---

  const openCreateForm = () => {
    setEditingId(null)
    setFormData({ name: '', display_name: '', emoji: '', color: '#808080' })
    setShowForm(true)
  }

  const openEditForm = (sub: Subsystem) => {
    setEditingId(sub.id)
    setFormData({
      name: sub.name,
      display_name: sub.display_name,
      emoji: sub.emoji,
      color: sub.color,
    })
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
  }

  const handleSubsystemSave = async () => {
    if (!formData.name.trim() || !formData.display_name.trim()) {
      setMessage({ text: 'Subsystem name and display name are required.', type: 'error' })
      return
    }

    setSubsystemSaving(true)
    setMessage(null)

    try {
      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('subsystems')
          .update({
            name: formData.name.trim().toUpperCase(),
            display_name: formData.display_name.trim(),
            emoji: formData.emoji.trim(),
            color: formData.color.trim(),
          })
          .eq('id', editingId)

        if (error) {
          setMessage({ text: `Failed to update subsystem: ${error.message}`, type: 'error' })
        } else {
          setMessage({ text: 'Subsystem updated.', type: 'success' })
        }
      } else {
        // Create new
        const nextOrder = subsystems.length > 0
          ? Math.max(...subsystems.map((s) => s.sort_order)) + 1
          : 1

        const { error } = await supabase
          .from('subsystems')
          .insert({
            guild_id: guildId,
            name: formData.name.trim().toUpperCase(),
            display_name: formData.display_name.trim(),
            emoji: formData.emoji.trim(),
            color: formData.color.trim(),
            sort_order: nextOrder,
          })

        if (error) {
          setMessage({ text: `Failed to create subsystem: ${error.message}`, type: 'error' })
        } else {
          setMessage({ text: 'Subsystem created.', type: 'success' })
        }
      }

      setShowForm(false)
      setEditingId(null)
      await loadSubsystems(guildId)
    } catch (error) {
      console.error('Error:', error)
      setMessage({ text: 'An unexpected error occurred.', type: 'error' })
    } finally {
      setSubsystemSaving(false)
    }
  }

  const handleSubsystemDelete = async (id: string) => {
    if (!confirm('Delete this subsystem? Work orders using it will not be affected.')) return

    setMessage(null)
    const { error } = await supabase.from('subsystems').delete().eq('id', id)
    if (error) {
      setMessage({
        text: 'Cannot delete: this subsystem is in use by existing work orders. Rename it instead.',
        type: 'error',
      })
    } else {
      setMessage({ text: 'Subsystem deleted.', type: 'success' })
      await loadSubsystems(guildId)
    }
  }

  const moveSubsystem = async (id: string, direction: 'up' | 'down') => {
    const idx = subsystems.findIndex((s) => s.id === id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= subsystems.length) return

    const a = subsystems[idx]
    const b = subsystems[swapIdx]

    await Promise.all([
      supabase.from('subsystems').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('subsystems').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])

    await loadSubsystems(guildId)
  }

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

  const getHoursRemaining = () => {
    if (!pendingClear.clearedAt) return 0
    const clearedTime = new Date(pendingClear.clearedAt).getTime()
    const deadline = clearedTime + 24 * 60 * 60 * 1000
    const remaining = Math.max(0, deadline - Date.now())
    return Math.ceil(remaining / (60 * 60 * 1000))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={() => router.push('/workorders')} variant="outline" size="sm">
              Back
            </Button>
          </div>
        </div>
      </header>

      <main className="p-8">
        <div className="max-w-2xl space-y-8">

          {/* Notification banner */}
          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20'
                  : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* ---- Guild Configuration ---- */}
          <div className="border border-border rounded-lg p-6 space-y-6 bg-card">
            <h2 className="text-lg font-semibold text-foreground">Guild Configuration</h2>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Guild ID (Discord Server ID)
              </label>
              <input
                type="text"
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                placeholder="e.g. 1234567890123456789"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Admin Role IDs (comma-separated)
              </label>
              <input
                type="text"
                value={adminRoles}
                onChange={(e) => setAdminRoles(e.target.value)}
                placeholder="e.g. 111111111, 222222222"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Discord role IDs that grant admin permissions in the bot.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Member Role IDs (comma-separated)
              </label>
              <input
                type="text"
                value={memberRoles}
                onChange={(e) => setMemberRoles(e.target.value)}
                placeholder="e.g. 333333333, 444444444"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Discord role IDs that grant member permissions in the bot.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Work Orders Channel ID
              </label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="e.g. 555555555555555555"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The Discord channel where work order cards will be posted.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          {/* ---- Subsystems Management ---- */}
          <div className="border border-border rounded-lg p-6 space-y-6 bg-card">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Subsystems</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage the subsystem categories that appear in the Discord bot.
                </p>
              </div>
              <Button onClick={openCreateForm} size="sm" disabled={!guildId}>
                Add Subsystem
              </Button>
            </div>

            {!guildId && (
              <p className="text-sm text-muted-foreground">Save a Guild ID above to manage subsystems.</p>
            )}

            {/* Subsystem list */}
            {subsystems.length > 0 && (
              <div className="space-y-2">
                {subsystems.map((sub, idx) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between border border-border rounded-lg p-4 bg-background"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: sub.color }}
                      />
                      <div>
                        <div className="font-medium text-foreground">{sub.display_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{sub.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveSubsystem(sub.id, 'up')}
                        disabled={idx === 0}
                        className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title="Move up"
                      >
                        &uarr;
                      </button>
                      <button
                        onClick={() => moveSubsystem(sub.id, 'down')}
                        disabled={idx === subsystems.length - 1}
                        className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title="Move down"
                      >
                        &darr;
                      </button>
                      <Button size="sm" variant="outline" onClick={() => openEditForm(sub)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleSubsystemDelete(sub.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {guildId && subsystems.length === 0 && !showForm && (
              <p className="text-sm text-muted-foreground">
                No subsystems configured yet. Click &quot;Add Subsystem&quot; to create one.
              </p>
            )}

            {/* Create / Edit form */}
            {showForm && (
              <div className="border border-border bg-muted/50 rounded-lg p-4 space-y-4">
                <h3 className="font-medium text-foreground">
                  {editingId ? 'Edit Subsystem' : 'New Subsystem'}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Internal Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. DRIVETRAIN"
                      className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Stored as uppercase. Must be unique.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      placeholder="e.g. Drive Train"
                      className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Emoji
                    </label>
                    <input
                      type="text"
                      value={formData.emoji}
                      onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                      placeholder="e.g. Paste an emoji"
                      className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="h-9 w-12 rounded border border-input cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="flex-1 px-3 py-2 border border-input rounded-lg text-sm font-mono bg-background text-foreground"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={cancelForm}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSubsystemSave} disabled={subsystemSaving}>
                    {subsystemSaving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ---- Danger Zone ---- */}
          <div className="border-2 border-red-500/50 rounded-lg p-6 space-y-6 bg-card">
            <div>
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Irreversible actions. Cleared work orders are permanently deleted after 24 hours.
              </p>
            </div>

            {pendingClear.hasPending ? (
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
        </div>
      </main>
    </div>
  )
}
