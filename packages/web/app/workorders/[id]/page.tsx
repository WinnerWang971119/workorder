'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WorkOrder, AuditLog, User, Subsystem, STATUS_LABELS, ACTION_LABELS, PRIORITY_LABELS, PRIORITY_LEVELS } from '@workorder/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import { formatDate } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  claimWorkOrderAction,
  unclaimWorkOrderAction,
  finishWorkOrderAction,
  assignWorkOrderAction,
  removeWorkOrderAction,
  updateWorkOrderAction,
  cancelWorkOrderAction,
} from '@/lib/actions/workorder-actions'
import {
  canClaim,
  canUnclaim,
  canFinish,
  canEdit,
  canAssign,
  canRemove,
  canCancel,
  isAdmin as checkIsAdminRole,
} from '@/lib/permission-utils'

const AUDIT_PAGE_SIZE = 50

export default function WorkOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map())
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [subsystems, setSubsystems] = useState<Subsystem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Current user and permissions
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [userIsAdmin, setUserIsAdmin] = useState(false)

  // Notification user display names (resolved from Discord IDs)
  const [notifyUserNames, setNotifyUserNames] = useState<string[]>([])

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', priority: '', subsystem_id: '' })

  // Assign dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [assignUserId, setAssignUserId] = useState('')

  const workOrderId = params.id as string

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Resolve the database user ID (users table) from the Discord user ID.
      // session.user.id is the Supabase Auth UUID, which differs from the
      // users table UUID used in work order foreign keys.
      const meta = session.user.user_metadata || {}
      const discordUserId: string = meta.provider_id || meta.sub || ''
      if (discordUserId) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('id')
          .eq('discord_user_id', discordUserId)
          .single()
        if (dbUser) {
          setCurrentUserId(dbUser.id)
        }
      }

      // Determine admin status from stored Discord roles
      const discordRoles: string[] = meta.discord_roles || []
      const guildId: string = meta.discord_guild_id || ''

      if (guildId) {
        const { data: config } = await supabase
          .from('guild_configs')
          .select('admin_role_ids')
          .eq('guild_id', guildId)
          .single()

        if (config) {
          setUserIsAdmin(checkIsAdminRole(discordRoles, config.admin_role_ids || []))
        }
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

      // Resolve notification user IDs to display names
      if (order.notify_user_ids && order.notify_user_ids.length > 0) {
        const { data: notifyUsers } = await supabase
          .from('users')
          .select('display_name')
          .in('discord_user_id', order.notify_user_ids)
        setNotifyUserNames(notifyUsers?.map((u) => u.display_name) || [])
      }

      // Fetch subsystems for edit dropdown
      if (order.discord_guild_id) {
        const { data: subs } = await supabase
          .from('subsystems')
          .select('*')
          .eq('guild_id', order.discord_guild_id)
          .order('sort_order', { ascending: true })
        setSubsystems(subs || [])
      }

      // Fetch audit logs
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

      // Fetch all users for the assign dropdown
      const { data: allUsersData } = await supabase
        .from('users')
        .select('*')
        .order('display_name', { ascending: true })
      setAllUsers(allUsersData || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, workOrderId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const resolveUser = (userId: string | null): string => {
    if (!userId) return '-'
    return userMap.get(userId) || 'Unknown User'
  }

  // Auto-dismiss success messages
  useEffect(() => {
    if (message?.type === 'success') {
      const timer = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const handleAction = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    successMsg: string
  ) => {
    setActionLoading(true)
    setMessage(null)
    try {
      const result = await action()
      if (result.success) {
        setMessage({ text: successMsg, type: 'success' })
        // Reload data to reflect changes
        setLoading(true)
        await loadData()
      } else {
        setMessage({ text: result.error || 'Action failed', type: 'error' })
      }
    } catch {
      setMessage({ text: 'An unexpected error occurred', type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const openEditDialog = () => {
    if (!workOrder) return
    setEditForm({
      title: workOrder.title,
      description: workOrder.description || '',
      priority: workOrder.priority,
      subsystem_id: workOrder.subsystem_id || '',
    })
    setShowEditDialog(true)
  }

  const handleEditSubmit = async () => {
    setShowEditDialog(false)
    await handleAction(
      () => updateWorkOrderAction(workOrderId, editForm),
      'Work order updated'
    )
  }

  const handleAssignSubmit = async () => {
    if (!assignUserId) return
    setShowAssignDialog(false)
    await handleAction(
      () => assignWorkOrderAction(workOrderId, assignUserId),
      'Work order assigned'
    )
    setAssignUserId('')
  }

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove this work order? This action is a soft delete.')) return
    await handleAction(
      () => removeWorkOrderAction(workOrderId),
      'Work order removed'
    )
    router.push('/workorders')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-8 text-muted-foreground">Work order not found</div>
      </div>
    )
  }

  // Determine which action buttons to show
  const showClaim = canClaim(currentUserId, workOrder)
  const showUnclaim = canUnclaim(currentUserId, workOrder, userIsAdmin)
  const showFinish = canFinish(currentUserId, workOrder, userIsAdmin)
  const showEdit = canEdit(currentUserId, workOrder, userIsAdmin)
  const showAssign = canAssign(userIsAdmin)
  const showRemove = canRemove(userIsAdmin)
  const showCancelBtn = canCancel(currentUserId, workOrder, userIsAdmin)
  const hasActions = showClaim || showUnclaim || showFinish || showEdit || showAssign || showRemove || showCancelBtn

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background px-8 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-foreground truncate mr-4">{workOrder.title}</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={() => router.push('/workorders')} variant="outline">
              Back
            </Button>
          </div>
        </div>
      </header>

      <main className="p-8 max-w-5xl mx-auto">
        <div className="space-y-6">
          {/* Status messages */}
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

          {/* Action Buttons */}
          {hasActions && (
            <div className="border border-border rounded-lg p-4 bg-card">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Actions</h2>
              <div className="flex flex-wrap gap-2">
                {showClaim && (
                  <Button
                    size="sm"
                    onClick={() => handleAction(() => claimWorkOrderAction(workOrderId), 'Work order claimed')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Working...' : 'Claim'}
                  </Button>
                )}
                {showUnclaim && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(() => unclaimWorkOrderAction(workOrderId), 'Work order unclaimed')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Working...' : 'Unclaim'}
                  </Button>
                )}
                {showFinish && (
                  <Button
                    size="sm"
                    onClick={() => handleAction(() => finishWorkOrderAction(workOrderId), 'Work order marked as done')}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {actionLoading ? 'Working...' : 'Mark Done'}
                  </Button>
                )}
                {showEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openEditDialog}
                    disabled={actionLoading}
                  >
                    Edit
                  </Button>
                )}
                {showAssign && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAssignDialog(true)}
                    disabled={actionLoading}
                  >
                    Assign
                  </Button>
                )}
                {showCancelBtn && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-500 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    onClick={() => handleAction(() => cancelWorkOrderAction(workOrderId), 'Work order cancelled')}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Working...' : 'Cancel'}
                  </Button>
                )}
                {showRemove && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleRemove}
                    disabled={actionLoading}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Edit Dialog */}
          {showEditDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-card border border-border rounded-lg p-6 w-full max-w-lg mx-4 space-y-4 shadow-lg">
                <h2 className="text-lg font-semibold text-foreground">Edit Work Order</h2>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Title</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent resize-y"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Priority</label>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring"
                    >
                      {PRIORITY_LEVELS.map((p) => (
                        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Subsystem</label>
                    <select
                      value={editForm.subsystem_id}
                      onChange={(e) => setEditForm({ ...editForm, subsystem_id: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring"
                    >
                      <option value="">-- None --</option>
                      {subsystems.map((s) => (
                        <option key={s.id} value={s.id}>{s.display_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                  <Button onClick={handleEditSubmit}>Save Changes</Button>
                </div>
              </div>
            </div>
          )}

          {/* Assign Dialog */}
          {showAssignDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4 space-y-4 shadow-lg">
                <h2 className="text-lg font-semibold text-foreground">Assign Work Order</h2>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Select User</label>
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring"
                  >
                    <option value="">-- Select a user --</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setShowAssignDialog(false); setAssignUserId('') }}>
                    Cancel
                  </Button>
                  <Button onClick={handleAssignSubmit} disabled={!assignUserId}>
                    Assign
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h2 className="text-lg font-semibold mb-4 text-foreground">Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">ID</p>
                <p className="font-mono text-sm text-foreground">{workOrder.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge
                  variant={workOrder.status === 'DONE' || workOrder.status === 'CANCELLED' ? 'secondary' : 'default'}
                >
                  {STATUS_LABELS[workOrder.status]}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subsystem</p>
                {workOrder.subsystem ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                      style={{ backgroundColor: workOrder.subsystem.color }}
                    />
                    <span className="text-foreground">{workOrder.subsystem.display_name}</span>
                  </span>
                ) : (
                  <p className="text-foreground">-</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Priority</p>
                <p className="text-foreground">{PRIORITY_LABELS[workOrder.priority] || workOrder.priority}</p>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-foreground whitespace-pre-wrap">{workOrder.description || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created By</p>
                <p className="text-foreground">{resolveUser(workOrder.created_by_user_id)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assigned To</p>
                <p className="text-foreground">{resolveUser(workOrder.assigned_to_user_id)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Claimed By</p>
                <p className="text-foreground">{resolveUser(workOrder.claimed_by_user_id)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-foreground">{formatDate(workOrder.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Updated</p>
                <p className="text-foreground">{formatDate(workOrder.updated_at)}</p>
              </div>
              {(notifyUserNames.length > 0 || (workOrder.notify_role_ids && workOrder.notify_role_ids.length > 0)) && (
                <div className="col-span-1 sm:col-span-2">
                  <p className="text-sm text-muted-foreground">Notifications</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {notifyUserNames.map((name, i) => (
                      <Badge key={`user-${i}`} variant="outline">{name}</Badge>
                    ))}
                    {workOrder.notify_role_ids?.map((roleId, i) => (
                      <Badge key={`role-${i}`} variant="secondary">Role: {roleId}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audit History */}
          <div className="border border-border rounded-lg p-6 bg-card">
            <h2 className="text-lg font-semibold mb-4 text-foreground">Audit History</h2>
            {auditLogs.length === 0 ? (
              <p className="text-muted-foreground">No audit logs</p>
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
