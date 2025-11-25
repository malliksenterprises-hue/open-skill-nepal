'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '../../../../components/DashboardLayout';

export default function StudentDashboard({ activeNav, user }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoData, setVideoData] = useState({
    liveClasses: [],
    upcomingClasses: [],
    recordedClasses: []
  });

  useEffect(() => {
    fetchStudentData();
  }, [activeNav]);

  const fetchStudentData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (activeNav === 'dashboard' || !activeNav) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/students/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      }

      if (['live', 'upcoming', 'recorded', 'dashboard'].includes(activeNav)) {
        const videoResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/student-videos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          setVideoData(videoData);
        }
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchVideo = async (videoId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/watch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ durationWatched: 0, completed: false }),
      });

      if (response.ok) {
        // Open video in new tab or modal
        const video = videoData.liveClasses.find(v => v._id === videoId) ||
                     videoData.recordedClasses.find(v => v._id === videoId);
        if (video) {
          window.open(video.fileUrl, '_blank');
        }
      }
    } catch (error) {
      console.error('Error recording video view:', error);
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

  if (!user) {
    return <div>Please log in</div>;
  }

  const renderDashboard = () => {
    if (user.status === 'pending') {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <div className="text-yellow-600 text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-yellow-800 mb-2">Pending Approval</h2>
          <p className="text-yellow-700">
            Your account is waiting for approval from your school admin. 
            You'll be able to access all features once approved.
          </p>
        </div>
      );
    }

    if (user.status === 'rejected') {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">Account Rejected</h2>
          <p className="text-red-700">
            Your account has been rejected by the school admin. 
            Please contact your school administration for more information.
          </p>
        </div>
      );
    }

    switch (activeNav) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Welcome Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome back, {user.name}!
              </h1>
              <p className="text-gray-600">
                Here's what's happening with your classes today.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-red-100 rounded-lg mr-4">
                    <span className="text-2xl">🔴</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Live Now</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {videoData.liveClasses.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg mr-4">
                    <span className="text-2xl">⏰</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Upcoming</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {videoData.upcomingClasses.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg mr-4">
                    <span className="text-2xl">📼</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Recorded</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {videoData.recordedClasses.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Classes */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold flex items-center">
                  <span className="text-red-500 mr-2">🔴</span>
                  Live Classes Right Now
                </h2>
              </div>
              <div className="p-6">
                {videoData.liveClasses.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No live classes at the moment. Check back later!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {videoData.liveClasses.map((classItem) => (
                      <div key={classItem._id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                        <h3 className="font-semibold text-lg mb-2">{classItem.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{classItem.description}</p>
                        <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
                          <span>By {classItem.teacher?.name}</span>
                          <span>{Math.floor(classItem.duration / 60)} min</span>
                        </div>
                        <button
                          onClick={() => handleWatchVideo(classItem._id)}
                          className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition-colors"
                        >
                          Join Live Class
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'live':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Live Classes</h2>
            </div>
            <div className="p-6">
              {videoData.liveClasses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔴</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Live Classes</h3>
                  <p className="text-gray-500">There are no live classes at the moment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videoData.liveClasses.map((classItem) => (
                    <div key={classItem._id} className="border-2 border-red-300 rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">LIVE NOW</span>
                        <span className="text-sm text-gray-500">
                          Started {new Date(classItem.scheduledFor).toLocaleTimeString()}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{classItem.title}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{classItem.description}</p>
                      <div className="flex items-center text-sm text-gray-500 mb-4">
                        <span className="mr-3">👨‍🏫 {classItem.teacher?.name}</span>
                        <span>⏱️ {Math.floor(classItem.duration / 60)} min</span>
                      </div>
                      <button
                        onClick={() => handleWatchVideo(classItem._id)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
                      >
                        <span className="mr-2">▶️</span>
                        Join Live Stream
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'upcoming':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Upcoming Classes</h2>
            </div>
            <div className="p-6">
              {videoData.upcomingClasses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">⏰</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Upcoming Classes</h3>
                  <p className="text-gray-500">Check back later for scheduled classes.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {videoData.upcomingClasses.map((classItem) => (
                    <div key={classItem._id} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{classItem.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{classItem.description}</p>
                          <div className="flex items-center mt-2 text-sm text-gray-500">
                            <span className="mr-4">👨‍🏫 {classItem.teacher?.name}</span>
                            <span>⏱️ {Math.floor(classItem.duration / 60)} min</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full mb-2">
                            Starts {new Date(classItem.scheduledFor).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(classItem.scheduledFor).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'recorded':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Recorded Classes</h2>
            </div>
            <div className="p-6">
              {videoData.recordedClasses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📼</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Recorded Classes</h3>
                  <p className="text-gray-500">Completed classes will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videoData.recordedClasses.map((classItem) => (
                    <div key={classItem._id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                      <h3 className="font-semibold text-lg mb-2">{classItem.title}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{classItem.description}</p>
                      <div className="flex items-center text-sm text-gray-500 mb-4">
                        <span className="mr-3">👨‍🏫 {classItem.teacher?.name}</span>
                        <span>⏱️ {Math.floor(classItem.duration / 60)} min</span>
                      </div>
                      <div className="text-xs text-gray-400 mb-3">
                        Recorded on {new Date(classItem.scheduledFor).toLocaleDateString()}
                      </div>
                      <button
                        onClick={() => handleWatchVideo(classItem._id)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded transition-colors"
                      >
                        Watch Recording
                      </button>
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
            <h2 className="text-xl font-semibold mb-4">Student Dashboard</h2>
            <p>Welcome to your student dashboard. Use the navigation to explore your classes.</p>
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
