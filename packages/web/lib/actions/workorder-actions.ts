'use server'

import { createClient } from '@/lib/supabase/server'
import { AuditAction } from '@workorder/shared'

interface ActionResult {
  success: boolean
  error?: string
}

/**
 * Helper: get the current user's database ID (users table) from the server-side session.
 * auth.uid() is the Supabase Auth UUID, which differs from the users table UUID.
 * We resolve by matching the Discord user ID stored in auth metadata.
 */
async function getCurrentUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const discordUserId = user.user_metadata?.provider_id || user.user_metadata?.sub
  if (!discordUserId) return null

  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('discord_user_id', discordUserId)
    .single()

  return dbUser?.id ?? null
}

/**
 * Helper: get the current user's database ID, Discord roles, and guild ID.
 * Resolves the users table ID via Discord user ID, same as getCurrentUserId.
 */
async function getCurrentUserMeta() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const meta = user.user_metadata || {}
  const discordUserId = meta.provider_id || meta.sub
  if (!discordUserId) return null

  const { data: dbUser } = await supabase
    .from('users')
    .select('id')
    .eq('discord_user_id', discordUserId)
    .single()

  if (!dbUser) return null

  return {
    userId: dbUser.id,
    discordRoles: (meta.discord_roles || []) as string[],
    guildId: (meta.discord_guild_id || '') as string,
  }
}

/**
 * Helper: check if the user is an admin for their guild.
 */
async function checkAdmin() {
  const supabase = await createClient()
  const meta = await getCurrentUserMeta()
  if (!meta) return { isAdmin: false, userId: '', supabase }

  const { data: config } = await supabase
    .from('guild_configs')
    .select('admin_role_ids')
    .eq('guild_id', meta.guildId)
    .single()

  const adminRoleIds: string[] = config?.admin_role_ids || []
  const userIsAdmin = meta.discordRoles.some((role: string) => adminRoleIds.includes(role))

  return { isAdmin: userIsAdmin, userId: meta.userId, guildId: meta.guildId, supabase }
}

/**
 * Helper: insert an audit log entry.
 */
async function logAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  guildId: string,
  workOrderId: string,
  actorUserId: string,
  action: AuditAction,
  meta: Record<string, unknown> = {}
) {
  await supabase.from('audit_logs').insert({
    guild_id: guildId,
    work_order_id: workOrderId,
    actor_user_id: actorUserId,
    action,
    meta,
  })
}

/**
 * Claim a work order. Any authenticated user can claim if the work order
 * is OPEN and not already claimed by someone else.
 */
export async function claimWorkOrderAction(workOrderId: string): Promise<ActionResult> {
  const userId = await getCurrentUserId()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  // Fetch the work order to check current state
  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }
  if (wo.status !== 'OPEN') return { success: false, error: 'Work order is not open' }
  if (wo.claimed_by_user_id && wo.claimed_by_user_id !== userId) {
    return { success: false, error: 'Already claimed by another user' }
  }
  if (wo.claimed_by_user_id === userId) {
    return { success: false, error: 'You already claimed this work order' }
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ claimed_by_user_id: userId })
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to claim work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.CLAIM)
  return { success: true }
}

/**
 * Unclaim a work order. The claimer or an admin can unclaim.
 */
export async function unclaimWorkOrderAction(workOrderId: string): Promise<ActionResult> {
  const { isAdmin, userId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }
  if (wo.status !== 'OPEN') return { success: false, error: 'Work order is not open' }
  if (!wo.claimed_by_user_id) return { success: false, error: 'Work order is not claimed' }
  if (wo.claimed_by_user_id !== userId && !isAdmin) {
    return { success: false, error: 'You can only unclaim your own work orders' }
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ claimed_by_user_id: null })
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to unclaim work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.UNCLAIM)
  return { success: true }
}

/**
 * Mark a work order as done. The claimer, assignee, or an admin can finish.
 */
export async function finishWorkOrderAction(workOrderId: string): Promise<ActionResult> {
  const { isAdmin, userId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }
  if (wo.status !== 'OPEN') return { success: false, error: 'Work order is already done' }

  const canFinish =
    wo.claimed_by_user_id === userId ||
    wo.assigned_to_user_id === userId ||
    isAdmin

  if (!canFinish) {
    return { success: false, error: 'You do not have permission to finish this work order' }
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ status: 'DONE' })
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to finish work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.STATUS_CHANGE, {
    old_status: 'OPEN',
    new_status: 'DONE',
  })
  return { success: true }
}

/**
 * Assign a work order to a user. Admin only.
 */
export async function assignWorkOrderAction(
  workOrderId: string,
  assigneeId: string
): Promise<ActionResult> {
  const { isAdmin, userId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!isAdmin) return { success: false, error: 'Admin permission required' }

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ assigned_to_user_id: assigneeId })
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to assign work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.ASSIGN, {
    assigned_to: assigneeId,
  })
  return { success: true }
}

/**
 * Remove (soft-delete) a work order. Admin only.
 */
export async function removeWorkOrderAction(workOrderId: string): Promise<ActionResult> {
  const { isAdmin, userId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }
  if (!isAdmin) return { success: false, error: 'Admin permission required' }

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ is_deleted: true })
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to remove work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.REMOVE)
  return { success: true }
}

/**
 * Cancel a work order. Creator or admin can cancel.
 */
export async function cancelWorkOrderAction(workOrderId: string): Promise<ActionResult> {
  const { isAdmin, userId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }
  if (wo.status !== 'OPEN') return { success: false, error: 'Work order is not open' }

  const canCancelWo = wo.created_by_user_id === userId || isAdmin
  if (!canCancelWo) {
    return { success: false, error: 'Only the creator or an admin can cancel this work order' }
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update({ status: 'CANCELLED' })
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to cancel work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.CANCEL, {
    from: 'OPEN',
    to: 'CANCELLED',
  })
  return { success: true }
}

/**
 * Edit a work order's fields. Creator or admin can edit.
 */
export async function updateWorkOrderAction(
  workOrderId: string,
  updates: {
    title?: string
    description?: string
    priority?: string
    subsystem_id?: string
    cad_link?: string
  }
): Promise<ActionResult> {
  const { isAdmin, userId, supabase } = await checkAdmin()
  if (!userId) return { success: false, error: 'Not authenticated' }

  const { data: wo, error: fetchErr } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (fetchErr || !wo) return { success: false, error: 'Work order not found' }

  const canEditWo = wo.created_by_user_id === userId || isAdmin
  if (!canEditWo) {
    return { success: false, error: 'You do not have permission to edit this work order' }
  }

  // Only include fields that are actually provided
  const updateData: Record<string, unknown> = {}
  if (updates.title !== undefined) updateData.title = updates.title
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.priority !== undefined) updateData.priority = updates.priority
  if (updates.subsystem_id !== undefined) updateData.subsystem_id = updates.subsystem_id
  if (updates.cad_link !== undefined) updateData.cad_link = updates.cad_link

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'No changes provided' }
  }

  const { error: updateErr } = await supabase
    .from('work_orders')
    .update(updateData)
    .eq('id', workOrderId)

  if (updateErr) return { success: false, error: 'Failed to update work order' }

  await logAudit(supabase, wo.discord_guild_id, workOrderId, userId, AuditAction.EDIT, {
    changes: updateData,
  })
  return { success: true }
}

/**
 * Create a work order from the web dashboard.
 * Posts a Discord card via the bot token REST API so the card appears
 * in the guild's work-orders channel just like bot-created ones.
 */
export async function createWorkOrderAction(data: {
  title: string
  description?: string
  subsystem_id: string
  priority?: string
  cad_link?: string
  notify_user_ids?: string[]
  notify_role_ids?: string[]
}): Promise<ActionResult & { workOrderId?: string }> {
  const meta = await getCurrentUserMeta()
  if (!meta) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  const insertData: Record<string, unknown> = {
    title: data.title,
    description: data.description || '',
    subsystem_id: data.subsystem_id,
    priority: data.priority || 'MEDIUM',
    created_by_user_id: meta.userId,
    discord_guild_id: meta.guildId,
  }
  if (data.cad_link) {
    insertData.cad_link = data.cad_link
  }
  if (data.notify_user_ids && data.notify_user_ids.length > 0) {
    insertData.notify_user_ids = data.notify_user_ids
  }
  if (data.notify_role_ids && data.notify_role_ids.length > 0) {
    insertData.notify_role_ids = data.notify_role_ids
  }

  const { data: wo, error: insertErr } = await supabase
    .from('work_orders')
    .insert(insertData)
    .select('*, subsystem:subsystems(*)')
    .single()

  if (insertErr || !wo) {
    console.error('Failed to create work order:', insertErr)
    return { success: false, error: 'Failed to create work order' }
  }

  // Log the creation
  await logAudit(supabase, meta.guildId, wo.id, meta.userId, AuditAction.CREATE, {
    title: data.title,
    subsystem_id: data.subsystem_id,
  })

  // Post the Discord card via bot token REST API
  const botToken = process.env.DISCORD_BOT_TOKEN
  if (botToken) {
    const { data: guildConfig } = await supabase
      .from('guild_configs')
      .select('work_orders_channel_id')
      .eq('guild_id', meta.guildId)
      .single()

    if (guildConfig?.work_orders_channel_id) {
      try {
        const { sendDiscordMessage } = await import('@/lib/discord-bot')

        // Resolve creator display name for the embed
        const { data: creator } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', meta.userId)
          .single()

        const creatorName = creator?.display_name || 'Unknown'
        const subsystemEmoji = wo.subsystem?.emoji || ''
        const subsystemLabel = wo.subsystem?.display_name || 'Unknown'
        const priorityLabel = data.priority || 'MEDIUM'

        // Build a Discord embed matching the bot's format
        const embed = {
          color: priorityLabel === 'HIGH' ? 0xFF6B6B : priorityLabel === 'LOW' ? 0x95E1D3 : 0xFFD93D,
          title: `${subsystemEmoji} [${subsystemLabel}] ${wo.title}`,
          description: wo.description || '*No description provided*',
          fields: [
            { name: 'Status', value: 'Unclaimed', inline: true },
            { name: 'Priority', value: priorityLabel, inline: true },
            { name: 'Subsystem', value: `${subsystemEmoji} ${subsystemLabel}`, inline: true },
            { name: 'Created By', value: creatorName, inline: true },
            // Include CAD link field if provided
            ...(data.cad_link ? [{ name: 'CAD Link', value: `[Open CAD](${data.cad_link})`, inline: false }] : []),
          ],
          footer: { text: `ID: ${wo.id}` },
          timestamp: wo.created_at,
        }

        // Build action buttons matching the bot's format
        const components = [{
          type: 1, // ActionRow
          components: [
            {
              type: 2, // Button
              style: 1, // Primary
              label: 'Claim',
              custom_id: `claim-${wo.id}`,
            },
            {
              type: 2,
              style: 4, // Danger
              label: 'Cancel',
              custom_id: `cancel-${wo.id}`,
            },
          ],
        }]

        const msgResult = await sendDiscordMessage(
          botToken,
          guildConfig.work_orders_channel_id,
          { embeds: [embed], components }
        )

        // Save Discord message/channel IDs back to the work order
        if (msgResult?.id) {
          await supabase
            .from('work_orders')
            .update({
              discord_message_id: msgResult.id,
              discord_channel_id: guildConfig.work_orders_channel_id,
            })
            .eq('id', wo.id)
        }

        // Send notification mentions if targets exist
        const notifyUserIds = data.notify_user_ids || []
        const notifyRoleIds = data.notify_role_ids || []
        if (notifyUserIds.length > 0 || notifyRoleIds.length > 0) {
          const mentions = [
            ...notifyUserIds.map((id) => `<@${id}>`),
            ...notifyRoleIds.map((id) => `<@&${id}>`),
          ].join(' ')

          await sendDiscordMessage(
            botToken,
            guildConfig.work_orders_channel_id,
            {
              content: `${mentions} -- New work order: **${wo.title}**`,
              allowed_mentions: { users: notifyUserIds, roles: notifyRoleIds },
            }
          )
        }
      } catch (err) {
        // Discord posting is best-effort; the work order is already created
        console.error('Failed to post Discord card from web:', err)
      }
    }
  }

  return { success: true, workOrderId: wo.id }
}

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

  const { data, error: updateErr } = await supabase
    .from('work_orders')
    .update({ is_deleted: true, cleared_at: new Date().toISOString() })
    .eq('discord_guild_id', guildId)
    .eq('is_deleted', false)
    .in('status', statuses)
    .select('id')

  if (updateErr) return { success: false, error: 'Failed to clear work orders' }

  const count = data?.length ?? 0

  if (count > 0) {
    await logAudit(supabase, guildId, data![0].id, userId, AuditAction.CLEAR, { statuses, count })
  }

  return { success: true, count }
}

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
    await logAudit(supabase, guildId, data![0].id, userId, AuditAction.RECOVER, { count })
  }

  return { success: true, count }
}

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

  const { data, count, error } = await supabase
    .from('work_orders')
    .select('cleared_at', { count: 'exact' })
    .eq('discord_guild_id', guildId)
    .eq('is_deleted', true)
    .not('cleared_at', 'is', null)
    .order('cleared_at', { ascending: true })
    .limit(1)

  if (error || !data || data.length === 0) {
    return { hasPending: false, count: 0, clearedAt: null }
  }

  return {
    hasPending: true,
    count: count ?? 0,
    clearedAt: data[0].cleared_at,
  }
}
