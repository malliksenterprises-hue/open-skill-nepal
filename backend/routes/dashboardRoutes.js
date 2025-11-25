const express = require('express');
const { requireRole } = require('../middleware/authMiddleware');
const router = express.Router();

// Super Admin Dashboard
router.get('/super-admin', requireRole('super_admin'), async (req, res) => {
  try {
    const School = require('../models/School');
    const User = require('../models/User');
    const Video = require('../models/Video');
    
    const [schools, admins, teachers, students, activeClasses] = await Promise.all([
      School.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'student', status: 'approved' }),
      Video.countDocuments({ status: 'live' })
    ]);
    
    const recentSchools = await School.find()
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.json({
      stats: {
        totalSchools: schools,
        totalAdmins: admins,
        totalTeachers: teachers,
        totalStudents: students,
        activeClasses: activeClasses
      },
      recentSchools,
      systemHealth: 'optimal',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Super Admin Dashboard Error:', error);
    res.status(500).json({ 
      message: 'Failed to load dashboard',
      error: error.message 
    });
  }
});

// Admin Dashboard
router.get('/admin', requireRole('admin'), async (req, res) => {
  try {
    const School = require('../models/School');
    const User = require('../models/User');
    
    const [pendingSchools, teachers, activeSchools] = await Promise.all([
      School.find({ status: 'pending' }).populate('admin', 'name email'),
      User.find({ role: 'teacher' }).select('name email createdAt'),
      School.countDocuments({ status: 'active' })
    ]);
    
    res.json({
      pendingSchools,
      teachers,
      stats: {
        pendingApprovals: pendingSchools.length,
        assignedTeachers: teachers.length,
        activeSchools: activeSchools
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    res.status(500).json({ 
      message: 'Failed to load dashboard',
      error: error.message 
    });
  }
});

// School Admin Dashboard
router.get('/school-admin', requireRole('school_admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const School = require('../models/School');
    const Video = require('../models/Video');
    
    const school = await School.findOne({ admin: req.user._id });
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    
    const [pendingStudents, scheduledClasses, totalStudents, deliveredClasses] = await Promise.all([
      User.find({ 
        role: 'student', 
        school: school._id, 
        status: 'pending' 
      }).select('name email createdAt'),
      
      Video.find({ 
        school: school._id,
        status: 'scheduled',
        scheduledFor: { $gte: new Date() }
      }).populate('teacher', 'name')
        .sort({ scheduledFor: 1 })
        .limit(10),
      
      User.countDocuments({ 
        role: 'student', 
        school: school._id, 
        status: 'approved' 
      }),
      
      Video.countDocuments({ 
        school: school._id,
        status: 'completed'
      })
    ]);
    
    res.json({
      schoolInfo: school,
      pendingStudents,
      scheduledClasses,
      stats: {
        totalStudents: totalStudents,
        pendingVerifications: pendingStudents.length,
        upcomingClasses: scheduledClasses.length,
        deliveredClasses: deliveredClasses
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('School Admin Dashboard Error:', error);
    res.status(500).json({ 
      message: 'Failed to load dashboard',
      error: error.message 
    });
  }
});

// Teacher Dashboard
router.get('/teacher', requireRole('teacher'), async (req, res) => {
  try {
    const Video = require('../models/Video');
    const School = require('../models/School');
    
    const school = await School.findOne({ teachers: req.user._id });
    const myVideos = await Video.find({ teacher: req.user._id })
      .populate('school', 'name')
      .sort({ scheduledFor: 1 });
    
    const scheduled = myVideos.filter(v => v.status === 'scheduled');
    const completed = myVideos.filter(v => v.status === 'completed');
    const live = myVideos.filter(v => v.status === 'live');
    
    res.json({
      school: school,
      myVideos,
      schedule: scheduled,
      stats: {
        totalUploads: myVideos.length,
        scheduledClasses: scheduled.length,
        completedClasses: completed.length,
        liveClasses: live.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Teacher Dashboard Error:', error);
    res.status(500).json({ 
      message: 'Failed to load dashboard',
      error: error.message 
    });
  }
});

// Student Dashboard
router.get('/student', requireRole('student'), async (req, res) => {
  try {
    // Check if student is approved
    if (req.user.status !== 'approved') {
      return res.status(403).json({ 
        message: 'Account pending verification by school admin',
        status: 'pending'
      });
    }
    
    const Video = require('../models/Video');
    const now = new Date();
    
    const [liveClasses, upcomingClasses, recordedClasses] = await Promise.all([
      // Live classes (scheduled for now or recent past, not completed)
      Video.find({
        school: req.user.school,
        status: { $in: ['scheduled', 'live'] },
        scheduledFor: { 
          $lte: new Date(now.getTime() + 30 * 60000), // 30 minutes buffer
          $gte: new Date(now.getTime() - 120 * 60000) // 2 hours ago
        }
      }).populate('teacher', 'name'),
      
      // Upcoming classes
      Video.find({
        school: req.user.school,
        status: 'scheduled',
        scheduledFor: { $gt: now }
      }).populate('teacher', 'name')
        .sort({ scheduledFor: 1 })
        .limit(10),
      
      // Recorded classes
      Video.find({
        school: req.user.school,
        status: 'completed'
      }).populate('teacher', 'name')
        .sort({ scheduledFor: -1 })
        .limit(10)
    ]);
    
    res.json({
      studentStatus: req.user.status,
      liveClasses,
      upcomingClasses,
      recordedClasses,
      stats: {
        liveNow: liveClasses.length,
        upcoming: upcomingClasses.length,
        completed: recordedClasses.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Student Dashboard Error:', error);
    res.status(500).json({ 
      message: 'Failed to load dashboard',
      error: error.message 
    });
  }
});

module.exports = router;
