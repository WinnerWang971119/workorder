'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WorkOrder, AuditLog, STATUS_LABELS, ACTION_LABELS, PRIORITY_LABELS } from '@workorder/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const AUDIT_PAGE_SIZE = 50

export default function WorkOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const workOrderId = params.id as string

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        // Fetch work order
        const { data: order, error: orderError } = await supabase
          .from('work_orders')
          .select('*, subsystem:subsystems(*)')
          .eq('id', workOrderId)
          .single()

        if (orderError || !order) {
          console.error('Error loading work order:', orderError)
          router.push('/workorders')
          return
        }

        setWorkOrder(order)

        // Fetch audit logs (limited to prevent memory issues)
        const { data: logs, error: logsError } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('work_order_id', workOrderId)
          .order('created_at', { ascending: false })
          .limit(AUDIT_PAGE_SIZE)

        if (!logsError) {
          setAuditLogs(logs || [])
        }

        // Resolve user IDs to display names
        const userIds = new Set<string>()
        userIds.add(order.created_by_user_id)
        if (order.claimed_by_user_id) userIds.add(order.claimed_by_user_id)
        if (order.assigned_to_user_id) userIds.add(order.assigned_to_user_id)
        logs?.forEach((log) => userIds.add(log.actor_user_id))

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
    }

    loadData()
  }, [supabase, router, workOrderId])

  const resolveUser = (userId: string | null): string => {
    if (!userId) return '-'
    return userMap.get(userId) || userId.slice(0, 8) + '...'
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  if (!workOrder) {
    return <div className="p-8">Work order not found</div>
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">{workOrder.title}</h1>
          <Button onClick={() => router.push('/workorders')} variant="outline">
            Back
          </Button>
        </div>
      </header>

      <main className="p-8">
        <div className="space-y-6">
          {/* Details */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">ID</p>
                <p className="font-mono text-sm">{workOrder.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge>{STATUS_LABELS[workOrder.status]}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600">Subsystem</p>
                <p>
                  {workOrder.subsystem
                    ? `${workOrder.subsystem.emoji} ${workOrder.subsystem.display_name}`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Priority</p>
                <p>{PRIORITY_LABELS[workOrder.priority] || workOrder.priority}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Description</p>
                <p>{workOrder.description || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created By</p>
                <p>{resolveUser(workOrder.created_by_user_id)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Assigned To</p>
                <p>{resolveUser(workOrder.assigned_to_user_id)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Claimed By</p>
                <p>{resolveUser(workOrder.claimed_by_user_id)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p>{formatDate(workOrder.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Updated</p>
                <p>{formatDate(workOrder.updated_at)}</p>
              </div>
            </div>
          </div>

          {/* Audit History */}
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Audit History</h2>
            {auditLogs.length === 0 ? (
              <p className="text-gray-600">No audit logs</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{ACTION_LABELS[log.action]}</TableCell>
                        <TableCell>{resolveUser(log.actor_user_id)}</TableCell>
                        <TableCell>{formatDate(log.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
