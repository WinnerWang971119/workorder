import { AppRole } from '@workorder/shared'

/**
 * Check if user is admin for a guild
 */
export async function isAdminForGuild(
  userRoles: string[],
  guildAdminRoleIds: string[]
): Promise<boolean> {
  return userRoles.some((role) => guildAdminRoleIds.includes(role))
}

/**
 * Get user's role in a guild
 */
export async function getUserRoleInGuild(
  userRoles: string[],
  guildAdminRoleIds: string[],
  guildMemberRoleIds: string[]
): Promise<AppRole> {
  // Check if user has admin role
  if (userRoles.some((role) => guildAdminRoleIds.includes(role))) {
    return AppRole.ADMIN
  }

  // Check if user has member role
  if (userRoles.some((role) => guildMemberRoleIds.includes(role))) {
    return AppRole.MEMBER
  }

  return AppRole.MEMBER
}
