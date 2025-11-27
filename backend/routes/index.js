const express = require('express');
const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const studentRoutes = require('./studentRoutes');
const videoRoutes = require('./videoRoutes');
const schoolRoutes = require('./schoolRoutes');

const router = express.Router();

// Mount all routes
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/students', studentRoutes);
router.use('/videos', videoRoutes);
router.use('/schools', schoolRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: '🚀 Open Skill Nepal Backend - WORKING'
  });
});

// Debug route
router.get('/debug/phase2', async (req, res) => {
  try {
    const User = require('../models/User');
    const School = require('../models/School');
    const Video = require('../models/Video');
    
    const [userCount, schoolCount, videoCount] = await Promise.all([
      User.countDocuments(),
      School.countDocuments(),
      Video.countDocuments()
    ]);
    
    res.json({
      phase: 2,
      database: {
        totalUsers: userCount,
        totalSchools: schoolCount,
        totalVideos: videoCount
      },
      timestamp: new Date().toISOString(),
      status: 'operational'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
