const express = require('express');
const router = express.Router();

// Import all route files
const authRoutes = require('./authRoutes');
const studentRoutes = require('./studentRoutes');
const schoolRoutes = require('./schoolRoutes');
const videoRoutes = require('./videoRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const liveSessionRoutes = require('./liveSessionRoutes'); // NEW

// Use routes
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/schools', schoolRoutes);
router.use('/videos', videoRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/live-sessions', liveSessionRoutes); // NEW

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'open-skill-nepal-api'
    });
});

module.exports = router;
