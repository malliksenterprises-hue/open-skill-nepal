'use client'
import { useAuth } from '../context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'

/**
 * Sidebar navigation component with role-based menu items
 */
export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Role-based menu items
  const menuItems = {
    super_admin: [
      { name: 'Dashboard', path: '/dashboard/super-admin', icon: '📊' },
      { name: 'User Management', path: '/users', icon: '👥' },
      { name: 'System Settings', path: '/settings', icon: '⚙️' },
    ],
    admin: [
      { name: 'Dashboard', path: '/dashboard/admin', icon: '📊' },
      { name: 'School Management', path: '/schools', icon: '🏫' },
      { name: 'Teacher Management', path: '/teachers', icon: '👨‍🏫' },
    ],
    teacher: [
      { name: 'Dashboard', path: '/dashboard/teacher', icon: '📊' },
      { name: 'My Schedule', path: '/schedule', icon: '📅' },
      { name: 'Classes', path: '/classes', icon: '👨‍🎓' },
    ],
    school_admin: [
      { name: 'Dashboard', path: '/dashboard/school-admin', icon: '📊' },
      { name: 'Live Classes', path: '/live-classes', icon: '🎥' },
      { name: 'School Info', path: '/school-info', icon: '🏫' },
    ],
    student: [
      { name: 'Dashboard', path: '/dashboard/student', icon: '📊' },
      { name: 'My Courses', path: '/courses', icon: '📚' },
      { name: 'Progress', path: '/progress', icon: '📈' },
    ],
  }

  const currentMenu = menuItems[user?.role] || []

  const handleNavigation = (path) => {
    router.push(path)
    onClose() // Close sidebar on mobile after navigation
  }

  const isActive = (path) => pathname === path

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-gray-800 transform transition duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-center h-16 bg-gray-900">
          <span className="text-white text-xl font-bold">Open Skill Nepal</span>
        </div>

        <nav className="mt-8">
          <div className="px-4 space-y-2">
            {currentMenu.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`
                  w-full flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors duration-200
                  ${isActive(item.path)
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }
                `}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </button>
            ))}
          </div>

          {/* User info in sidebar for mobile */}
          <div className="absolute bottom-0 w-full p-4 border-t border-gray-700 lg:hidden">
            {user && (
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-700">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-400 capitalize truncate">
                    {user.role.replace('_', ' ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>
    </>
  )
}
