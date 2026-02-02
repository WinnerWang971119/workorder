'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WorkOrder, User, Subsystem, STATUS_LABELS, PRIORITY_LABELS } from '@workorder/shared'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const PAGE_SIZE = 25

export default function WorkOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Paginated query for open, non-deleted work orders
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE

      const { data: orders, error } = await supabase
        .from('work_orders')
        .select('*, subsystem:subsystems(*)')
        .eq('status', 'OPEN')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('Error loading work orders:', error)
        return
      }

      // If we got PAGE_SIZE + 1 rows, there are more pages
      if (orders && orders.length > PAGE_SIZE) {
        setHasMore(true)
        setWorkOrders(orders.slice(0, PAGE_SIZE))
      } else {
        setHasMore(false)
        setWorkOrders(orders || [])
      }

      // Resolve user IDs to display names
      const userIds = new Set<string>()
      orders?.forEach((wo) => {
        userIds.add(wo.created_by_user_id)
        if (wo.claimed_by_user_id) userIds.add(wo.claimed_by_user_id)
        if (wo.assigned_to_user_id) userIds.add(wo.assigned_to_user_id)
      })

      if (userIds.size > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, display_name')
          .in('id', Array.from(userIds))

        const map = new Map<string, string>()
        users?.forEach((u) => map.set(u.id, u.display_name))
        setUserMap(map)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, page])

  useEffect(() => {
    loadData()
  }, [loadData])

  const resolveUser = (userId: string | null): string => {
    if (!userId) return '-'
    return userMap.get(userId) || userId.slice(0, 8) + '...'
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Work Orders</h1>
          <div className="flex gap-4">
            <Button onClick={() => router.push('/usage')} variant="outline">
              Usage Stats
            </Button>
            <Button onClick={() => router.push('/admin')} variant="outline">
              Admin
            </Button>
            <Button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              variant="destructive"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="p-8">
        {workOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No open work orders</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subsystem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Claimed By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.title}</TableCell>
                      <TableCell>
                        {order.subsystem ? `${order.subsystem.emoji} ${order.subsystem.display_name}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{STATUS_LABELS[order.status]}</Badge>
                      </TableCell>
                      <TableCell>{PRIORITY_LABELS[order.priority] || order.priority}</TableCell>
                      <TableCell>{resolveUser(order.created_by_user_id)}</TableCell>
                      <TableCell>{resolveUser(order.assigned_to_user_id)}</TableCell>
                      <TableCell>{resolveUser(order.claimed_by_user_id)}</TableCell>
                      <TableCell>{formatDate(order.created_at)}</TableCell>
                      <TableCell>
                        <Link href={`/workorders/${order.id}`}>
                          <Button size="sm" variant="outline">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">Page {page + 1}</span>
              <Button
                variant="outline"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
