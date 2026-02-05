'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Subsystem, PRIORITY_LEVELS, PRIORITY_LABELS } from '@workorder/shared'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { createWorkOrderAction } from '@/lib/actions/workorder-actions'

export default function CreateWorkOrderPage() {
  const router = useRouter()
  const supabase = createClient()

  const [subsystems, setSubsystems] = useState<Subsystem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subsystemId, setSubsystemId] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [cadLink, setCadLink] = useState('')
  const [notifyUserRaw, setNotifyUserRaw] = useState('')
  const [notifyRoleRaw, setNotifyRoleRaw] = useState('')

  const loadSubsystems = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Get guild ID from session metadata to scope subsystems
      const meta = session.user.user_metadata || {}
      const guildId = meta.discord_guild_id || ''

      if (guildId) {
        const { data: subs } = await supabase
          .from('subsystems')
          .select('*')
          .eq('guild_id', guildId)
          .order('sort_order', { ascending: true })
        setSubsystems(subs || [])

        // Pre-select the first subsystem if available
        if (subs && subs.length > 0) {
          setSubsystemId(subs[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading subsystems:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    loadSubsystems()
  }, [loadSubsystems])

  /**
   * Parse a single Discord user ID from raw text.
   * Accepts formats: <@123>, <@!123>, or a plain numeric ID.
   */
  function parseUserId(raw: string): string | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const mentionMatch = trimmed.match(/<@!?(\d+)>/)
    if (mentionMatch) return mentionMatch[1]
    if (/^\d+$/.test(trimmed)) return trimmed
    return null
  }

  /**
   * Parse a single Discord role ID from raw text.
   * Accepts formats: <@&123> or a plain numeric ID.
   */
  function parseRoleId(raw: string): string | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const mentionMatch = trimmed.match(/<@&(\d+)>/)
    if (mentionMatch) return mentionMatch[1]
    if (/^\d+$/.test(trimmed)) return trimmed
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!subsystemId) {
      setError('Subsystem is required')
      return
    }

    setSubmitting(true)
    try {
      const notifyUserId = parseUserId(notifyUserRaw)
      const notifyRoleId = parseRoleId(notifyRoleRaw)

      const result = await createWorkOrderAction({
        title: title.trim(),
        description: description.trim() || undefined,
        subsystem_id: subsystemId,
        priority,
        cad_link: cadLink.trim() || undefined,
        notify_user_ids: notifyUserId ? [notifyUserId] : undefined,
        notify_role_ids: notifyRoleId ? [notifyRoleId] : undefined,
      })

      if (result.success && result.workOrderId) {
        router.push(`/workorders/${result.workOrderId}`)
      } else if (result.success) {
        router.push('/workorders')
      } else {
        setError(result.error || 'Failed to create work order')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
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
          <h1 className="text-2xl font-bold text-foreground">Create Work Order</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={() => router.push('/workorders')} variant="outline">
              Back
            </Button>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
              {error}
            </div>
          )}

          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief description of the task"
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description (optional)"
                rows={4}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent resize-y"
              />
            </div>

            {/* Subsystem + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Subsystem <span className="text-red-500">*</span>
                </label>
                <select
                  value={subsystemId}
                  onChange={(e) => setSubsystemId(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring"
                  required
                >
                  <option value="">-- Select --</option>
                  {subsystems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring"
                >
                  {PRIORITY_LEVELS.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* CAD Link */}
          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">CAD Link</label>
              <input
                type="url"
                value={cadLink}
                onChange={(e) => setCadLink(e.target.value)}
                placeholder="https://cad.onshape.com/... (optional)"
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Link to a CAD file (Onshape, Fusion 360, etc.)
              </p>
            </div>
          </div>

          {/* Notifications */}
          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground">Notifications (optional)</h2>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                User ID to notify
              </label>
              <input
                type="text"
                value={notifyUserRaw}
                onChange={(e) => setNotifyUserRaw(e.target.value)}
                placeholder="Discord user ID (e.g. 123456789)"
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter a Discord user ID. This user will be mentioned in the Discord channel.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Role ID to notify
              </label>
              <input
                type="text"
                value={notifyRoleRaw}
                onChange={(e) => setNotifyRoleRaw(e.target.value)}
                placeholder="Discord role ID (e.g. 111222333)"
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter a Discord role ID. This role will be mentioned in the Discord channel.
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/workorders')}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Work Order'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
