const express = require('express');
const { requireRole } = require('../middleware/authMiddleware');
const router = express.Router();

// Get dashboard data based on user role
router.get('/', async (req, res) => {
  try {
    const User = require('../models/User');
    const School = require('../models/School');
    const Video = require('../models/Video');
    
    const user = await User.findById(req.user._id);
    const dashboardData = await user.getDashboardData();

    res.json({
      ...dashboardData,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    res.status(500).json({ 
      message: 'Failed to load dashboard',
      error: error.message 
    });
  }
});

// Super Admin Dashboard Stats
router.get('/super-admin', requireRole('super_admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const School = require('../models/School');
    const Video = require('../models/Video');

    const [
      totalSchools,
      activeSchools,
      pendingSchools,
      totalAdmins,
      totalTeachers,
      totalStudents,
      totalVideos,
      liveVideos
    ] = await Promise.all([
      School.countDocuments(),
      School.countDocuments({ status: 'active' }),
      School.countDocuments({ status: 'pending' }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'student' }),
      Video.countDocuments(),
      Video.countDocuments({ status: 'live' })
    ]);

    // Recent activities
    const recentSchools = await School.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name code status createdAt');

    const recentVideos = await Video.find()
      .populate('teacher', 'name')
      .populate('assignedSchools', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title teacher assignedSchools status scheduledFor');

    res.json({
      stats: {
        totalSchools,
        activeSchools,
        pendingSchools,
        totalAdmins,
        totalTeachers,
        totalStudents,
        totalVideos,
        liveVideos
      },
      recentActivities: {
        schools: recentSchools,
        videos: recentVideos
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Super Admin Dashboard Error:', error);
    res.status(500).json({ 
      message: 'Failed to load super admin dashboard',
      error: error.message 
    });
  }
});

// Admin Dashboard Stats (Open Skill Nepal coordinator)
router.get('/admin', requireRole('admin'), async (req, res) => {
  try {
    const School = require('../models/School');
    const User = require('../models/User');
    const Video = require('../models/Video');

    const [
      pendingSchools,
      activeSchools,
      totalTeachers,
      assignedTeachers,
      totalVideos
    ] = await Promise.all([
      School.countDocuments({ status: 'pending' }),
      School.countDocuments({ status: 'active' }),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'teacher', school: { $exists: true, $ne: null } }),
      Video.countDocuments()
    ]);

    // Schools needing attention
    const pendingSchoolsList = await School.find({ status: 'pending' })
      .populate('admin', 'name email')
      .select('name code admin address createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    // Teacher assignments needed
    const unassignedTeachers = await User.find({ 
      role: 'teacher', 
      school: { $exists: false } 
    })
    .select('name email qualifications createdAt')
    .limit(10);

    res.json({
      stats: {
        pendingSchools,
        activeSchools,
        totalTeachers,
        assignedTeachers,
        unassignedTeachers: totalTeachers - assignedTeachers,
        totalVideos
      },
      pendingSchools: pendingSchoolsList,
      unassignedTeachers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    res.status(500).json({ 
      message: 'Failed to load admin dashboard',
      error: error.message 
    });
  }
});

// School Admin Dashboard Stats
router.get('/school-admin', requireRole('school_admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const School = require('../models/School');
    const Video = require('../models/Video');

    const school = await School.findOne({ admin: req.user._id });
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    const [
      totalStudents,
      pendingStudents,
      approvedStudents,
      totalTeachers,
      scheduledClasses,
      liveClasses,
      completedClasses
    ] = await Promise.all([
      User.countDocuments({ school: school._id, role: 'student' }),
      User.countDocuments({ school: school._id, role: 'student', status: 'pending' }),
      User.countDocuments({ school: school._id, role: 'student', status: 'approved' }),
      User.countDocuments({ school: school._id, role: 'teacher' }),
      Video.countDocuments({ assignedSchools: school._id, status: 'scheduled' }),
      Video.countDocuments({ assignedSchools: school._id, status: 'live' }),
      Video.countDocuments({ assignedSchools: school._id, status: 'completed' })
    ]);

    // Recent student signups
    const recentStudents = await User.find({ 
      school: school._id, 
      role: 'student' 
    })
    .select('name email status createdAt')
    .sort({ createdAt: -1 })
    .limit(5);

    // Upcoming classes
    const upcomingClasses = await Video.find({
      assignedSchools: school._id,
      status: 'scheduled',
      scheduledFor: { $gt: new Date() }
    })
    .populate('teacher', 'name')
    .select('title teacher scheduledFor')
    .sort({ scheduledFor: 1 })
    .limit(5);

    res.json({
      school: {
        id: school._id,
        name: school.name,
        code: school.code,
        deviceLimit: school.deviceLimit
      },
      stats: {
        totalStudents,
        pendingStudents,
        approvedStudents,
        totalTeachers,
        scheduledClasses,
        liveClasses,
        completedClasses
      },
      recentStudents,
      upcomingClasses,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('School Admin Dashboard Error:', error);
    res.status(500).json({ 
      message: 'Failed to load school admin dashboard',
      error: error.message 
    });
  }
});

// Teacher Dashboard Stats
router.get('/teacher', requireRole('teacher'), async (req, res) => {
  try {
    const Video = require('../models/Video');
    const School = require('../models/School');

    const school = await School.findById(req.user.school);
    const [
      totalVideos,
      scheduledVideos,
      liveVideos,
      completedVideos,
      totalViews
    ] = await Promise.all([
      Video.countDocuments({ teacher: req.user._id }),
      Video.countDocuments({ teacher: req.user._id, status: 'scheduled' }),
      Video.countDocuments({ teacher: req.user._id, status: 'live' }),
      Video.countDocuments({ teacher: req.user._id, status: 'completed' }),
      Video.aggregate([
        { $match: { teacher: req.user._id } },
        { $project: { viewCount: { $size: '$viewers' } } },
        { $group: { _id: null, total: { $sum: '$viewCount' } } }
      ])
    ]);

    // Recent uploads
    const recentVideos = await Video.find({ teacher: req.user._id })
      .populate('assignedSchools', 'name')
      .select('title assignedSchools status scheduledFor viewers')
      .sort({ createdAt: -1 })
      .limit(5);

    // Upcoming scheduled videos
    const upcomingVideos = await Video.find({
      teacher: req.user._id,
      status: 'scheduled',
      scheduledFor: { $gt: new Date() }
    })
    .populate('assignedSchools', 'name')
    .select('title assignedSchools scheduledFor')
    .sort({ scheduledFor: 1 })
    .limit(5);

    res.json({
      school: school ? { name: school.name, code: school.code } : null,
      stats: {
        totalVideos,
        scheduledVideos,
        liveVideos,
        completedVideos,
        totalViews: totalViews[0]?.total || 0
      },
      recentVideos,
      upcomingVideos,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Teacher Dashboard Error:', error);
    res.status(500).json({ 
      message: 'Failed to load teacher dashboard',
      error: error.message 
    });
  }
});

module.exports = router;
