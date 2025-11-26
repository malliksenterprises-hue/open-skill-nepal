'use client';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    enrolledCourses: [],
    liveClasses: [],
    stats: {},
    loading: true
  });

  // Safe data initialization
  useEffect(() => {
    // Mock data for testing
    const mockData = {
      enrolledCourses: [
        { 
          id: 1, 
          name: 'Mathematics', 
          progress: 75,
          instructor: 'Dr. Sharma',
          nextSession: '2024-01-15'
        },
        { 
          id: 2, 
          name: 'Science', 
          progress: 50,
          instructor: 'Dr. Patel',
          nextSession: '2024-01-16'
        }
      ],
      liveClasses: [
        {
          id: 1,
          subject: 'Mathematics',
          teacher: 'John Doe',
          time: '10:00 AM',
          participants: 32
        }
      ],
      stats: {
        totalClasses: 12,
        completed: 8,
        attendance: '95%'
      }
    };
    
    setDashboardData({ ...mockData, loading: false });
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading student dashboard...</div>
      </div>
    );
  }

  if (dashboardData.loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-gray-200 h-32 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Student Dashboard</h1>
        
        {/* Stats Cards - SAFE RENDERING */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Enrolled Classes</h3>
            <p className="text-3xl font-bold text-blue-600">
              {dashboardData.enrolledCourses?.length || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Live Sessions</h3>
            <p className="text-3xl font-bold text-green-600">
              {dashboardData.liveClasses?.length || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Completed</h3>
            <p className="text-3xl font-bold text-purple-600">
              {dashboardData.stats?.completed || 0}
            </p>
          </div>
        </div>

        {/* Enrolled Courses - SAFE RENDERING */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Enrolled Courses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboardData.enrolledCourses && dashboardData.enrolledCourses.length > 0 ? (
              dashboardData.enrolledCourses.map(course => (
                <div key={course.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold">{course.name || 'Unnamed Course'}</h3>
                  <p className="text-sm text-gray-600">Instructor: {course.instructor || 'Unknown'}</p>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${course.progress || 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{course.progress || 0}% complete</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 col-span-2 text-center py-8">No courses enrolled yet</p>
            )}
          </div>
        </div>

        {/* Live Classes - SAFE RENDERING */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Live Classes</h2>
          <div className="space-y-3">
            {dashboardData.liveClasses && dashboardData.liveClasses.length > 0 ? (
              dashboardData.liveClasses.map(classItem => (
                <div key={classItem.id} className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h4 className="font-medium">{classItem.subject || 'Unknown Subject'}</h4>
                    <p className="text-sm text-gray-600">by {classItem.teacher || 'Unknown Teacher'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-600 font-semibold">{classItem.time || 'TBA'}</p>
                    <p className="text-xs text-gray-500">{classItem.participants || 0} participants</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No live classes scheduled</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
