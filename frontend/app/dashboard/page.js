'use client';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardIndex() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      // Redirect to role-specific dashboard
      switch(user.role) {
        case 'super_admin':
        case 'admin':
          router.push('/dashboard/admin');
          break;
        case 'teacher':
          router.push('/dashboard/teacher');
          break;
        case 'student':
          router.push('/dashboard/student');
          break;
        case 'school_admin':
          router.push('/dashboard/admin'); // or create school_admin dashboard
          break;
        default:
          router.push('/login');
      }
    }
    
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to your dashboard...</p>
        <p className="mt-2 text-sm text-gray-500">
          Taking you to your personalized dashboard based on your role
        </p>
      </div>
    </div>
  );
}
