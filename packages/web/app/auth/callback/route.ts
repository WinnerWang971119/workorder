import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getGuildMember } from '@/lib/discord-api'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Handle OAuth errors (user denied, etc.)
  if (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url))
  }

  // Create redirect response first so session cookies can be set on it
  const redirectUrl = new URL('/workorders', request.url)
  const response = NextResponse.redirect(redirectUrl)

  // Build a Supabase client that reads cookies from the incoming request
  // and writes cookies onto the redirect response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('Session exchange error:', exchangeError)
    return NextResponse.redirect(new URL('/login?error=exchange_failed', request.url))
  }

  // After successful session exchange, fetch Discord roles and store in user metadata.
  // This allows the web app to check admin/member permissions without needing the Discord client.
  const botToken = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_GUILD_ID

  if (botToken && guildId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const discordUserId = user?.user_metadata?.provider_id || user?.user_metadata?.sub

      if (discordUserId) {
        const member = await getGuildMember(discordUserId, guildId, botToken)

        if (member) {
          // Store Discord roles in user metadata so we can check permissions later
          await supabase.auth.updateUser({
            data: {
              discord_roles: member.roles,
              discord_guild_id: guildId,
            },
          })
        }
      }
    } catch (err) {
      // Don't block login if role fetching fails - user defaults to member permissions
      console.error('Failed to fetch Discord roles during OAuth:', err)
    }
  }

  return response
}
