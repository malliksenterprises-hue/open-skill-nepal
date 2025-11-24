const express = require('express');
const cors = require('cors');

const app = express();

// =======================
// FIXED CORS CONFIGURATION
// =======================
app.use(cors({
  origin: [
    'https://openskillnepal.com',
    'https://www.openskillnepal.com',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());

// =======================
// ROOT ROUTE
// =======================
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Open Skill Nepal Backend - WORKING',
    timestamp: new Date().toISOString()
  });
});

// =======================
// AUTHENTICATION ROUTES
// =======================
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('📨 Login attempt:', email);

    // Simple test authentication
    if (email === 'student@example.com' && password === 'password') {
      res.json({
        message: 'Login successful!',
        token: 'test-token-123',
        user: {
          _id: '1',
          name: 'Student User',
          email: 'student@example.com',
          role: 'student'
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(401).json({
        message: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET CURRENT USER PROFILE
app.get('/api/auth/me', (req, res) => {
  res.json({
    _id: '1',
    name: 'Student User', 
    email: 'student@example.com',
    role: 'student',
    timestamp: new Date().toISOString()
  });
});

// LOGOUT
app.post('/api/auth/logout', (req, res) => {
  res.json({
    message: 'Logout successful',
    timestamp: new Date().toISOString()
  });
});

// =======================
// DASHBOARD ROUTES
// =======================
app.get('/api/dashboard/student', (req, res) => {
  res.json({
    enrolledCourses: [
      {
        id: 1,
        name: 'Basic Mathematics',
        progress: 75,
        instructor: 'Dr. Sharma',
        nextSession: '2024-01-15'
      },
      {
        id: 2, 
        name: 'English Literature',
        progress: 60,
        instructor: 'Ms. Gurung',
        nextSession: '2024-01-16'
      }
    ],
    performance: {
      averageGrade: 'A-',
      completedAssignments: 12,
      attendance: '95%'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Test auth route
app.get('/api/auth/test', (req, res) => {
  res.json({
    message: 'Auth route is working!',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Authentication routes loaded`);
  console.log(`✅ Dashboard routes loaded`);
});
