'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface UserStats {
  user_id: string
  display_name: string
  completed_count: number
  claimed_count: number
}

export default function UsagePage() {
  const router = useRouter()
  const supabase = createClient()
  const [stats, setStats] = useState<UserStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        // Fetch audit logs (limited to recent activity to avoid loading entire table)
        const { data: logs, error } = await supabase
          .from('audit_logs')
          .select('actor_user_id, action')
          .in('action', ['CLAIM', 'STATUS_CHANGE'])
          .limit(5000)

        if (error) {
          console.error('Error loading audit logs:', error)
        } else if (logs) {
          // Aggregate stats per user
          const statsMap = new Map<string, { completed: number; claimed: number }>()

          logs.forEach((log) => {
            const userId = log.actor_user_id
            if (!statsMap.has(userId)) {
              statsMap.set(userId, { completed: 0, claimed: 0 })
            }

            const userStat = statsMap.get(userId)!
            if (log.action === 'CLAIM') {
              userStat.claimed++
            } else if (log.action === 'STATUS_CHANGE') {
              userStat.completed++
            }
          })

          // Resolve display names for all referenced users
          const userIds = Array.from(statsMap.keys())
          const userMap = new Map<string, string>()

          if (userIds.length > 0) {
            const { data: users } = await supabase
              .from('users')
              .select('id, display_name')
              .in('id', userIds)

            users?.forEach((u) => userMap.set(u.id, u.display_name))
          }

          // Build final stats array sorted by completed (desc)
          const sortedStats: UserStats[] = Array.from(statsMap.entries())
            .map(([userId, counts]) => ({
              user_id: userId,
              display_name: userMap.get(userId) || userId.slice(0, 8) + '...',
              completed_count: counts.completed,
              claimed_count: counts.claimed,
            }))
            .sort((a, b) => b.completed_count - a.completed_count)

          setStats(sortedStats)
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase, router])

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Usage Statistics</h1>
          <Button onClick={() => router.push('/workorders')} variant="outline">
            Back to Work Orders
          </Button>
        </div>
      </header>

      <main className="p-8">
        {stats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No usage data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Claimed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat, idx) => (
                  <TableRow key={stat.user_id}>
                    <TableCell className="font-medium">#{idx + 1}</TableCell>
                    <TableCell>{stat.display_name}</TableCell>
                    <TableCell>{stat.completed_count}</TableCell>
                    <TableCell>{stat.claimed_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  )
}
