'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

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
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase, router])

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
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage({ text: 'An unexpected error occurred.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
          <Button onClick={() => router.push('/workorders')} variant="outline">
            Back
          </Button>
        </div>
      </header>

      <main className="p-8">
        <div className="max-w-2xl">
          <div className="border border-gray-200 rounded-lg p-6 space-y-6">
            <h2 className="text-xl font-semibold">Guild Configuration</h2>

            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Guild ID (Discord Server ID)
              </label>
              <input
                type="text"
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                placeholder="e.g. 1234567890123456789"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Role IDs (comma-separated)
              </label>
              <input
                type="text"
                value={adminRoles}
                onChange={(e) => setAdminRoles(e.target.value)}
                placeholder="e.g. 111111111, 222222222"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Discord role IDs that grant admin permissions in the bot.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Member Role IDs (comma-separated)
              </label>
              <input
                type="text"
                value={memberRoles}
                onChange={(e) => setMemberRoles(e.target.value)}
                placeholder="e.g. 333333333, 444444444"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Discord role IDs that grant member permissions in the bot.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Work Orders Channel ID
              </label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="e.g. 555555555555555555"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                The Discord channel where work order cards will be posted.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
