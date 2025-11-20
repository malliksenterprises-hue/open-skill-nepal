// Base API URL - FIXED: Use your Cloud Run backend
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://open-skill-nepal-669869115660.asia-south1.run.app/api'

/**
 * Generic API request function
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  
  console.log('🔗 API Request:', url) // Add logging
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    // REMOVED credentials line to fix CORS issues
    ...options,
  }

  // Add body if provided
  if (options.body) {
    config.body = JSON.stringify(options.body)
  }

  try {
    const response = await fetch(url, config)
    const data = await response.json()

    if (!response.ok) {
      throw {
        message: data.message || 'API request failed',
        status: response.status,
        data: data
      }
    }

    return data
  } catch (error) {
    console.error('❌ API request error:', error)
    throw error
  }
}

/**
 * Authentication API methods
 */
export const authAPI = {
  // Email/password login
  login: (email, password) => 
    apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password }
    }),

  // Google OAuth login
  googleLogin: (googleData) =>
    apiRequest('/auth/google-login', {
      method: 'POST',
      body: googleData
    }),

  // Get current user
  getMe: (token) =>
    apiRequest('/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }),

  // Logout
  logout: (token) =>
    apiRequest('/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
}

/**
 * Role-based dashboard data (mock for Phase 1)
 */
export const dashboardAPI = {
  getSuperAdminData: (token) => 
    Promise.resolve({
      stats: {
        totalUsers: 1250,
        totalSchools: 45,
        activeCourses: 89,
        revenue: '₹1,25,000'
      },
      recentActivity: [
        { id: 1, action: 'New school registered', time: '2 hours ago' },
        { id: 2, action: 'Course created', time: '5 hours ago' },
        { id: 3, action: 'User role updated', time: '1 day ago' }
      ]
    }),

  getAdminData: (token) =>
    Promise.resolve({
      stats: {
        managedSchools: 12,
        totalTeachers: 85,
        activeStudents: 750,
        pendingApprovals: 5
      },
      schools: [
        { id: 1, name: 'Kathmandu High School', teachers: 15, students: 300 },
        { id: 2, name: 'Pokhara Public School', teachers: 12, students: 250 }
      ]
    }),

  getTeacherData: (token) =>
    Promise.resolve({
      schedule: [
        { id: 1, subject: 'Mathematics', time: '10:00 AM', class: 'Grade 10' },
        { id: 2, subject: 'Science', time: '2:00 PM', class: 'Grade 9' }
      ],
      upcomingClasses: [
        { id: 1, date: '2024-01-15', subject: 'Math', students: 35 }
      ]
    }),

  getSchoolAdminData: (token) =>
    Promise.resolve({
      schoolInfo: {
        name: 'Kathmandu High School',
        students: 450,
        teachers: 25,
        classes: 15
      },
      liveClasses: [
        { id: 1, subject: 'Mathematics', teacher: 'John Doe', time: 'Ongoing' }
      ]
    }),

  getStudentData: (token) =>
    Promise.resolve({
      enrolledCourses: [
        { id: 1, name: 'Basic Mathematics', progress: 75 },
        { id: 2, name: 'Science Fundamentals', progress: 40 }
      ],
      recommendedCourses: [
        { id: 3, name: 'Advanced Programming' },
        { id: 4, name: 'Web Development Basics' }
      ]
    })
}
