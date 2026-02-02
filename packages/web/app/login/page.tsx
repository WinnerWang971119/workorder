'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/workorders')
      }
    }

    checkAuth()
  }, [router, supabase])

  const handleDiscordLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            FRC Work Order System
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage work orders across your FRC team
          </p>
        </div>

        <Button
          onClick={handleDiscordLogin}
          className="px-8 py-3 rounded-lg font-semibold"
        >
          Login with Discord
        </Button>
      </div>
    </div>
  )
}
