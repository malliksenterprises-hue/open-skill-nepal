import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Open Skill Nepal',
  description: 'Multi-school EdTech platform for Nepal',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
