/**
 * Discord API utilities for fetching guild member data.
 * Used during OAuth callback to store user roles in session metadata.
 */

interface DiscordGuildMember {
  user?: {
    id: string
    username: string
    discriminator: string
    avatar: string | null
  }
  roles: string[]
  nick: string | null
  joined_at: string
}

/**
 * Fetch a guild member's data from the Discord API using the bot token.
 * Returns null if the request fails (user not in guild, bot lacks permission, etc.)
 */
export async function getGuildMember(
  userId: string,
  guildId: string,
  botToken: string
): Promise<DiscordGuildMember | null> {
  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    )

    if (!response.ok) {
      console.error(
        `Discord API error: ${response.status} ${response.statusText}`
      )
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to fetch guild member from Discord:', error)
    return null
  }
}
