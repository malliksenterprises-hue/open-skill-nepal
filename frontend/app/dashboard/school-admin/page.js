'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';

export default function SchoolAdminDashboard() {
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
      const response = await fetch('/api/dashboard/school-admin', {
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

  const handleStudentVerification = async (studentId, action, notes = '') => {
    setActionLoading(studentId);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/students/${studentId}/verify`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, notes })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to process verification');
      }
      
      // Refresh dashboard data
      await fetchDashboardData();
      
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const quickApprove = (studentId) => {
    handleStudentVerification(studentId, 'approve', 'Approved via dashboard');
  };

  const quickReject = (studentId) => {
    const notes = prompt('Please provide reason for rejection:');
    if (notes !== null) {
      handleStudentVerification(studentId, 'reject', notes);
    }
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
            <h1 className="text-2xl font-bold text-gray-900">School Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome, {user.name} • {dashboardData?.schoolInfo?.name}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              School Code: {dashboardData?.schoolInfo?.code} • 
              Device Limit: {dashboardData?.schoolInfo?.deviceLimit}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">School Status</div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Active
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-900">Total Students</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {dashboardData?.stats?.totalStudents || 0}
            </p>
            <p className="text-blue-700 text-sm mt-1">Approved students</p>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
            <h3 className="text-lg font-semibold text-orange-900">Pending Verification</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {dashboardData?.stats?.pendingVerifications || 0}
            </p>
            <p className="text-orange-700 text-sm mt-1">Awaiting approval</p>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <h3 className="text-lg font-semibold text-purple-900">Upcoming Classes</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {dashboardData?.stats?.upcomingClasses || 0}
            </p>
            <p className="text-purple-700 text-sm mt-1">Scheduled</p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <h3 className="text-lg font-semibold text-green-900">Delivered Classes</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {dashboardData?.stats?.deliveredClasses || 0}
            </p>
            <p className="text-green-700 text-sm mt-1">Completed</p>
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
              onClick={() => setActiveTab('students')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'students'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Student Verification
              {dashboardData?.pendingStudents?.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  {dashboardData.pendingStudents.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('classes')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'classes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Class Schedule
            </button>
            <button
              onClick={() => setActiveTab('teachers')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'teachers'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Teachers
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Pending Students Quick View */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Student Verifications</h3>
                {!dashboardData?.pendingStudents?.length ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <div className="text-gray-400 text-4xl mb-3">✅</div>
                    <p className="text-gray-500">No pending student verifications</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {dashboardData.pendingStudents.slice(0, 4).map((student) => (
                      <div key={student._id} className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-gray-900">{student.name}</h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            Pending
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{student.email}</p>
                        <p className="text-xs text-gray-500">
                          Registered: {new Date(student.createdAt).toLocaleDateString()}
                        </p>
                        <div className="flex space-x-2 mt-3">
                          <button
                            onClick={() => quickApprove(student._id)}
                            disabled={actionLoading === student._id}
                            className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === student._id ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => quickReject(student._id)}
                            disabled={actionLoading === student._id}
                            className="flex-1 bg-red-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {dashboardData?.pendingStudents?.length > 4 && (
                  <div className="text-center mt-4">
                    <button
                      onClick={() => setActiveTab('students')}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View all {dashboardData.pendingStudents.length} pending students →
                    </button>
                  </div>
                )}
              </div>

              {/* Upcoming Classes */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Classes</h3>
                {!dashboardData?.scheduledClasses?.length ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <div className="text-gray-400 text-4xl mb-3">📅</div>
                    <p className="text-gray-500">No upcoming classes scheduled</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboardData.scheduledClasses.slice(0, 5).map((classItem) => (
                      <div key={classItem._id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-900">{classItem.title}</h4>
                            <p className="text-gray-600 text-sm mt-1">{classItem.description}</p>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {classItem.subject}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Teacher:</span>
                            <p>{classItem.teacher?.name}</p>
                          </div>
                          <div>
                            <span className="font-medium">When:</span>
                            <p>{new Date(classItem.scheduledFor).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <span className="font-medium">Time:</span>
                            <p>{new Date(classItem.scheduledFor).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Student Verification Tab */}
          {activeTab === 'students' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Student Verification</h3>
                <div className="text-sm text-gray-500">
                  {dashboardData?.pendingStudents?.length || 0} pending verification(s)
                </div>
              </div>

              {!dashboardData?.pendingStudents?.length ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <div className="text-gray-400 text-6xl mb-4">🎉</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">All Caught Up!</h3>
                  <p className="text-gray-500">No students waiting for verification.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.pendingStudents.map((student) => (
                    <div key={student._id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-xl font-semibold text-gray-900">{student.name}</h4>
                          <p className="text-gray-600">{student.email}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Registered on {new Date(student.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                            Awaiting Verification
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">Student Information</h5>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex justify-between">
                              <span>Name:</span>
                              <span className="font-medium">{student.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Email:</span>
                              <span className="font-medium">{student.email}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Registration Date:</span>
                              <span>{new Date(student.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">School Information</h5>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex justify-between">
                              <span>School:</span>
                              <span className="font-medium">{dashboardData.schoolInfo.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>School Code:</span>
                              <span>{dashboardData.schoolInfo.code}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Your Role:</span>
                              <span>School Administrator</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-3 pt-4 border-t">
                        <button
                          onClick={() => quickApprove(student._id)}
                          disabled={actionLoading === student._id}
                          className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === student._id ? (
                            <span className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Processing...
                            </span>
                          ) : (
                            '✓ Approve Student'
                          )}
                        </button>
                        <button
                          onClick={() => quickReject(student._id)}
                          disabled={actionLoading === student._id}
                          className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          ✗ Reject Student
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Classes Tab */}
          {activeTab === 'classes' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Class Schedule</h3>
              
              {!dashboardData?.scheduledClasses?.length ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <div className="text-gray-400 text-6xl mb-4">📚</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Scheduled Classes</h3>
                  <p className="text-gray-500">Classes scheduled by teachers will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.scheduledClasses.map((classItem) => (
                    <div key={classItem._id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-xl font-semibold text-gray-900">{classItem.title}</h4>
                          <p className="text-gray-600 mt-1">{classItem.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            {classItem.subject}
                          </span>
                          <p className="text-sm text-gray-500 mt-1">Grade {classItem.grade}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium text-gray-900">Teacher</span>
                          <p>{classItem.teacher?.name}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">Schedule</span>
                          <p>{new Date(classItem.scheduledFor).toLocaleDateString()}</p>
                          <p>{new Date(classItem.scheduledFor).toLocaleTimeString()}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">Duration</span>
                          <p>{classItem.duration} minutes</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">
                            Class ID: {classItem._id}
                          </span>
                          <button
                            onClick={() => window.open(classItem.videoUrl, '_blank')}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            View Class Details →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Teachers Tab */}
          {activeTab === 'teachers' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Assigned Teachers</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <div className="flex items-start">
                  <div className="text-blue-400 text-xl mr-3">💡</div>
                  <div>
                    <h4 className="font-semibold text-blue-900">Teacher Management</h4>
                    <p className="text-blue-700 text-sm mt-1">
                      Teachers are assigned to your school by Open Skill Nepal administrators. 
                      Contact the platform admin if you need additional teachers assigned.
                    </p>
                  </div>
                </div>
              </div>

              {/* This would typically show assigned teachers */}
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <div className="text-gray-400 text-6xl mb-4">👨‍🏫</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Teacher Management</h3>
                <p className="text-gray-500 mb-4">View and manage teachers assigned to your school.</p>
                <button
                  onClick={() => fetchDashboardData()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Refresh Teacher List
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
