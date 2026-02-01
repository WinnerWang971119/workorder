import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FRC Work Order System',
  description: 'Discord-integrated work order management for FRC teams',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        {children}
      </body>
    </html>
  )
}
