/**
 * Professional API Configuration
 * Environment-based URL management with fallbacks
 */

// Environment-aware API base URL configuration
const getApiBaseUrl = () => {
  // Priority 1: Environment variable (most professional)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Priority 2: Direct Cloud Run URL (verified working) - UPDATED
  return 'https://open-skill-nepal-669869115660.asia-south1.run.app/api';
};

const API_BASE = getApiBaseUrl();

/**
 * Enhanced API request function with professional error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  // Professional logging
  console.group(`🌐 API Request: ${endpoint}`);
  console.log('Full URL:', url);
  console.log('Method:', options.method || 'GET');
  console.log('Payload:', options.body);
  
  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Important for cookies/auth
    // Professional timeout handling
    signal: AbortSignal.timeout(30000), // 30-second timeout
  };

  // Add body for non-GET requests
  if (options.body && config.method !== 'GET') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    
    // Professional response logging
    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseData = await response.json();
    console.log('Response Data:', responseData);
    
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${responseData.message || 'Request failed'}`
      );
    }

    console.groupEnd();
    return responseData;
    
  } catch (error) {
    // Professional error categorization
    console.groupEnd();
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: Server took too long to respond');
    } else if (error.name === 'TypeError') {
      throw new Error('Network error: Cannot connect to server');
    } else {
      throw error;
    }
  }
}

/**
 * Professional Authentication API Service
 */
export const authAPI = {
  login: async (email, password) => {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    
    return apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
  },

  googleLogin: (googleData) => {
    if (!googleData?.email || !googleData?.googleId) {
      throw new Error('Google authentication data is incomplete');
    }
    
    return apiRequest('/auth/google-login', {
      method: 'POST',
      body: googleData
    });
  },

  getMe: (token) => {
    if (!token) {
      throw new Error('Authentication token is required');
    }
    
    return apiRequest('/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  },

  logout: (token) => {
    return apiRequest('/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }
};

/**
 * Professional Dashboard API Service
 */
export const dashboardAPI = {
  getSuperAdminData: async (token) => {
    // Professional mock data structure
    return {
      stats: {
        totalUsers: 1250,
        totalSchools: 45,
        activeCourses: 89,
        revenue: '₹1,25,000',
        growthRate: '+12%'
      },
      recentActivity: [
        { 
          id: 1, 
          action: 'New school registered', 
          time: '2 hours ago',
          user: 'Admin User'
        },
        { 
          id: 2, 
          action: 'Course created', 
          time: '5 hours ago',
          user: 'Teacher User'
        }
      ],
      timestamp: new Date().toISOString()
    };
  },

  getAdminData: async (token) => {
    return {
      stats: {
        managedSchools: 12,
        totalTeachers: 85,
        activeStudents: 750,
        pendingApprovals: 5,
        completionRate: '87%'
      },
      schools: [
        { 
          id: 1, 
          name: 'Kathmandu High School', 
          teachers: 15, 
          students: 300,
          status: 'Active'
        }
      ],
      timestamp: new Date().toISOString()
    };
  },

  getTeacherData: async (token) => {
    return {
      schedule: [
        { 
          id: 1, 
          subject: 'Mathematics', 
          time: '10:00 AM', 
          class: 'Grade 10',
          room: 'Room 101'
        }
      ],
      performance: {
        averageRating: 4.8,
        completedClasses: 45,
        studentSatisfaction: '96%'
      },
      timestamp: new Date().toISOString()
    };
  },

  getSchoolAdminData: async (token) => {
    return {
      schoolInfo: {
        name: 'Kathmandu High School',
        students: 450,
        teachers: 25,
        classes: 15,
        established: '2010'
      },
      liveClasses: [
        { 
          id: 1, 
          subject: 'Mathematics', 
          teacher: 'John Doe', 
          time: 'Ongoing',
          participants: 32
        }
      ],
      timestamp: new Date().toISOString()
    };
  },

  getStudentData: async (token) => {
    return {
      enrolledCourses: [
        { 
          id: 1, 
          name: 'Basic Mathematics', 
          progress: 75,
          instructor: 'Dr. Sharma',
          nextSession: '2024-01-15'
        }
      ],
      performance: {
        averageGrade: 'A-',
        completedAssignments: 12,
        attendance: '95%'
      },
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Professional API Health Check
 */
export const checkApiHealth = async () => {
  try {
    const health = await apiRequest('/health');
    return {
      status: 'healthy',
      database: health.database,
      timestamp: health.timestamp
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};
