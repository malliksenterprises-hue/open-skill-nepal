const express = require('express');
const router = express.Router();

// Import individual route files
const authRoutes = require('./authRoutes');
const studentRoutes = require('./studentRoutes');
const videoRoutes = require('./videoRoutes');
const schoolRoutes = require('./schoolRoutes');
const dashboardRoutes = require('./dashboardRoutes');

// Mount all routes
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/videos', videoRoutes);
router.use('/schools', schoolRoutes);
router.use('/dashboard', dashboardRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Open Skill Nepal API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Debug endpoint for phase 2
router.get('/debug/phase2', (req, res) => {
  res.status(200).json({
    phase: 2,
    status: 'in-progress',
    message: 'Backend API development in progress',
    completed: ['infrastructure', 'security', 'basic-routes'],
    pending: ['database', 'authentication', 'file-upload'],
    timestamp: new Date().toISOString()
  });
});

// Handle 404 for undefined API routes
router.all('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `API route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
