'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Check if user is already logged in
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
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            FRC Work Order System
          </h1>
          <p className="text-lg text-gray-600">
            Manage work orders across your FRC team
          </p>
        </div>

        <Button
          onClick={handleDiscordLogin}
          className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold"
        >
          Login with Discord
        </Button>
      </div>
    </div>
  )
}
