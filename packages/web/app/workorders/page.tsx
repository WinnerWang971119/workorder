'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WorkOrder, WorkOrderStatus, STATUS_LABELS, PRIORITY_LABELS } from '@workorder/shared'
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
import { ThemeToggle } from '@/components/theme-toggle'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const PAGE_SIZE = 25

type FilterStatus = 'OPEN' | 'CANCELLED' | 'DONE'
type SortBy = 'date' | 'priority' | 'subsystem'

const FILTER_TABS: { label: string; value: FilterStatus }[] = [
  { label: 'Open', value: 'OPEN' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Done', value: 'DONE' },
]

const SORT_OPTIONS: { label: string; value: SortBy }[] = [
  { label: 'Date (Newest)', value: 'date' },
  { label: 'Priority (Highest)', value: 'priority' },
  { label: 'Subsystem', value: 'subsystem' },
]

export default function WorkOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>('OPEN')
  const [sortBy, setSortBy] = useState<SortBy>('date')

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Paginated query filtered by selected status tab
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE

      // Build query with dynamic sort
      let query = supabase
        .from('work_orders')
        .select('*, subsystem:subsystems(*)')
        .eq('status', filter)
        .eq('is_deleted', false)

      // Apply sort based on user selection
      if (sortBy === 'priority') {
        query = query.order('priority_sort', { ascending: true })
      } else if (sortBy === 'subsystem') {
        query = query.order('sort_order', { referencedTable: 'subsystems', ascending: true })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data: orders, error } = await query.range(from, to)

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
  }, [supabase, router, page, filter, sortBy])

  useEffect(() => {
    loadData()
  }, [loadData])

  const resolveUser = (userId: string | null): string => {
    if (!userId) return '-'
    return userMap.get(userId) || 'Unknown User'
  }

  const handleFilterChange = (newFilter: FilterStatus) => {
    setFilter(newFilter)
    setPage(0)
    setLoading(true)
  }

  const handleSortChange = (newSort: SortBy) => {
    setSortBy(newSort)
    setPage(0)
    setLoading(true)
  }

  /** Empty-state message varies by active filter */
  const emptyMessage = filter === 'OPEN'
    ? 'No open work orders'
    : filter === 'CANCELLED'
      ? 'No cancelled work orders'
      : 'No completed work orders'

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
          <h1 className="text-2xl font-bold text-foreground">Work Orders</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/workorders/create">
              <Button size="sm">Create Work Order</Button>
            </Link>
            <Button onClick={() => router.push('/usage')} variant="outline" size="sm">
              Usage Stats
            </Button>
            <Button onClick={() => router.push('/admin')} variant="outline" size="sm">
              Admin
            </Button>
            <Button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              variant="destructive"
              size="sm"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="p-8">
        {/* Filter tabs + sort dropdown */}
        <div className="flex items-center justify-between mb-6 border-b border-border">
          <div className="flex gap-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleFilterChange(tab.value)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  filter === tab.value
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-2">
            <label className="text-sm text-muted-foreground">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortBy)}
              className="px-2 py-1 text-sm border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {workOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Title</TableHead>
                    <TableHead>Subsystem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Claimed By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-foreground">{order.title}</TableCell>
                      <TableCell>
                        {order.subsystem ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                              style={{ backgroundColor: order.subsystem.color }}
                            />
                            <span>{order.subsystem.display_name}</span>
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.status === 'CANCELLED' ? 'secondary' : 'default'}>
                          {STATUS_LABELS[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{PRIORITY_LABELS[order.priority] || order.priority}</TableCell>
                      <TableCell>{resolveUser(order.created_by_user_id)}</TableCell>
                      <TableCell>{resolveUser(order.assigned_to_user_id)}</TableCell>
                      <TableCell>{resolveUser(order.claimed_by_user_id)}</TableCell>
                      <TableCell className="text-sm">{formatDate(order.created_at)}</TableCell>
                      <TableCell className="text-right">
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
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1}</span>
              <Button
                variant="outline"
                size="sm"
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
