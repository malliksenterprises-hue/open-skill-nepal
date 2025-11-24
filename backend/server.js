const express = require('express');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(cors());
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
// SIMPLE AUTH ROUTE (NO DATABASE)
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
});
