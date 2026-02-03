/**
 * Utility for posting Discord messages via the bot token REST API.
 * Used by the web dashboard to post work order cards and notification
 * messages without requiring the full discord.js client.
 */

const DISCORD_API_BASE = 'https://discord.com/api/v10'

/**
 * Send a message to a Discord channel using the bot token.
 * Returns the created message object (includes `id`), or null on failure.
 */
export async function sendDiscordMessage(
  botToken: string,
  channelId: string,
  payload: Record<string, unknown>
): Promise<{ id: string } | null> {
  const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Discord API error ${res.status}: ${body}`)
    return null
  }

  return res.json()
}
