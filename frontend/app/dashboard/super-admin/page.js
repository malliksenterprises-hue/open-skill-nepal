'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '../../../../components/DashboardLayout';

export default function SuperAdminDashboard({ activeNav, user }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuperAdminData();
  }, [activeNav]);

  const fetchSuperAdminData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/super-admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching super admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  const renderDashboard = () => {
    switch (activeNav) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Welcome Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Super Admin Dashboard
              </h1>
              <p className="text-gray-600">
                System-wide overview and platform management.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg mr-4">
                    <span className="text-2xl">🏫</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Schools</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.totalSchools || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg mr-4">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Schools</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.activeSchools || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg mr-4">
                    <span className="text-2xl">⚡</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Admins</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.totalAdmins || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-red-100 rounded-lg mr-4">
                    <span className="text-2xl">🔴</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Live Classes</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.liveVideos || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activities */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Schools */}
              {dashboardData?.recentActivities?.schools && (
                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b">
                    <h2 className="text-xl font-semibold">Recent Schools</h2>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3">
                      {dashboardData.recentActivities.schools.map((school) => (
                        <div key={school._id} className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-medium">{school.name}</p>
                            <p className="text-sm text-gray-500">{school.code}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            school.status === 'active' ? 'bg-green-100 text-green-800' :
                            school.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {school.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Videos */}
              {dashboardData?.recentActivities?.videos && (
                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b">
                    <h2 className="text-xl font-semibold">Recent Videos</h2>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3">
                      {dashboardData.recentActivities.videos.map((video) => (
                        <div key={video._id} className="py-2 border-b border-gray-100 last:border-b-0">
                          <p className="font-medium text-sm">{video.title}</p>
                          <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                            <span>By {video.teacher?.name}</span>
                            <span className={`px-2 py-1 rounded-full ${
                              video.status === 'live' ? 'bg-red-100 text-red-800' :
                              video.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {video.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Super Admin Dashboard</h2>
            <p>System-wide management and monitoring.</p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout user={user}>
      {renderDashboard()}
    </DashboardLayout>
  );
}
