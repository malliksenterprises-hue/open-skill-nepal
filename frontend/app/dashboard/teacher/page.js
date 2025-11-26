'use client';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    classes: [],
    schedule: [],
    videos: [],
    stats: {},
    loading: true
  });

  useEffect(() => {
    // Mock data for teacher
    const mockData = {
      classes: [
        { id: 1, name: 'Mathematics Grade 10', students: 35, subject: 'Math' },
        { id: 2, name: 'Science Grade 9', students: 28, subject: 'Science' },
        { id: 3, name: 'Physics Grade 11', students: 22, subject: 'Physics' }
      ],
      schedule: [
        { id: 1, subject: 'Mathematics', time: '10:00 AM', class: 'Grade 10', room: 'Room 101' },
        { id: 2, subject: 'Science', time: '11:30 AM', class: 'Grade 9', room: 'Lab 2' },
        { id: 3, subject: 'Physics', time: '2:00 PM', class: 'Grade 11', room: 'Room 203' }
      ],
      videos: [
        { id: 1, title: 'Algebra Basics', views: 145, uploadDate: '2024-01-10' },
        { id: 2, title: 'Chemical Reactions', views: 89, uploadDate: '2024-01-12' }
      ],
      stats: {
        totalStudents: 85,
        completedClasses: 45,
        averageRating: 4.8,
        pendingVideos: 2
      }
    };
    setDashboardData({ ...mockData, loading: false });
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading teacher dashboard...</div>
      </div>
    );
  }

  if (dashboardData.loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
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
        <h1 className="text-2xl font-bold mb-4">Teacher Dashboard</h1>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Total Students</h3>
            <p className="text-3xl font-bold text-blue-600">
              {dashboardData.stats?.totalStudents || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Completed Classes</h3>
            <p className="text-3xl font-bold text-green-600">
              {dashboardData.stats?.completedClasses || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Average Rating</h3>
            <p className="text-3xl font-bold text-purple-600">
              {dashboardData.stats?.averageRating || 0}/5
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="font-semibold text-gray-600">Pending Videos</h3>
            <p className="text-3xl font-bold text-orange-600">
              {dashboardData.stats?.pendingVideos || 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Classes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">My Classes</h2>
            <div className="space-y-3">
              {dashboardData.classes?.map(classItem => (
                <div key={classItem.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{classItem.name}</h3>
                      <p className="text-sm text-gray-600">{classItem.subject}</p>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {classItem.students || 0} students
                    </span>
                  </div>
                </div>
              )) || <p className="text-gray-500 text-center py-4">No classes assigned</p>}
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Today's Schedule</h2>
            <div className="space-y-3">
              {dashboardData.schedule?.map(item => (
                <div key={item.id} className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h4 className="font-medium">{item.subject}</h4>
                    <p className="text-sm text-gray-600">{item.class} • {item.room}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-600 font-semibold">{item.time}</p>
                  </div>
                </div>
              )) || <p className="text-gray-500 text-center py-4">No classes scheduled today</p>}
            </div>
          </div>
        </div>

        {/* Recent Videos */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Recent Videos</h2>
          <div className="space-y-3">
            {dashboardData.videos?.map(video => (
              <div key={video.id} className="flex justify-between items-center border-b pb-3">
                <div>
                  <h4 className="font-medium">{video.title}</h4>
                  <p className="text-sm text-gray-600">Uploaded: {video.uploadDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-blue-600 font-semibold">{video.views} views</p>
                </div>
              </div>
            )) || <p className="text-gray-500 text-center py-4">No videos uploaded yet</p>}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
