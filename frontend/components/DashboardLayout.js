'use client'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Header from './Header'
import Sidebar from './Sidebar'

/**
 * Layout component for all dashboard pages
 * Provides consistent header and sidebar
 */
export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { user } = useAuth()

  // Redirect to login if not authenticated
  if (!user) {
    return null // or redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="lg:pl-64">
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
