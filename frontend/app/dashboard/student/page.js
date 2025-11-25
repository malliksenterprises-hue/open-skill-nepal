'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/dashboard/student', {
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
      setError(err.message);
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const joinClass = async (videoId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/videos/${videoId}/join`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to join class');
      }
      
      // Open video in new tab or embedded player
      window.open(data.video.videoUrl, '_blank');
      
    } catch (err) {
      alert('Error joining class: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Dashboard</h2>
        <p className="text-red-700">{error}</p>
        <button 
          onClick={fetchDashboardData}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Student verification pending
  if (user?.status !== 'approved') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">
            Account Pending Verification
          </h2>
          <p className="text-yellow-700 mb-4">
            Your account is waiting for approval from your school admin. 
            You'll get access to classes and dashboard features once verified.
          </p>
          <div className="text-sm text-yellow-600">
            Current Status: <span className="font-semibold capitalize">{user?.status}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {user.name}!</p>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-900">Live Classes</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {dashboardData?.stats?.liveNow || 0}
            </p>
            <p className="text-blue-700 text-sm mt-1">Happening now</p>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
            <h3 className="text-lg font-semibold text-orange-900">Upcoming</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {dashboardData?.stats?.upcoming || 0}
            </p>
            <p className="text-orange-700 text-sm mt-1">Scheduled classes</p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <h3 className="text-lg font-semibold text-green-900">Completed</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {dashboardData?.stats?.completed || 0}
            </p>
            <p className="text-green-700 text-sm mt-1">Recorded classes</p>
          </div>
        </div>
      </div>

      {/* Live Classes Section */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-3"></span>
            Live Classes Now
          </h2>
        </div>
        
        <div className="p-6">
          {!dashboardData?.liveClasses?.length ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-6xl mb-4">📹</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Live Classes</h3>
              <p className="text-gray-500">There are no live classes happening right now.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {dashboardData.liveClasses.map((classItem) => (
                <div key={classItem._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-lg text-gray-900">{classItem.title}</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Live Now
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-2">{classItem.description}</p>
                  
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center">
                      <span className="w-20 font-medium">Teacher:</span>
                      <span>{classItem.teacher?.name}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-20 font-medium">Subject:</span>
                      <span className="capitalize">{classItem.subject}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-20 font-medium">Grade:</span>
                      <span>Grade {classItem.grade}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => joinClass(classItem._id)}
                    className="w-full mt-4 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors font-medium"
                  >
                    Join Class Now
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Classes Section */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Upcoming Classes</h2>
        </div>
        
        <div className="p-6">
          {!dashboardData?.upcomingClasses?.length ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-6xl mb-4">📅</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Classes</h3>
              <p className="text-gray-500">Check back later for scheduled classes.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dashboardData.upcomingClasses.map((classItem) => (
                <div key={classItem._id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{classItem.title}</h3>
                      <p className="text-gray-600 text-sm mt-1">{classItem.description}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Scheduled
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Teacher:</span>
                      <p>{classItem.teacher?.name}</p>
                    </div>
                    <div>
                      <span className="font-medium">Subject:</span>
                      <p className="capitalize">{classItem.subject}</p>
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

      {/* Recorded Classes Section */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Recorded Classes</h2>
        </div>
        
        <div className="p-6">
          {!dashboardData?.recordedClasses?.length ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-6xl mb-4">🎥</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Recorded Classes</h3>
              <p className="text-gray-500">Completed classes will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dashboardData.recordedClasses.map((classItem) => (
                <div key={classItem._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-200 rounded-md mb-3 flex items-center justify-center">
                    <span className="text-gray-400 text-4xl">🎬</span>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 mb-2">{classItem.title}</h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{classItem.description}</p>
                  
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>Teacher:</span>
                      <span>{classItem.teacher?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Subject:</span>
                      <span className="capitalize">{classItem.subject}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span>{classItem.duration} min</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => window.open(classItem.videoUrl, '_blank')}
                    className="w-full mt-3 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    Watch Recording
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
