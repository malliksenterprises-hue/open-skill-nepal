'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { useAuth } from '../../../contexts/AuthContext';

export default function AdminDashboard({ activeNav }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchAdminData();
  }, [activeNav]);

  const fetchAdminData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
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
                Admin Dashboard
              </h1>
              <p className="text-gray-600">
                Manage schools, teachers, and platform operations.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-yellow-100 rounded-lg mr-4">
                    <span className="text-2xl">⏳</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Schools</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.pendingSchools || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg mr-4">
                    <span className="text-2xl">🏫</span>
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
                  <div className="p-3 bg-blue-100 rounded-lg mr-4">
                    <span className="text-2xl">👨‍🏫</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Teachers</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.totalTeachers || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg mr-4">
                    <span className="text-2xl">🎥</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Videos</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.totalVideos || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Schools */}
            {dashboardData?.pendingSchools && dashboardData.pendingSchools.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold">Pending School Approvals</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {dashboardData.pendingSchools.map((school) => (
                      <div key={school._id} className="flex items-center justify-between p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{school.name}</h3>
                          <p className="text-sm text-gray-600">Code: {school.code}</p>
                          <p className="text-sm text-gray-500">
                            Admin: {school.admin?.name} ({school.admin?.email})
                          </p>
                          <p className="text-sm text-gray-500">
                            Applied: {new Date(school.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors">
                            Approve
                          </button>
                          <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition-colors">
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Unassigned Teachers */}
            {dashboardData?.unassignedTeachers && dashboardData.unassignedTeachers.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold">Teachers Needing Assignment</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {dashboardData.unassignedTeachers.map((teacher) => (
                      <div key={teacher._id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                        <div>
                          <p className="font-medium">{teacher.name}</p>
                          <p className="text-sm text-gray-500">{teacher.email}</p>
                          <p className="text-sm text-gray-400">
                            {teacher.qualifications || 'No qualifications specified'}
                          </p>
                        </div>
                        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm transition-colors">
                          Assign School
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Admin Dashboard</h2>
            <p>Manage platform operations and school coordination.</p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  );
}
