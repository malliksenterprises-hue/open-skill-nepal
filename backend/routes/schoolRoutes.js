const express = require('express');
const { requireRole } = require('../middleware/authMiddleware');
const router = express.Router();

// Get all active schools (for student signup)
router.get('/active', async (req, res) => {
  try {
    const School = require('../models/School');
    
    const schools = await School.find({ status: 'active' })
      .select('name code address contact deviceLimit')
      .sort({ name: 1 });

    res.json({
      schools,
      totalCount: schools.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Active Schools Error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch schools',
      error: error.message 
    });
  }
});

// Get schools assigned to teacher
router.get('/assigned', requireRole('teacher'), async (req, res) => {
  try {
    const School = require('../models/School');
    
    const schools = await School.find({ 
      teachers: req.user._id,
      status: 'active'
    }).select('name code address');

    res.json({
      schools,
      totalCount: schools.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Assigned Schools Error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch assigned schools',
      error: error.message 
    });
  }
});

// Get schools for admin management
router.get('/admin-schools', requireRole('admin'), async (req, res) => {
  try {
    const School = require('../models/School');
    const { status, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status && ['active', 'pending', 'inactive'].includes(status)) {
      query.status = status;
    }

    const schools = await School.find(query)
      .populate('admin', 'name email')
      .populate('teachers', 'name email')
      .populate('students', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await School.countDocuments(query);

    res.json({
      schools,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalSchools: total,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Admin Schools Error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch schools',
      error: error.message 
    });
  }
});

// Assign teacher to school (Admin only)
router.post('/:schoolId/assign-teacher', requireRole('admin'), async (req, res) => {
  try {
    const { teacherId } = req.body;
    const School = require('../models/School');
    const User = require('../models/User');

    // Check if teacher exists
    const teacher = await User.findOne({ 
      _id: teacherId, 
      role: 'teacher' 
    });
    
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const school = await School.findById(req.params.schoolId);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // Check if teacher is already assigned
    if (school.teachers.includes(teacherId)) {
      return res.status(400).json({ message: 'Teacher already assigned to this school' });
    }

    // Add teacher to school
    school.teachers.push(teacherId);
    await school.save();

    // Update teacher's school reference
    teacher.school = school._id;
    await teacher.save();

    res.json({
      message: 'Teacher assigned to school successfully',
      school: {
        id: school._id,
        name: school.name,
        teachers: school.teachers
      },
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Assign Teacher Error:', error);
    res.status(500).json({ 
      message: 'Failed to assign teacher',
      error: error.message 
    });
  }
});

// Update school status (Admin only)
router.patch('/:schoolId/status', requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const School = require('../models/School');

    if (!['active', 'pending', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const school = await School.findByIdAndUpdate(
      req.params.schoolId,
      { status },
      { new: true }
    ).populate('admin', 'name email');

    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    res.json({
      message: `School status updated to ${status}`,
      school: {
        id: school._id,
        name: school.name,
        code: school.code,
        status: school.status,
        admin: school.admin
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update School Status Error:', error);
    res.status(500).json({ 
      message: 'Failed to update school status',
      error: error.message 
    });
  }
});

// Get school statistics
router.get('/:schoolId/stats', requireRole('school_admin'), async (req, res) => {
  try {
    const School = require('../models/School');
    const User = require('../models/User');
    const Video = require('../models/Video');

    const school = await School.findById(req.params.schoolId);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // Verify the requesting user is admin of this school
    if (school.admin.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied to this school' });
    }

    const [
      totalStudents,
      pendingStudents,
      approvedStudents,
      totalTeachers,
      totalVideos,
      liveVideos
    ] = await Promise.all([
      User.countDocuments({ school: school._id, role: 'student' }),
      User.countDocuments({ school: school._id, role: 'student', status: 'pending' }),
      User.countDocuments({ school: school._id, role: 'student', status: 'approved' }),
      User.countDocuments({ school: school._id, role: 'teacher' }),
      Video.countDocuments({ assignedSchools: school._id }),
      Video.countDocuments({ assignedSchools: school._id, status: 'live' })
    ]);

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
        totalVideos,
        liveVideos,
        deviceUsage: Math.round((totalStudents / school.deviceLimit) * 100)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get School Stats Error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch school statistics',
      error: error.message 
    });
  }
});

module.exports = router;
