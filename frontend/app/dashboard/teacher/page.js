'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '../../../../components/DashboardLayout';

export default function TeacherDashboard({ activeNav, user }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [myVideos, setMyVideos] = useState([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    scheduledFor: '',
    assignedSchools: [],
    subjects: [],
    gradeLevel: 'all',
    videoFile: null
  });

  useEffect(() => {
    fetchTeacherData();
  }, [activeNav]);

  const fetchTeacherData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch dashboard stats
      if (activeNav === 'dashboard' || !activeNav) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/teacher`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      }

      // Fetch teacher's videos
      if (['my-videos', 'dashboard', 'upload'].includes(activeNav)) {
        const videosResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/my-videos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (videosResponse.ok) {
          const videosData = await videosResponse.json();
          setMyVideos(videosData.videos || []);
        }
      }

      // Fetch available schools for assignment
      if (activeNav === 'upload') {
        const schoolsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/schools/assigned`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (schoolsResponse.ok) {
          const schoolsData = await schoolsResponse.json();
          setSchools(schoolsData.schools || []);
        }
      }

    } catch (error) {
      console.error('Error fetching teacher data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFormChange = (field, value) => {
    setUploadForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (500MB limit)
      if (file.size > 500 * 1024 * 1024) {
        alert('File size must be less than 500MB');
        return;
      }
      
      // Check file type
      const allowedTypes = ['video/mp4', 'video/mkv', 'video/avi', 'video/mov', 'video/wmv'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid video file (MP4, MKV, AVI, MOV, WMV)');
        return;
      }

      setUploadForm(prev => ({
        ...prev,
        videoFile: file
      }));
    }
  };

  const handleVideoUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.videoFile) {
      alert('Please select a video file');
      return;
    }

    setUploading(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      formData.append('video', uploadForm.videoFile);
      formData.append('title', uploadForm.title);
      formData.append('description', uploadForm.description);
      formData.append('scheduledFor', uploadForm.scheduledFor);
      formData.append('assignedSchools', JSON.stringify(uploadForm.assignedSchools));
      formData.append('subjects', JSON.stringify(uploadForm.subjects));
      formData.append('gradeLevel', uploadForm.gradeLevel);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        alert('Video uploaded and scheduled successfully!');
        setShowUploadForm(false);
        setUploadForm({
          title: '',
          description: '',
          scheduledFor: '',
          assignedSchools: [],
          subjects: [],
          gradeLevel: 'all',
          videoFile: null
        });
        fetchTeacherData(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      scheduled: { color: 'bg-blue-100 text-blue-800', icon: '⏰' },
      live: { color: 'bg-red-100 text-red-800', icon: '🔴' },
      completed: { color: 'bg-green-100 text-green-800', icon: '✅' }
    };
    
    const config = statusConfig[status] || statusConfig.scheduled;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <span className="mr-1">{config.icon}</span>
        {status}
      </span>
    );
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
            {/* Welcome Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome back, {user.name}!
              </h1>
              <p className="text-gray-600">
                {dashboardData?.school ? `Teaching at ${dashboardData.school.name}` : 'Ready to create amazing content!'}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg mr-4">
                    <span className="text-2xl">🎬</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Videos</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.totalVideos || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg mr-4">
                    <span className="text-2xl">✅</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.completedVideos || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-red-100 rounded-lg mr-4">
                    <span className="text-2xl">🔴</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Live Now</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.liveVideos || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg mr-4">
                    <span className="text-2xl">👁️</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Views</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.stats?.totalViews || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Videos */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b flex justify-between items-center">
                <h2 className="text-xl font-semibold">Recent Videos</h2>
                <button
                  onClick={() => setShowUploadForm(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  Upload New Video
                </button>
              </div>
              <div className="p-6">
                {myVideos.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎥</div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No Videos Yet</h3>
                    <p className="text-gray-500 mb-4">Start by uploading your first video!</p>
                    <button
                      onClick={() => setShowUploadForm(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                      Upload Your First Video
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myVideos.slice(0, 5).map((video) => (
                      <div key={video._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{video.title}</h3>
                          <p className="text-sm text-gray-600 mb-2 line-clamp-1">{video.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>📅 {new Date(video.scheduledFor).toLocaleString()}</span>
                            <span>🏫 {video.assignedSchools?.length || 0} schools</span>
                            <span>👁️ {video.viewers?.length || 0} views</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {getStatusBadge(video.status)}
                          <span className="text-sm text-gray-500">
                            {Math.floor(video.duration / 60)} min
                          </span>
                        </div>
                      </div>
                    ))}
                    {myVideos.length > 5 && (
                      <div className="text-center pt-4">
                        <button
                          onClick={() => {/* Navigate to my-videos */}}
                          className="text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          View All Videos →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Schedule */}
            {dashboardData?.upcomingVideos && dashboardData.upcomingVideos.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-semibold">Upcoming Schedule</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {dashboardData.upcomingVideos.map((video) => (
                      <div key={video._id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                        <div>
                          <p className="font-medium">{video.title}</p>
                          <p className="text-sm text-gray-500">
                            {video.assignedSchools?.map(school => school.name).join(', ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(video.scheduledFor).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(video.scheduledFor).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'upload':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Upload New Video</h2>
              <p className="text-gray-600 mt-1">Schedule a video for simulated live delivery.</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleVideoUpload} className="max-w-2xl space-y-6">
                {/* Video File */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video File *
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="video-upload"
                      required
                    />
                    <label htmlFor="video-upload" className="cursor-pointer">
                      <div className="text-4xl mb-2">📹</div>
                      <p className="text-lg font-medium text-gray-900">
                        {uploadForm.videoFile ? uploadForm.videoFile.name : 'Choose video file'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        MP4, MKV, AVI, MOV, WMV (Max 500MB)
                      </p>
                    </label>
                  </div>
                  {uploadForm.videoFile && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ Selected: {uploadForm.videoFile.name} ({(uploadForm.videoFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video Title *
                  </label>
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(e) => handleUploadFormChange('title', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter video title"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) => handleUploadFormChange('description', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Describe your video content"
                    rows="3"
                  />
                </div>

                {/* Schedule */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={uploadForm.scheduledFor}
                    onChange={(e) => handleUploadFormChange('scheduledFor', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>

                {/* Assigned Schools */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign to Schools *
                  </label>
                  <div className="space-y-2">
                    {schools.map((school) => (
                      <label key={school._id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={uploadForm.assignedSchools.includes(school._id)}
                          onChange={(e) => {
                            const schoolId = school._id;
                            setUploadForm(prev => ({
                              ...prev,
                              assignedSchools: e.target.checked
                                ? [...prev.assignedSchools, schoolId]
                                : prev.assignedSchools.filter(id => id !== schoolId)
                            }));
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          {school.name} ({school.code})
                        </span>
                      </label>
                    ))}
                  </div>
                  {uploadForm.assignedSchools.length === 0 && (
                    <p className="text-sm text-red-600 mt-1">Please select at least one school</p>
                  )}
                </div>

                {/* Subjects */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subjects
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['mathematics', 'science', 'english', 'nepali', 'social', 'computer', 'other'].map((subject) => (
                      <label key={subject} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={uploadForm.subjects.includes(subject)}
                          onChange={(e) => {
                            setUploadForm(prev => ({
                              ...prev,
                              subjects: e.target.checked
                                ? [...prev.subjects, subject]
                                : prev.subjects.filter(s => s !== subject)
                            }));
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">
                          {subject}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Grade Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Grade Level
                  </label>
                  <select
                    value={uploadForm.gradeLevel}
                    onChange={(e) => handleUploadFormChange('gradeLevel', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="all">All Grades</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(grade => (
                      <option key={grade} value={grade.toString()}>Grade {grade}</option>
                    ))}
                  </select>
                </div>

                {/* Submit Button */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUploadForm(false)}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !uploadForm.videoFile || uploadForm.assignedSchools.length === 0}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </span>
                    ) : (
                      'Schedule Video'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );

      case 'my-videos':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">My Videos</h2>
              <button
                onClick={() => setShowUploadForm(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm transition-colors"
              >
                Upload New Video
              </button>
            </div>
            <div className="p-6">
              {myVideos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎥</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Videos Yet</h3>
                  <p className="text-gray-500 mb-4">Start by uploading your first video!</p>
                  <button
                    onClick={() => setShowUploadForm(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Upload Your First Video
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Video
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Scheduled For
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Schools
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Views
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Duration
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {myVideos.map((video) => (
                        <tr key={video._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{video.title}</div>
                              <div className="text-sm text-gray-500 line-clamp-1">{video.description}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(video.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(video.scheduledFor).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {video.assignedSchools?.length || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {video.viewers?.length || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {Math.floor(video.duration / 60)} min
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

      default:
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Teacher Dashboard</h2>
            <p>Use the navigation to manage your videos and schedule classes.</p>
          </div>
        );
    }
  };

  return (
    <DashboardLayout user={user}>
      {renderDashboard()}
      
      {/* Upload Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">Upload & Schedule Video</h3>
              <button
                onClick={() => setShowUploadForm(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            {renderDashboard()}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
