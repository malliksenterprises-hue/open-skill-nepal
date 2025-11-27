const express = require('express');
const User = require('../models/User');
const School = require('../models/School');
const Video = require('../models/Video');
const router = express.Router();

// GET /api/dashboard/admin
router.get('/admin', async (req, res) => {
  try {
    const [pendingSchools, activeSchools, totalTeachers, totalVideos, unassignedTeachers] = await Promise.all([
      School.countDocuments({ status: 'pending' }),
      School.countDocuments({ status: 'active' }),
      User.countDocuments({ role: 'teacher' }),
      Video.countDocuments(),
      User.find({ role: 'teacher', school: null }).select('name email qualifications')
    ]);

    res.json({
      stats: {
        pendingSchools,
        activeSchools,
        totalTeachers,
        totalVideos
      },
      pendingSchools: await School.find({ status: 'pending' }).populate('admin', 'name email'),
      unassignedTeachers,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch admin dashboard data',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/dashboard/student
router.get('/student', async (req, res) => {
  try {
    // Mock data - replace with actual student data
    res.json({
      stats: {
        activeClasses: 3,
        videosWatched: 12,
        assignmentsCompleted: 8
      },
      upcomingClasses: [],
      recentVideos: [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch student dashboard data',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/dashboard/teacher
router.get('/teacher', async (req, res) => {
  try {
    const totalVideos = await Video.countDocuments();
    
    res.json({
      stats: {
        totalVideos,
        scheduledClasses: 5,
        studentsEnrolled: 45
      },
      recentVideos: await Video.find().limit(5).populate('teacher', 'name'),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Teacher dashboard error:', error);
    res.status(500).json({
      error: 'Failed to fetch teacher dashboard data',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
