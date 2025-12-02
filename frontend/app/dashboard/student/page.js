'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { useAuth } from '../../../contexts/AuthContext';

export default function StudentDashboard() {
  const [dashboardData, setDashboardData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    console.log('✅ STUDENT DASHBOARD - FIXED VERSION LOADED');
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔄 Fetching student data with token:', !!token);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/student`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      
      console.log('📊 API Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📦 Received dashboard data:', data);
        setDashboardData(data || {});
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error fetching student data:', error);
      setError(error.message);
      setDashboardData({});
    } finally {
      setLoading(false);
    }
  };

  // SAFE DATA ACCESS - PREVENTS .map() ERRORS
  const classes = Array.isArray(dashboardData?.classes) ? dashboardData.classes : [];
  const upcomingClasses = Array.isArray(dashboardData?.upcomingClasses) ? dashboardData.upcomingClasses : [];
  const recentVideos = Array.isArray(dashboardData?.recentVideos) ? dashboardData.recentVideos : [];
  const stats = dashboardData?.stats || {};

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">⚠️</div>
            <p className="text-gray-600 mb-2">Failed to load dashboard</p>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button 
              onClick={fetchStudentData}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name || 'Student'}!
          </h1>
          <p className="text-gray-600">
            Continue your learning journey with your scheduled classes and videos.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg mr-4">
                <span className="text-2xl">📚</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Active Classes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.activeClasses || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg mr-4">
                <span className="text-2xl">🎥</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Videos Watched</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.videosWatched || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg mr-4">
                <span className="text-2xl">⏰</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold text-gray-900">
                  {upcomingClasses.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Classes - 100% SAFE MAPPING */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Upcoming Classes</h2>
          </div>
          <div className="p-6">
            {upcomingClasses.length > 0 ? (
              <div className="space-y-4">
                {upcomingClasses.map((classItem, index) => (
                  <div key={classItem?._id || `class-${index}`} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{classItem?.title || 'Untitled Class'}</h3>
                      <p className="text-sm text-gray-600">
                        Subject: {classItem?.subject || 'Not specified'}
                      </p>
                      <p className="text-sm text-gray-500">
                        Time: {classItem?.scheduleTime ? new Date(classItem.scheduleTime).toLocaleString() : 'Not scheduled'}
                      </p>
                    </div>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm transition-colors">
                      Join Class
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No upcoming classes scheduled.</p>
            )}
          </div>
        </div>

        {/* Recent Videos - 100% SAFE MAPPING */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Recent Videos</h2>
          </div>
          <div className="p-6">
            {recentVideos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentVideos.map((video, index) => (
                  <div key={video?._id || `video-${index}`} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 h-40 flex items-center justify-center">
                      <span className="text-4xl">🎬</span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold mb-2">{video?.title || 'Untitled Video'}</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {video?.teacher?.name || 'Unknown Teacher'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {video?.createdAt ? new Date(video.createdAt).toLocaleDateString() : 'Unknown date'}
                      </p>
                      <button className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm transition-colors">
                        Watch Video
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No recent videos available.</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
