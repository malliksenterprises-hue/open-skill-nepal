'use client';
import DashboardLayout from '../../../components/DashboardLayout'
import { useAuth } from '../../../contexts/AuthContext'
import { useState, useEffect } from 'react'

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    systemStats: {},
    schools: [],
    recentActivity: [],
    adminUsers: [],
    loading: true
  });

  useEffect(() => {
    const mockData = {
      systemStats: {
        totalUsers: 1250,
        totalSchools: 45,
        activeCourses: 89,
        revenue: '₹1,25,000'
      },
      schools: [
        { id: 1, name: 'Kathmandu High School', students: 300, teachers: 15, status: 'Active', district: 'Kathmandu' }
      ],
      adminUsers: [
        { id: 1, name: 'Admin User 1', email: 'admin1@system.com', role: 'Super Admin', lastActive: '2 hours ago' }
      ],
      recentActivity: [
        { id: 1, action: 'New school registered', user: 'Kathmandu High School', time: '2 hours ago' }
      ]
    };
    setDashboardData({ ...mockData, loading: false });
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading super admin dashboard...</div>
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
        <h1 className="text-2xl font-bold mb-4">Super Admin Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Total Users</h3>
            <p className="text-3xl font-bold text-blue-600">
              {dashboardData.systemStats?.totalUsers || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Total Schools</h3>
            <p className="text-3xl font-bold text-green-600">
              {dashboardData.systemStats?.totalSchools || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Active Courses</h3>
            <p className="text-3xl font-bold text-purple-600">
              {dashboardData.systemStats?.activeCourses || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Revenue</h3>
            <p className="text-3xl font-bold text-orange-600">
              {dashboardData.systemStats?.revenue || '₹0'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Registered Schools</h2>
              <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                {dashboardData.schools?.length || 0} schools
              </span>
            </div>
            <div className="space-y-3">
              {dashboardData.schools && dashboardData.schools.length > 0 ? (
                dashboardData.schools.map(school => (
                  <div key={school.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{school.name}</h3>
                        <p className="text-sm text-gray-600">{school.district}</p>
                        <div className="flex space-x-4 mt-2">
                          <span className="text-xs text-gray-500">{school.students || 0} students</span>
                          <span className="text-xs text-gray-500">{school.teachers || 0} teachers</span>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        school.status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {school.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No schools registered</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Admin Users</h2>
            <div className="space-y-3">
              {dashboardData.adminUsers && dashboardData.adminUsers.length > 0 ? (
                dashboardData.adminUsers.map(admin => (
                  <div key={admin.id} className="flex justify-between items-center border-b pb-3">
                    <div>
                      <h3 className="font-medium">{admin.name}</h3>
                      <p className="text-sm text-gray-600">{admin.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{admin.role}</p>
                      <p className="text-xs text-gray-500">Active: {admin.lastActive}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No admin users</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
