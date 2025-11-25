'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    subject: 'mathematics',
    grade: '10',
    scheduledFor: '',
    schoolId: ''
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/dashboard/teacher', {
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
      // Set school ID for upload form
      if (data.school) {
        setUploadForm(prev => ({ ...prev, schoolId: data.school._id }));
      }
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setUploadLoading(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      // Add form fields
      Object.keys(uploadForm).forEach(key => {
        formData.append(key, uploadForm[key]);
      });

      // Add video file (mock for now - would be actual file input)
      const mockVideoFile = new Blob(['mock video content'], { type: 'video/mp4' });
      formData.append('video', mockVideoFile, 'class-video.mp4');

      const response = await fetch('/api/videos/upload', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}',
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload video');
      }
      
      alert('Video uploaded and scheduled successfully!');
      setShowUploadModal(false);
      setUploadForm({
        title: '',
        description: '',
        subject: 'mathematics',
        grade: '10',
        scheduledFor: '',
        schoolId: uploadForm.schoolId
      });
      
      // Refresh dashboard data
      await fetchDashboardData();
      
    } catch (err) {
      alert('Upload error: ' + err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUploadForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      scheduled: { color: 'blue', text: 'Scheduled' },
      live: { color: 'red', text: 'Live Now' },
      completed: { color: 'green', text: 'Completed' },
      cancelled: { color: 'gray', text: 'Cancelled' }
    };
    
    const config = statusConfig[status] || { color: 'gray', text: status };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
        {config.text}
      </span>
    );
  };

  const formatScheduleDate = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      full: date.toLocaleString()
    };
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
            <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome, {user.name} • {dashboardData?.school?.name}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              School Code: {dashboardData?.school?.code}
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Upload & Schedule Class
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-900">Total Uploads</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {dashboardData?.stats?.totalUploads || 0}
            </p>
            <p className="text-blue-700 text-sm mt-1">All time</p>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
            <h3 className="text-lg font-semibold text-orange-900">Scheduled</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {dashboardData?.stats?.scheduledClasses || 0}
            </p>
            <p className="text-orange-700 text-sm mt-1">Upcoming</p>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <h3 className="text-lg font-semibold text-red-900">Live Now</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {dashboardData?.stats?.liveClasses || 0}
            </p>
            <p className="text-red-700 text-sm mt-1">Currently active</p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <h3 className="text-lg font-semibold text-green-900">Completed</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {dashboardData?.stats?.completedClasses || 0}
            </p>
            <p className="text-green-700 text-sm mt-1">Finished</p>
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
              onClick={() => setActiveTab('my-videos')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'my-videos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Videos
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'schedule'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Class Schedule
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
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
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Schedule New Class</h3>
                  <p className="text-blue-700 text-sm mb-4">
                    Upload a video and schedule it for future delivery as a live class.
                  </p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Upload Video
                  </button>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">View Schedule</h3>
                  <p className="text-green-700 text-sm mb-4">
                    See all your upcoming classes and manage your teaching schedule.
                  </p>
                  <button
                    onClick={() => setActiveTab('schedule')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
                  >
                    View Schedule
                  </button>
                </div>
              </div>

              {/* Recent Uploads */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Uploads</h3>
                {!dashboardData?.myVideos?.length ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <div className="text-gray-400 text-4xl mb-3">📹</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Videos Uploaded</h3>
                    <p className="text-gray-500">Get started by uploading your first video class.</p>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                    >
                      Upload First Video
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {dashboardData.myVideos.slice(0, 4).map((video) => {
                      const schedule = formatScheduleDate(video.scheduledFor);
                      return (
                        <div key={video._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-semibold text-gray-900">{video.title}</h4>
                            {getStatusBadge(video.status)}
                          </div>
                          
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{video.description}</p>
                          
                          <div className="space-y-2 text-sm text-gray-500">
                            <div className="flex justify-between">
                              <span>Subject:</span>
                              <span className="capitalize font-medium">{video.subject}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Grade:</span>
                              <span>Grade {video.grade}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Scheduled:</span>
                              <span>{schedule.date} at {schedule.time}</span>
                            </div>
                          </div>
                          
                          <div className="flex space-x-2 mt-4">
                            <button
                              onClick={() => window.open(video.videoUrl, '_blank')}
                              className="flex-1 bg-gray-100 text-gray-700 py-2 px-3 rounded text-sm font-medium hover:bg-gray-200"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {/* Edit functionality */}}
                              className="flex-1 bg-blue-100 text-blue-700 py-2 px-3 rounded text-sm font-medium hover:bg-blue-200"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* My Videos Tab */}
          {activeTab === 'my-videos' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">My Video Library</h3>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  New Upload
                </button>
              </div>

              {!dashboardData?.myVideos?.length ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <div className="text-gray-400 text-6xl mb-4">🎬</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Videos Yet</h3>
                  <p className="text-gray-500 mb-4">Start building your video library by uploading your first class.</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Upload Your First Video
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.myVideos.map((video) => {
                    const schedule = formatScheduleDate(video.scheduledFor);
                    return (
                      <div key={video._id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h4 className="text-xl font-semibold text-gray-900 mb-2">{video.title}</h4>
                            <p className="text-gray-600 mb-3">{video.description}</p>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium text-gray-900">Subject</span>
                                <p className="capitalize">{video.subject}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">Grade</span>
                                <p>Grade {video.grade}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">Duration</span>
                                <p>{video.duration} minutes</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">Status</span>
                                <div className="mt-1">{getStatusBadge(video.status)}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t">
                          <div className="text-sm text-gray-500">
                            Scheduled: {schedule.full}
                            {video.school && ` • School: ${video.school.name}`}
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => window.open(video.videoUrl, '_blank')}
                              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
                            >
                              Watch Video
                            </button>
                            <button
                              onClick={() => {/* Edit functionality */}}
                              className="bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-200"
                            >
                              Edit Details
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Class Schedule</h3>
              
              {!dashboardData?.schedule?.length ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <div className="text-gray-400 text-6xl mb-4">📅</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Scheduled Classes</h3>
                  <p className="text-gray-500 mb-4">Schedule your first class to see it here.</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Schedule a Class
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.schedule.map((video) => {
                    const schedule = formatScheduleDate(video.scheduledFor);
                    const isUpcoming = new Date(video.scheduledFor) > new Date();
                    
                    return (
                      <div key={video._id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h4 className="text-xl font-semibold text-gray-900 mb-2">{video.title}</h4>
                            <p className="text-gray-600 mb-3">{video.description}</p>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-900">Date & Time</span>
                                <p className="text-gray-600">{schedule.full}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">Subject & Grade</span>
                                <p className="text-gray-600 capitalize">{video.subject} • Grade {video.grade}</p>
                              </div>
                              <div>
                                <span className="font-medium text-gray-900">Duration</span>
                                <p className="text-gray-600">{video.duration} minutes</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(video.status)}
                            {isUpcoming && (
                              <p className="text-sm text-gray-500 mt-2">
                                In {Math.ceil((new Date(video.scheduledFor) - new Date()) / (1000 * 60 * 60 * 24))} days
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t">
                          <div className="text-sm text-gray-500">
                            Class ID: {video._id} • School: {video.school?.name}
                          </div>
                          <div className="flex space-x-2">
                            {video.status === 'scheduled' && (
                              <button
                                onClick={() => {/* Reschedule functionality */}}
                                className="bg-orange-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-orange-700"
                              >
                                Reschedule
                              </button>
                            )}
                            <button
                              onClick={() => window.open(video.videoUrl, '_blank')}
                              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
                            >
                              {video.status === 'completed' ? 'Watch Recording' : 'Preview Video'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Teaching Analytics</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white border rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Class Distribution</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Scheduled Classes</span>
                      <span className="font-semibold">{dashboardData?.stats?.scheduledClasses || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Live Classes</span>
                      <span className="font-semibold">{dashboardData?.stats?.liveClasses || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Completed Classes</span>
                      <span className="font-semibold">{dashboardData?.stats?.completedClasses || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Subject Breakdown</h4>
                  <div className="space-y-3">
                    {dashboardData?.myVideos?.reduce((acc, video) => {
                      acc[video.subject] = (acc[video.subject] || 0) + 1;
                      return acc;
                    }, {}) && Object.entries(dashboardData.myVideos.reduce((acc, video) => {
                      acc[video.subject] = (acc[video.subject] || 0) + 1;
                      return acc;
                    }, {})).map(([subject, count]) => (
                      <div key={subject} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 capitalize">{subject}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="text-blue-400 text-xl mr-3">📊</div>
                  <div>
                    <h4 className="font-semibold text-blue-900">Analytics Coming Soon</h4>
                    <p className="text-blue-700 text-sm mt-1">
                      Detailed analytics including student attendance, engagement metrics, 
                      and performance insights will be available in the next update.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Upload & Schedule Class</h2>
            </div>
            
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Video Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={uploadForm.title}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter class title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={uploadForm.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe what this class is about"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject *
                  </label>
                  <select
                    name="subject"
                    value={uploadForm.subject}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="mathematics">Mathematics</option>
                    <option value="science">Science</option>
                    <option value="english">English</option>
                    <option value="nepali">Nepali</option>
                    <option value="social">Social Studies</option>
                    <option value="computer">Computer</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grade *
                  </label>
                  <select
                    name="grade"
                    value={uploadForm.grade}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(grade => (
                      <option key={grade} value={grade.toString()}>
                        Grade {grade}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Date & Time *
                </label>
                <input
                  type="datetime-local"
                  name="scheduledFor"
                  value={uploadForm.scheduledFor}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Video File *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                  <div className="text-gray-400 text-4xl mb-2">📹</div>
                  <p className="text-gray-600 mb-2">Click to select video file</p>
                  <p className="text-gray-500 text-sm">MP4, MOV, AVI up to 500MB</p>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    // File input would be implemented here
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {uploadLoading ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </span>
                  ) : (
                    'Schedule Class'
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
