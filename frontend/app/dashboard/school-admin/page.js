'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '../../../../components/DashboardLayout';

export default function SchoolAdminDashboard({ activeNav, user }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [pendingStudents, setPendingStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [schoolVideos, setSchoolVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState({ open: false, student: null, notes: '' });

  useEffect(() => {
    fetchSchoolAdminData();
  }, [activeNav]);

  const fetchSchoolAdminData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch dashboard stats
      if (activeNav === 'dashboard' || !activeNav) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/school-admin`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      }

      // Fetch pending students for verification
      if (['verification', 'dashboard'].includes(activeNav)) {
        const pendingResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/students/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (pendingResponse.ok) {
          const pendingData = await pendingResponse.json();
          setPendingStudents(pendingData.pendingStudents || []);
        }
      }

      // Fetch all students
      if (['students', 'dashboard'].includes(activeNav)) {
        // This would need your school ID - you might want to get it from dashboard data
        // For now, using a mock endpoint
        const studentsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/students/school/${dashboardData?.school?.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (studentsResponse.ok) {
          const studentsData = await studentsResponse.json();
          setAllStudents(studentsData.students || []);
        }
      }

      // Fetch school videos
      if (['videos', 'dashboard'].includes(activeNav)) {
        const videosResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/school-videos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (videosResponse.ok) {
          const videosData = await videosResponse.json();
          setSchoolVideos(videosData.videos || []);
        }
      }

    } catch (error) {
      console.error('Error fetching school admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentVerification = async (studentId, action, notes = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/students/${studentId}/verify`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action, notes }),
        }
      );

      if (response.ok) {
        // Refresh the data
        fetchSchoolAdminData();
        setRejectModal({ open: false, student: null, notes: '' });
      }
    } catch (error) {
      console.error('Error verifying student:', error);
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
            {/* School Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {dashboardData?.school?.name || 'School Admin Dashboard'}
              </h1>
              <p className="text-gray-600">
                Welcome back! Here's an overview of your school.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg mr-4">
                    <span className="text-2xl">🎓</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Students</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.totalStudents || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-yellow-100 rounded-lg mr-4">
                    <span className="text-2xl">⏳</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Approval</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.pendingStudents || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg mr-4">
                    <span className="text-2xl">👨‍🏫</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Teachers</p>
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
                    <p className="text-sm font-medium text-gray-600">Live Classes</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.liveClasses || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Students */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold flex items-center">
                  <span className="text-yellow-500 mr-2">⏳</span>
                  Pending Student Verifications
                </h2>
              </div>
              <div className="p-6">
                {pendingStudents.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No pending student verifications. Great job!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {pendingStudents.map((student) => (
                      <div key={student._id} className="flex items-center justify-between p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                        <div className="flex-1">
                          <h3 className="font-semibold">{student.name}</h3>
                          <p className="text-sm text-gray-600">{student.email}</p>
                          <p className="text-sm text-gray-500">
                            Registered: {new Date(student.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleStudentVerification(student._id, 'approve')}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModal({ open: true, student, notes: '' })}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Students */}
            {dashboardData?.recentStudents && dashboardData.recentStudents.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold">Recent Student Signups</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {dashboardData.recentStudents.map((student) => (
                      <div key={student._id} className="flex items-center justify-between py-2">
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-sm text-gray-500">{student.email}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          student.status === 'approved' ? 'bg-green-100 text-green-800' :
                          student.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {student.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'verification':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Student Verification</h2>
              <p className="text-gray-600 mt-1">Approve or reject student registration requests.</p>
            </div>
            <div className="p-6">
              {pendingStudents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">All Caught Up!</h3>
                  <p className="text-gray-500">No pending student verifications at the moment.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800">
                      You have <strong>{pendingStudents.length}</strong> student(s) waiting for verification.
                    </p>
                  </div>
                  
                  {pendingStudents.map((student) => (
                    <div key={student._id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2">{student.name}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                            <div>
                              <strong>Email:</strong> {student.email}
                            </div>
                            <div>
                              <strong>Registration Date:</strong> {new Date(student.createdAt).toLocaleDateString()}
                            </div>
                            <div>
                              <strong>School:</strong> {student.school?.name || 'N/A'}
                            </div>
                            <div>
                              <strong>Grade:</strong> {student.profile?.grade || 'Not specified'}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleStudentVerification(student._id, 'approve')}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModal({ open: true, student, notes: '' })}
                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'students':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">All Students</h2>
              <p className="text-gray-600 mt-1">Manage all students in your school.</p>
            </div>
            <div className="p-6">
              {allStudents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎓</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Students Yet</h3>
                  <p className="text-gray-500">Students will appear here once they register and get approved.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Grade
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Registration Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allStudents.map((student) => (
                        <tr key={student._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{student.name}</div>
                              <div className="text-sm text-gray-500">{student.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              student.status === 'approved' ? 'bg-green-100 text-green-800' :
                              student.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {student.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {student.profile?.grade || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(student.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );

      case 'videos':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">School Videos</h2>
              <p className="text-gray-600 mt-1">All videos delivered to your school.</p>
            </div>
            <div className="p-6">
              {schoolVideos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎥</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Videos Yet</h3>
                  <p className="text-gray-500">Videos will appear here once teachers schedule classes for your school.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {schoolVideos.map((video) => (
                    <div key={video._id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          video.status === 'live' ? 'bg-red-100 text-red-800' :
                          video.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {video.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          {Math.floor(video.duration / 60)} min
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{video.title}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{video.description}</p>
                      <div className="flex items-center text-sm text-gray-500 mb-2">
                        <span>👨‍🏫 {video.teacher?.name}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {video.status === 'scheduled' ? 'Scheduled for ' : ''}
                        {new Date(video.scheduledFor).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">School Admin Dashboard</h2>
            <p>Use the navigation to manage your school's students and classes.</p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout user={user}>
      {renderDashboard()}
      
      {/* Rejection Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Reject Student</h3>
            <p className="mb-4">Student: <strong>{rejectModal.student?.name}</strong></p>
            <textarea
              placeholder="Reason for rejection (optional)"
              value={rejectModal.notes}
              onChange={(e) => setRejectModal(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows="4"
            />
            <div className="flex space-x-2">
              <button
                onClick={() => setRejectModal({ open: false, student: null, notes: '' })}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleStudentVerification(rejectModal.student._id, 'reject', rejectModal.notes)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
