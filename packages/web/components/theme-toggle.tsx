'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => setMounted(true), [])
  if (!mounted) return <Button variant="outline" size="icon" disabled className="w-9 h-9" />

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={cycleTheme}
      className="w-9 h-9"
      title={`Current theme: ${theme}. Click to switch.`}
    >
      {theme === 'dark' ? (
        <Moon className="h-4 w-4" />
      ) : theme === 'light' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Monitor className="h-4 w-4" />
      )}
    </Button>
  )
}
