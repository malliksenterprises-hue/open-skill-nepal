const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Helper function for API calls
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Request Failed [${endpoint}]:`, error);
    throw error;
  }
};

// Auth API endpoints
export const authAPI = {
  login: (credentials) => 
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: credentials,
    }),
  
  register: (userData) => 
    apiRequest('/api/auth/register', {
      method: 'POST',
      body: userData,
    })
};

// Student API endpoints
export const studentAPI = {
  getAll: () => apiRequest('/api/students'),
  
  getById: (id) => apiRequest(`/api/students/${id}`),
  
  create: (studentData) => 
    apiRequest('/api/students', {
      method: 'POST',
      body: studentData,
    })
};

// Video API endpoints
export const videoAPI = {
  getAll: () => apiRequest('/api/videos')
};

// Dashboard API endpoints
export const dashboardAPI = {
  getStats: () => apiRequest('/api/dashboard/stats')
};

// School API endpoints
export const schoolAPI = {
  getAll: () => apiRequest('/api/schools')
};

// Health check endpoint
export const checkApiHealth = async () => {
  try {
    const health = await apiRequest('/api/health');
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
