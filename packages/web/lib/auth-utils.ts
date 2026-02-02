import { createClient } from '@/lib/supabase/client'

interface CurrentUser {
  userId: string
  discordUserId: string
  discordRoles: string[]
}

/**
 * Get current authenticated user with their Discord roles from session metadata.
 * Roles are stored during OAuth callback by fetching guild member data from Discord API.
 * Returns null if user is not authenticated.
 */
export async function getCurrentUserWithRoles(): Promise<CurrentUser | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const meta = session.user.user_metadata || {}

  return {
    userId: session.user.id,
    // Supabase stores the Discord user ID in provider_id or sub
    discordUserId: meta.provider_id || meta.sub || '',
    discordRoles: meta.discord_roles || [],
  }
}

/**
 * Check if user has admin role for a given guild by comparing their stored Discord roles
 * against the admin_role_ids from guild_configs.
 */
export async function checkIsAdmin(
  discordRoles: string[],
  guildId: string
): Promise<boolean> {
  if (!guildId || discordRoles.length === 0) return false

  const supabase = createClient()
  const { data: config } = await supabase
    .from('guild_configs')
    .select('admin_role_ids')
    .eq('guild_id', guildId)
    .single()

  if (!config) return false

  const adminRoleIds: string[] = config.admin_role_ids || []
  return discordRoles.some((role) => adminRoleIds.includes(role))
}
