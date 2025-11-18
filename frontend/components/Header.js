'use client'
import { useAuth } from '../context/AuthContext'
import Button from './Button'

/**
 * Header component with user info and logout
 */
export default function Header({ onToggleSidebar }) {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Menu button and title */}
          <div className="flex items-center">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <div className="ml-4 lg:ml-0">
              <h1 className="text-xl font-semibold text-gray-900">
                Open Skill Nepal
              </h1>
            </div>
          </div>

          {/* Right side - User info and logout */}
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {user.name}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">
                    {user.role.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-gray-700"
                  variant="outline"
                >
                  Logout
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
