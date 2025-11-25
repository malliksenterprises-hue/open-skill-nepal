'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/dashboard/admin', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch dashboard data');
      }
      
      setDashboardData(data);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolApproval = async (schoolId, action) => {
    setActionLoading(schoolId);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${schoolId}/status`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: action })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to process school approval');
      }
      
      // Refresh dashboard data
      await fetchDashboardData();
      
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const assignTeacherToSchool = async (teacherId, schoolId) => {
    setActionLoading(`assign-${teacherId}`);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/schools/${schoolId}/teachers`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ teacherId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to assign teacher');
      }
      
      alert('Teacher assigned successfully!');
      await fetchDashboardData();
      
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'green', text: 'Active' },
      pending: { color: 'orange', text: 'Pending' },
      inactive: { color: 'gray', text: 'Inactive' }
    };
    
    const config = statusConfig[status] || { color: 'gray', text: status };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome, {user.name} • Open Skill Nepal Coordinator
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Manage schools, teachers, and platform operations
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Platform Role</div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Platform Admin
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-900">Active Schools</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {dashboardData?.stats?.activeSchools || 0}
            </p>
            <p className="text-blue-700 text-sm mt-1">On platform</p>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
            <h3 className="text-lg font-semibold text-orange-900">Pending Schools</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {dashboardData?.stats?.pendingApprovals || 0}
            </p>
            <p className="text-orange-700 text-sm mt-1">Awaiting approval</p>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <h3 className="text-lg font-semibold text-purple-900">Teachers</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {dashboardData?.stats?.assignedTeachers || 0}
            </p>
            <p className="text-purple-700 text-sm mt-1">Registered</p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <h3 className="text-lg font-semibold text-green-900">Operations</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {dashboardData?.pendingSchools?.length + dashboardData?.teachers?.length || 0}
            </p>
            <p className="text-green-700 text-sm mt-1">Pending tasks</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('schools')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'schools'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              School Management
              {dashboardData?.pendingSchools?.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  {dashboardData.pendingSchools.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('teachers')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'teachers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Teacher Management
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Reports & Analytics
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-orange-900 mb-2">School Approvals</h3>
                  <p className="text-orange-700 text-sm mb-4">
                    {dashboardData?.pendingSchools?.length || 0} schools waiting for approval and activation.
                  </p>
                  <button
                    onClick={() => setActiveTab('schools')}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-medium"
                  >
                    Review Schools
                  </button>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">Teacher Assignments</h3>
                  <p className="text-purple-700 text-sm mb-4">
                    Manage teacher assignments to schools and monitor teaching activities.
                  </p>
                  <button
                    onClick={() => setActiveTab('teachers')}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium"
                  >
                    Manage Teachers
                  </button>
                </div>
              </div>

              {/* Pending Schools Quick View */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending School Approvals</h3>
                {!dashboardData?.pendingSchools?.length ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <div className="text-gray-400 text-4xl mb-3">✅</div>
                    <p className="text-gray-500">No pending school approvals</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {dashboardData.pendingSchools.slice(0, 4).map((school) => (
                      <div key={school._id} className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900">{school.name}</h4>
                          {getStatusBadge(school.status)}
                        </div>
                        <p className="text-gray-600 text-sm mb-1">Code: {school.code}</p>
                        <p className="text-gray-600 text-sm mb-3">
                          Admin: {school.admin?.name} • {school.admin?.email}
                        </p>
                        <p className="text-xs text-gray-500 mb-3">
                          {school.address?.city}, {school.address?.district}
                        </p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSchoolApproval(school._id, 'active')}
                            disabled={actionLoading === school._id}
                            className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === school._id ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleSchoolApproval(school._id, 'inactive')}
                            disabled={actionLoading === school._id}
                            className="flex-1 bg-red-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {dashboardData?.pendingSchools?.length > 4 && (
                  <div className="text-center mt-4">
                    <button
                      onClick={() => setActiveTab('schools')}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View all {dashboardData.pendingSchools.length} pending schools →
                    </button>
                  </div>
                )}
              </div>

              {/* Available Teachers */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Teachers</h3>
                {!dashboardData?.teachers?.length ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <div className="text-gray-400 text-4xl mb-3">👨‍🏫</div>
                    <p className="text-gray-500">No teachers registered yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {dashboardData.teachers.slice(0, 4).map((teacher) => (
                      <div key={teacher._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900">{teacher.name}</h4>
                          <span className="text-xs text-gray-500">
                            Joined {new Date(teacher.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{teacher.email}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            {teacher.school ? `Assigned to ${teacher.school.name}` : 'Not assigned'}
                          </span>
                          <button
                            onClick={() => setActiveTab('teachers')}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Assign →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* School Management Tab */}
          {activeTab === 'schools' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">School Management</h3>
                <div className="text-sm text-gray-500">
                  {dashboardData?.pendingSchools?.length || 0} pending • {dashboardData?.stats?.activeSchools || 0} active
                </div>
              </div>

              {/* Pending Schools Section */}
              <div className="mb-8">
                <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                  Pending School Approvals
                </h4>

                {!dashboardData?.pendingSchools?.length ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <div className="text-gray-400 text-4xl mb-3">🎉</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
                    <p className="text-gray-500">No schools waiting for approval.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.pendingSchools.map((school) => (
                      <div key={school._id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h4 className="text-xl font-semibold text-gray-900 mb-2">{school.name}</h4>
                            <p className="text-gray-600 mb-1">School Code: <span className="font-mono">{school.code}</span></p>
                            <p className="text-gray-600 mb-3">
                              Admin: <span className="font-medium">{school.admin?.name}</span> • {school.admin?.email}
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium text-gray-900">Contact Information</span>
                                <p className="mt-1">{school.contact?.phone}</p>
                                <p>{school.contact?.email}</p>
                                <p>Principal: {school.contact?.principalName}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">Address</span>
                                <p className="mt-1">
                                  {school.address?.street && `${school.address.street}, `}
                                  {school.address?.city}, {school.address?.district}
                                  <br />
                                  {school.address?.province}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(school.status)}
                            <p className="text-sm text-gray-500 mt-2">
                              Registered: {new Date(school.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex space-x-3 pt-4 border-t">
                          <button
                            onClick={() => handleSchoolApproval(school._id, 'active')}
                            disabled={actionLoading === school._id}
                            className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === school._id ? (
                              <span className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Processing...
                              </span>
                            ) : (
                              '✓ Approve School'
                            )}
                          </button>
                          <button
                            onClick={() => handleSchoolApproval(school._id, 'inactive')}
                            disabled={actionLoading === school._id}
                            className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            ✗ Reject School
                          </button>
                          <button
                            onClick={() => {/* View details */}}
                            className="px-4 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Schools Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Active Schools
                </h4>

                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <div className="text-green-400 text-xl mr-3">🏫</div>
                    <div>
                      <h4 className="font-semibold text-green-900">Active Schools Management</h4>
                      <p className="text-green-700 text-sm mt-1">
                        View and manage all active schools on the platform. 
                        Active schools can have teachers assigned and students registered.
                      </p>
                    </div>
                  </div>
                </div>

                {/* This would typically show active schools with management options */}
                <div className="text-center py-8 bg-gray-50 rounded-lg mt-4">
                  <div className="text-gray-400 text-6xl mb-4">📊</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Active Schools Overview</h3>
                  <p className="text-gray-500 mb-4">
                    {dashboardData?.stats?.activeSchools || 0} schools are currently active on the platform.
                  </p>
                  <button
                    onClick={fetchDashboardData}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Refresh School List
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Teacher Management Tab */}
          {activeTab === 'teachers' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Teacher Management</h3>
                <div className="text-sm text-gray-500">
                  {dashboardData?.teachers?.length || 0} registered teachers
                </div>
              </div>

              {!dashboardData?.teachers?.length ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <div className="text-gray-400 text-6xl mb-4">👨‍🏫</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Teachers Registered</h3>
                  <p className="text-gray-500">Teachers will appear here once they register on the platform.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {dashboardData.teachers.map((teacher) => (
                    <div key={teacher._id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h4 className="text-xl font-semibold text-gray-900 mb-2">{teacher.name}</h4>
                          <p className="text-gray-600 mb-3">{teacher.email}</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            <div>
                              <span className="font-medium text-gray-900">Registration Date</span>
                              <p>{new Date(teacher.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">Current Assignment</span>
                              <p>{teacher.school ? teacher.school.name : 'Not assigned'}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">Status</span>
                              <p>{teacher.isActive ? 'Active' : 'Inactive'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            teacher.school ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {teacher.school ? 'Assigned' : 'Unassigned'}
                          </span>
                        </div>
                      </div>

                      {/* School Assignment Section */}
                      <div className="pt-4 border-t">
                        <h5 className="font-medium text-gray-900 mb-3">School Assignment</h5>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm text-gray-600">
                              {teacher.school 
                                ? `Currently assigned to ${teacher.school.name}`
                                : 'This teacher is not assigned to any school'
                              }
                            </span>
                          </div>
                          <div className="flex space-x-2">
                            {teacher.school ? (
                              <button
                                onClick={() => {/* Unassign functionality */}}
                                className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700"
                              >
                                Unassign
                              </button>
                            ) : (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    assignTeacherToSchool(teacher._id, e.target.value);
                                  }
                                }}
                                disabled={actionLoading === `assign-${teacher._id}`}
                                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Assign to school...</option>
                                {/* Schools would be populated here */}
                                <option value="school1">Kathmandu Model School</option>
                                <option value="school2">Pokhara Public School</option>
                              </select>
                            )}
                            <button
                              onClick={() => {/* View teacher details */}}
                              className="bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-200"
                            >
                              View Profile
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reports & Analytics Tab */}
          {activeTab === 'reports' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Platform Reports & Analytics</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white border rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Platform Overview</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Schools</span>
                      <span className="font-semibold">{dashboardData?.stats?.activeSchools + dashboardData?.pendingSchools?.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Active Schools</span>
                      <span className="font-semibold">{dashboardData?.stats?.activeSchools || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Pending Schools</span>
                      <span className="font-semibold">{dashboardData?.pendingSchools?.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Registered Teachers</span>
                      <span className="font-semibold">{dashboardData?.teachers?.length || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Recent Activity</h4>
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600">
                      • School approvals pending: {dashboardData?.pendingSchools?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">
                      • Unassigned teachers: {dashboardData?.teachers?.filter(t => !t.school)?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">
                      • Platform health: Optimal
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="text-blue-400 text-xl mr-3">📈</div>
                  <div>
                    <h4 className="font-semibold text-blue-900">Advanced Analytics Coming Soon</h4>
                    <p className="text-blue-700 text-sm mt-1">
                      Comprehensive analytics including student enrollment trends, 
                      class delivery metrics, platform usage statistics, and 
                      performance reports will be available in the next update.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
