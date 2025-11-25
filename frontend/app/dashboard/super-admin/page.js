'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateSchoolModal, setShowCreateSchoolModal] = useState(false);
  const [createSchoolLoading, setCreateSchoolLoading] = useState(false);

  // Create school form state
  const [createSchoolForm, setCreateSchoolForm] = useState({
    name: '',
    code: '',
    address: {
      street: '',
      city: '',
      district: '',
      province: ''
    },
    contact: {
      phone: '',
      email: '',
      principalName: ''
    },
    deviceLimit: 100,
    adminId: ''
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/dashboard/super-admin', {
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

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    setCreateSchoolLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/schools', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(createSchoolForm)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create school');
      }
      
      alert('School created successfully!');
      setShowCreateSchoolModal(false);
      setCreateSchoolForm({
        name: '',
        code: '',
        address: { street: '', city: '', district: '', province: '' },
        contact: { phone: '', email: '', principalName: '' },
        deviceLimit: 100,
        adminId: ''
      });
      
      // Refresh dashboard data
      await fetchDashboardData();
      
    } catch (err) {
      alert('Error creating school: ' + err.message);
    } finally {
      setCreateSchoolLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setCreateSchoolForm(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setCreateSchoolForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const getSystemHealth = () => {
    if (!dashboardData) return 'loading';
    
    const { systemHealth, database } = dashboardData;
    if (systemHealth === 'optimal' && database === 'connected') {
      return 'healthy';
    } else if (systemHealth === 'degraded' || database === 'disconnected') {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  };

  const getHealthBadge = (health) => {
    const healthConfig = {
      healthy: { color: 'green', text: 'Healthy', icon: '✅' },
      degraded: { color: 'orange', text: 'Degraded', icon: '⚠️' },
      unhealthy: { color: 'red', text: 'Unhealthy', icon: '❌' },
      loading: { color: 'gray', text: 'Loading...', icon: '⏳' }
    };
    
    const config = healthConfig[health] || healthConfig.loading;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
        <span className="mr-1">{config.icon}</span>
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
            <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome, {user.name} • System Administrator
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Full system control and platform management
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">System Status</div>
            {getHealthBadge(getSystemHealth())}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-900">Total Schools</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {dashboardData?.stats?.totalSchools || 0}
            </p>
            <p className="text-blue-700 text-sm mt-1">On platform</p>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <h3 className="text-lg font-semibold text-purple-900">Platform Admins</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {dashboardData?.stats?.totalAdmins || 0}
            </p>
            <p className="text-purple-700 text-sm mt-1">Management team</p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <h3 className="text-lg font-semibold text-green-900">Teachers</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {dashboardData?.stats?.totalTeachers || 0}
            </p>
            <p className="text-green-700 text-sm mt-1">Registered</p>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
            <h3 className="text-lg font-semibold text-orange-900">Students</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {dashboardData?.stats?.totalStudents || 0}
            </p>
            <p className="text-orange-700 text-sm mt-1">Approved</p>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <h3 className="text-lg font-semibold text-red-900">Live Classes</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {dashboardData?.stats?.activeClasses || 0}
            </p>
            <p className="text-red-700 text-sm mt-1">Currently active</p>
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
              System Overview
            </button>
            <button
              onClick={() => setActiveTab('schools')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'schools'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Schools
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'system'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              System Settings
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Advanced Reports
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* System Health */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Platform Status</span>
                      {getHealthBadge(getSystemHealth())}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Database</span>
                      <span className={`text-sm font-medium ${
                        dashboardData?.database === 'connected' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {dashboardData?.database === 'connected' ? '✅ Connected' : '❌ Disconnected'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">API Status</span>
                      <span className="text-sm font-medium text-green-600">✅ Operational</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Uptime</span>
                      <span className="text-sm font-medium text-gray-600">
                        {dashboardData?.uptime ? Math.floor(dashboardData.uptime / 3600) + 'h' : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowCreateSchoolModal(true)}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-blue-700 text-left"
                    >
                      🏫 Create New School
                    </button>
                    <button
                      onClick={() => setActiveTab('users')}
                      className="w-full bg-purple-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-purple-700 text-left"
                    >
                      👥 Manage Users
                    </button>
                    <button
                      onClick={() => setActiveTab('system')}
                      className="w-full bg-gray-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-gray-700 text-left"
                    >
                      ⚙️ System Settings
                    </button>
                    <button
                      onClick={fetchDashboardData}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-green-700 text-left"
                    >
                      🔄 Refresh Data
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Schools */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Schools</h3>
                {!dashboardData?.recentSchools?.length ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <div className="text-gray-400 text-4xl mb-3">🏫</div>
                    <p className="text-gray-500">No schools registered yet</p>
                    <button
                      onClick={() => setShowCreateSchoolModal(true)}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Create First School
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {dashboardData.recentSchools.map((school) => (
                      <div key={school._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900">{school.name}</h4>
                          <span className="text-xs text-gray-500">
                            {new Date(school.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-1">Code: {school.code}</p>
                        <p className="text-gray-600 text-sm mb-3">
                          Admin: {school.admin?.name} • {school.admin?.email}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            school.status === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : school.status === 'pending'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {school.status}
                          </span>
                          <button
                            onClick={() => setActiveTab('schools')}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Manage →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Platform Analytics */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-100 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Platform Analytics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{dashboardData?.stats?.totalSchools || 0}</div>
                    <div className="text-sm text-blue-700">Schools</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{dashboardData?.stats?.totalAdmins || 0}</div>
                    <div className="text-sm text-purple-700">Admins</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{dashboardData?.stats?.totalTeachers || 0}</div>
                    <div className="text-sm text-green-700">Teachers</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{dashboardData?.stats?.totalStudents || 0}</div>
                    <div className="text-sm text-orange-700">Students</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Schools Tab */}
          {activeTab === 'schools' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">School Management</h3>
                <button
                  onClick={() => setShowCreateSchoolModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create School
                </button>
              </div>

              {/* Schools List */}
              <div className="space-y-4">
                {dashboardData?.recentSchools?.map((school) => (
                  <div key={school._id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h4 className="text-xl font-semibold text-gray-900 mb-2">{school.name}</h4>
                        <p className="text-gray-600 mb-1">
                          <span className="font-medium">Code:</span> {school.code} • 
                          <span className="font-medium ml-2">Admin:</span> {school.admin?.name}
                        </p>
                        <p className="text-gray-600 mb-3">{school.admin?.email}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium text-gray-900">Contact</span>
                            <p className="mt-1">{school.contact?.phone}</p>
                            <p>{school.contact?.email}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">Address</span>
                            <p className="mt-1">
                              {school.address?.city}, {school.address?.district}
                              <br />
                              {school.address?.province}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">Device Limit</span>
                            <p className="mt-1">{school.deviceLimit} devices</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              school.status === 'active' 
                                ? 'bg-green-100 text-green-800'
                                : school.status === 'pending'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {school.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                      <div className="text-sm text-gray-500">
                        Created: {new Date(school.createdAt).toLocaleDateString()} • 
                        ID: {school._id}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {/* Edit school */}}
                          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {/* View details */}}
                          className="bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-200"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Management Tab */}
          {activeTab === 'users' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">User Management</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white border rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {dashboardData?.stats?.totalAdmins || 0}
                  </div>
                  <p className="text-gray-600">Platform Admins</p>
                  <button
                    onClick={() => {/* Manage admins */}}
                    className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Manage Admins →
                  </button>
                </div>

                <div className="bg-white border rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {dashboardData?.stats?.totalTeachers || 0}
                  </div>
                  <p className="text-gray-600">Teachers</p>
                  <button
                    onClick={() => {/* Manage teachers */}}
                    className="mt-3 text-green-600 hover:text-green-800 text-sm font-medium"
                  >
                    Manage Teachers →
                  </button>
                </div>

                <div className="bg-white border rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {dashboardData?.stats?.totalStudents || 0}
                  </div>
                  <p className="text-gray-600">Students</p>
                  <button
                    onClick={() => {/* Manage students */}}
                    className="mt-3 text-orange-600 hover:text-orange-800 text-sm font-medium"
                  >
                    View Students →
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="text-blue-400 text-xl mr-3">👥</div>
                  <div>
                    <h4 className="font-semibold text-blue-900">User Management Console</h4>
                    <p className="text-blue-700 text-sm mt-1">
                      Comprehensive user management features including role assignments, 
                      account activations, and user analytics are under development.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Settings Tab */}
          {activeTab === 'system' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">System Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Platform Configuration</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Platform Name
                      </label>
                      <input
                        type="text"
                        value="Open Skill Nepal"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Device Limit
                      </label>
                      <input
                        type="number"
                        value="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        readOnly
                      />
                    </div>
                    <button className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded font-medium hover:bg-gray-200">
                      Save Configuration
                    </button>
                  </div>
                </div>

                <div className="bg-white border rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">System Maintenance</h4>
                  <div className="space-y-3">
                    <button className="w-full bg-blue-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-blue-700 text-left">
                      🔄 Clear Cache
                    </button>
                    <button className="w-full bg-green-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-green-700 text-left">
                      📊 Generate Reports
                    </button>
                    <button className="w-full bg-orange-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-orange-700 text-left">
                      🗄️ Database Backup
                    </button>
                    <button className="w-full bg-red-600 text-white py-2 px-4 rounded text-sm font-medium hover:bg-red-700 text-left">
                      ⚠️ System Diagnostics
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Advanced Reports</h3>
              
              <div className="bg-gradient-to-r from-purple-50 to-pink-100 border border-purple-200 rounded-lg p-8 text-center">
                <div className="text-purple-400 text-6xl mb-4">📈</div>
                <h4 className="text-xl font-semibold text-purple-900 mb-2">Advanced Analytics Dashboard</h4>
                <p className="text-purple-700 mb-4">
                  Comprehensive platform analytics, usage trends, performance metrics, 
                  and detailed reporting system coming in Phase 3.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-white rounded p-3">
                    <div className="font-semibold text-purple-600">User Growth</div>
                    <div className="text-gray-500">Coming Soon</div>
                  </div>
                  <div className="bg-white rounded p-3">
                    <div className="font-semibold text-purple-600">Class Analytics</div>
                    <div className="text-gray-500">Coming Soon</div>
                  </div>
                  <div className="bg-white rounded p-3">
                    <div className="font-semibold text-purple-600">Revenue Reports</div>
                    <div className="text-gray-500">Coming Soon</div>
                  </div>
                  <div className="bg-white rounded p-3">
                    <div className="font-semibold text-purple-600">Performance</div>
                    <div className="text-gray-500">Coming Soon</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create School Modal */}
      {showCreateSchoolModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Create New School</h2>
            </div>
            
            <form onSubmit={handleCreateSchool} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    School Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={createSchoolForm.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter school name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    School Code *
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={createSchoolForm.code}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., KMSS"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Limit
                </label>
                <input
                  type="number"
                  name="deviceLimit"
                  value={createSchoolForm.deviceLimit}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    name="contact.phone"
                    value={createSchoolForm.contact.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    name="contact.email"
                    value={createSchoolForm.contact.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Principal Name
                </label>
                <input
                  type="text"
                  name="contact.principalName"
                  value={createSchoolForm.contact.principalName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="address.city"
                    value={createSchoolForm.address.city}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    name="address.district"
                    value={createSchoolForm.address.district}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateSchoolModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSchoolLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {createSchoolLoading ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </span>
                  ) : (
                    'Create School'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
