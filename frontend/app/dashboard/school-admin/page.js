'use client';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

export default function SchoolAdminDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    pendingVerifications: [],
    schoolStats: {},
    teachers: [],
    recentActivity: [],
    loading: true
  });

  useEffect(() => {
    const mockData = {
      pendingVerifications: [
        { id: 1, name: 'John Doe', grade: '10', submitted: '2024-01-15', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', grade: '11', submitted: '2024-01-14', email: 'jane@example.com' },
        { id: 3, name: 'Mike Johnson', grade: '9', submitted: '2024-01-13', email: 'mike@example.com' }
      ],
      schoolStats: {
        totalStudents: 450,
        totalTeachers: 25,
        pendingApprovals: 3,
        activeClasses: 18,
        verifiedStudents: 447
      },
      teachers: [
        { id: 1, name: 'Dr. Sharma', subject: 'Mathematics', classes: 4, status: 'Active' },
        { id: 2, name: 'Ms. Patel', subject: 'Science', classes: 3, status: 'Active' },
        { id: 3, name: 'Mr. Kumar', subject: 'Physics', classes: 2, status: 'Active' }
      ],
      recentActivity: [
        { id: 1, action: 'New student registration', user: 'John Doe', time: '2 hours ago' },
        { id: 2, action: 'Teacher account approved', user: 'Ms. Gupta', time: '5 hours ago' },
        { id: 3, action: 'Video upload approved', user: 'Dr. Sharma', time: '1 day ago' }
      ]
    };
    setDashboardData({ ...mockData, loading: false });
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading school admin dashboard...</div>
      </div>
    );
  }

  if (dashboardData.loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
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
        <h1 className="text-2xl font-bold mb-4">School Admin Dashboard</h1>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Total Students</h3>
            <p className="text-3xl font-bold text-blue-600">
              {dashboardData.schoolStats?.totalStudents || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Total Teachers</h3>
            <p className="text-3xl font-bold text-green-600">
              {dashboardData.schoolStats?.totalTeachers || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Pending Approvals</h3>
            <p className="text-3xl font-bold text-orange-600">
              {dashboardData.schoolStats?.pendingApprovals || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Active Classes</h3>
            <p className="text-3xl font-bold text-purple-600">
              {dashboardData.schoolStats?.activeClasses || 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Verifications */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Pending Verifications</h2>
              <span className="bg-orange-100 text-orange-800 text-sm px-3 py-1 rounded-full">
                {dashboardData.pendingVerifications?.length || 0} pending
              </span>
            </div>
            <div className="space-y-3">
              {dashboardData.pendingVerifications?.map(student => (
                <div key={student.id} className="flex justify-between items-center border rounded-lg p-4">
                  <div>
                    <h3 className="font-medium">{student.name}</h3>
                    <p className="text-sm text-gray-600">{student.email}</p>
                    <p className="text-xs text-gray-500">Grade {student.grade} • {student.submitted}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">
                      Approve
                    </button>
                    <button className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">
                      Reject
                    </button>
                  </div>
                </div>
              )) || <p className="text-gray-500 text-center py-4">No pending verifications</p>}
            </div>
          </div>

          {/* Teachers List */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Teaching Staff</h2>
            <div className="space-y-3">
              {dashboardData.teachers?.map(teacher => (
                <div key={teacher.id} className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h3 className="font-medium">{teacher.name}</h3>
                    <p className="text-sm text-gray-600">{teacher.subject}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{teacher.classes} classes</p>
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                      {teacher.status}
                    </span>
                  </div>
                </div>
              )) || <p className="text-gray-500 text-center py-4">No teachers registered</p>}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {dashboardData.recentActivity?.map(activity => (
              <div key={activity.id} className="flex items-center border-b pb-3">
                <div className="bg-blue-100 p-2 rounded-lg mr-4">
                  <span className="text-blue-600">📋</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{activity.action}</p>
                  <p className="text-sm text-gray-600">by {activity.user}</p>
                </div>
                <span className="text-sm text-gray-500">{activity.time}</span>
              </div>
            )) || <p className="text-gray-500 text-center py-4">No recent activity</p>}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
