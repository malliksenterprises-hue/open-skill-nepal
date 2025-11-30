cat > /workspaces/open-skill-nepal/frontend/utils/api.js << 'EOF'
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * Generic API request handler
 */
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Auth API endpoints
export const authAPI = {
  login: (credentials) => 
    apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  
  register: (userData) => 
    apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
};

// Student API endpoints
export const studentAPI = {
  getAll: () => apiRequest('/api/students'),
  
  getById: (id) => apiRequest(`/api/students/${id}`),
  
  create: (studentData) => 
    apiRequest('/api/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
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

/**
 * Professional API Health Check
 */
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
EOF
