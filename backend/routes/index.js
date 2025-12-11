const express = require('express');
const router = express.Router();

// Import route files
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const classRoutes = require('./classRoutes');
const liveSessionRoutes = require('./liveSessionRoutes');
const deviceRoutes = require('./deviceRoutes'); // Add this line

// Use routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/classes', classRoutes);
router.use('/live-sessions', liveSessionRoutes);
router.use('/devices', deviceRoutes); // Add this line

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Phase 3 - Live Classes Implemented with Device Limits',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;
