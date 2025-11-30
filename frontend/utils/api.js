cat > /workspaces/open-skill-nepal/frontend/utils/api.js << 'EOF'
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://open-skill-nepal-669869115660.asia-south1.run.app';

// Auth API endpoints
export const authAPI = {
  login: async (credentials) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      if (!response.ok) {
        throw new Error(`Login failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Auth API Error:', error);
      throw error;
    }
  },
  
  register: async (userData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        throw new Error(`Registration failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Auth API Error:', error);
      throw error;
    }
  },
  
  logout: async () => {
    // Clear local storage and state
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return Promise.resolve({ success: true });
  }
};

// Student API endpoints
export const studentAPI = {
  getAll: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/students`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch students: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Student API Error:', error);
      throw error;
    }
  },
  
  getById: async (id, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/students/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch student: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Student API Error:', error);
      throw error;
    }
  },
  
  create: async (studentData, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/students`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(studentData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create student: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Student API Error:', error);
      throw error;
    }
  }
};

// Video API endpoints
export const videoAPI = {
  getAll: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/videos`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch videos: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Video API Error:', error);
      throw error;
    }
  }
};

// Dashboard API endpoints
export const dashboardAPI = {
  getStats: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard stats: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Dashboard API Error:', error);
      throw error;
    }
  }
};

// School API endpoints
export const schoolAPI = {
  getAll: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/schools`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch schools: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('School API Error:', error);
      throw error;
    }
  }
};
EOF
