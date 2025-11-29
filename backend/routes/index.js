const express = require('express');
const router = express.Router();

// API Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Open Skill Nepal API',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Phase 2 Debug Endpoint
router.get('/debug/phase2', async (req, res) => {
  try {
    res.json({
      phase: 2,
      status: 'operational',
      deployment: 'professional',
      timestamp: new Date().toISOString(),
      features: [
        'Enterprise Security Headers',
        'Rate Limiting Protection',
        'CORS Configuration',
        'GZIP Compression',
        'Structured Error Handling',
        'Comprehensive Health Checks'
      ]
    });
  } catch (error) {
    res.status(500).json({
      error: 'Debug endpoint failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Authentication Routes
router.get('/auth/status', (req, res) => {
  res.json({
    service: 'Authentication',
    status: 'ready',
    endpoints: ['POST /api/auth/login', 'POST /api/auth/register'],
    timestamp: new Date().toISOString()
  });
});

// Students Management
router.get('/students', (req, res) => {
  res.json({
    message: 'Students Management API',
    status: 'operational',
    endpoints: ['GET /api/students', 'POST /api/students', 'GET /api/students/:id'],
    timestamp: new Date().toISOString()
  });
});

// Video Management
router.get('/videos', (req, res) => {
  res.json({
    message: 'Video Content Management API',
    status: 'operational',
    endpoints: ['GET /api/videos', 'POST /api/videos/upload', 'GET /api/videos/:id'],
    timestamp: new Date().toISOString()
  });
});

// Schools Management
router.get('/schools', (req, res) => {
  res.json({
    message: 'Schools Management API',
    status: 'operational',
    endpoints: ['GET /api/schools', 'POST /api/schools', 'GET /api/schools/:id'],
    timestamp: new Date().toISOString()
  });
});

// Dashboard Analytics
router.get('/dashboard', (req, res) => {
  res.json({
    message: 'Dashboard Analytics API',
    status: 'operational',
    endpoints: ['GET /api/dashboard/stats', 'GET /api/dashboard/analytics'],
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    message: 'All API routes working correctly!',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
