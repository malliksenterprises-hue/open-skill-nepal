import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '../context/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Open Skill Nepal - EdTech Platform',
  description: 'Empowering education through technology in Nepal',
}

/**
 * Root layout component that wraps the entire application
 * Provides AuthContext to all child components
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
