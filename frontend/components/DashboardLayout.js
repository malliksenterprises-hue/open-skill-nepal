'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');
  const { user, logout } = useAuth();
  const router = useRouter();

  // Redirect if no user
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getRoleDisplay = (role) => {
    const roles = {
      super_admin: '👑 Super Admin',
      admin: '⚡ Admin',
      school_admin: '🏫 School Admin',
      teacher: '👨‍🏫 Teacher',
      student: '🎓 Student',
    };
    return roles[role] || role;
  };

  // Role-based navigation items
  const getNavigationItems = () => {
    const baseItems = [
      { name: 'Dashboard', href: `/dashboard/${user.role}`, icon: '📊', id: 'dashboard' }
    ];

    switch (user.role) {
      case 'super_admin':
        return [
          ...baseItems,
          { name: 'Schools', href: '/dashboard/super-admin/schools', icon: '🏫', id: 'schools' },
          { name: 'Admins', href: '/dashboard/super-admin/admins', icon: '⚡', id: 'admins' },
          { name: 'System Stats', href: '/dashboard/super-admin/stats', icon: '📈', id: 'stats' },
        ];
      
      case 'admin':
        return [
          ...baseItems,
          { name: 'Pending Schools', href: '/dashboard/admin/pending-schools', icon: '⏳', id: 'pending-schools' },
          { name: 'Teachers', href: '/dashboard/admin/teachers', icon: '👨‍🏫', id: 'teachers' },
          { name: 'School Assignments', href: '/dashboard/admin/assignments', icon: '🎯', id: 'assignments' },
        ];
      
      case 'school_admin':
        return [
          ...baseItems,
          { name: 'Student Verification', href: '/dashboard/school-admin/verification', icon: '✅', id: 'verification' },
          { name: 'Students', href: '/dashboard/school-admin/students', icon: '🎓', id: 'students' },
          { name: 'Teachers', href: '/dashboard/school-admin/teachers', icon: '👨‍🏫', id: 'teachers' },
          { name: 'Class Schedule', href: '/dashboard/school-admin/schedule', icon: '📅', id: 'schedule' },
          { name: 'Videos', href: '/dashboard/school-admin/videos', icon: '🎥', id: 'videos' },
        ];
      
      case 'teacher':
        return [
          ...baseItems,
          { name: 'Upload Video', href: '/dashboard/teacher/upload', icon: '📹', id: 'upload' },
          { name: 'My Videos', href: '/dashboard/teacher/videos', icon: '🎬', id: 'my-videos' },
          { name: 'Schedule', href: '/dashboard/teacher/schedule', icon: '📅', id: 'schedule' },
          { name: 'Analytics', href: '/dashboard/teacher/analytics', icon: '📈', id: 'analytics' },
        ];
      
      case 'student':
        return [
          ...baseItems,
          { name: 'Live Classes', href: '/dashboard/student/live', icon: '🔴', id: 'live' },
          { name: 'Upcoming', href: '/dashboard/student/upcoming', icon: '⏰', id: 'upcoming' },
          { name: 'Recorded', href: '/dashboard/student/recorded', icon: '📼', id: 'recorded' },
          { name: 'My Progress', href: '/dashboard/student/progress', icon: '📊', id: 'progress' },
        ];
      
      default:
        return baseItems;
    }
  };

  const navigationItems = getNavigationItems();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block md:w-64 bg-gray-800`}>
        <div className="flex items-center justify-center h-16 bg-gray-900">
          <h1 className="text-white text-lg font-semibold">Open Skill Nepal</h1>
        </div>
        
        {/* User Info */}
        <div className="p-4 border-b border-gray-700">
          <p className="text-gray-400 text-sm">Welcome,</p>
          <p className="text-white font-medium truncate">{user.name}</p>
          <p className="text-gray-400 text-xs">{getRoleDisplay(user.role)}</p>
          {user.role === 'student' && user.status && (
            <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
              user.status === 'approved' ? 'bg-green-100 text-green-800' :
              user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {user.status}
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="mt-5 px-2 space-y-1">
          {navigationItems.map((item) => (
            <a
              key={item.id}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                setActiveNav(item.id);
                router.push(item.href);
              }}
              className={`group flex items-center px-2 py-2 text-base font-medium rounded-md transition-colors ${
                activeNav === item.id
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.name}
            </a>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white shadow">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-gray-500 hover:text-gray-600 focus:outline-none focus:text-gray-600 md:hidden"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="ml-4 text-xl font-semibold text-gray-800">
                {navigationItems.find(item => item.id === activeNav)?.name || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 hidden md:block">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
