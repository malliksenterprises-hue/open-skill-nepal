const express = require('express');
const { requireRole } = require('../middleware/authMiddleware');
const router = express.Router();

// Get all schools (for super admin and student signup)
router.get('/', async (req, res) => {
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
    console.error('Get Schools Error:', error);
    res.status(500).json({
      message: 'Failed to fetch schools',
      error: error.message
    });
  }
});

// Super Admin: Create new school
router.post('/', requireRole('super_admin'), async (req, res) => {
  try {
    const { name, code, address, contact, deviceLimit, adminId } = req.body;
    const School = require('../models/School');
    const User = require('../models/User');

    // Validation
    if (!name || !code || !adminId) {
      return res.status(400).json({
        message: 'Required fields: name, code, adminId'
      });
    }

    // Check if admin exists and is an admin role
    const admin = await User.findOne({
      _id: adminId,
      role: 'admin'
    });

    if (!admin) {
      return res.status(400).json({ message: 'Invalid admin user' });
    }

    // Check if school code already exists
    const existingSchool = await School.findOne({ code: code.toUpperCase() });
    if (existingSchool) {
      return res.status(400).json({ message: 'School code already exists' });
    }

    const school = new School({
      name,
      code: code.toUpperCase(),
      address,
      contact,
      deviceLimit: deviceLimit || 100,
      admin: adminId,
      status: 'active'
    });

    await school.save();

    res.status(201).json({
      message: 'School created successfully',
      school: {
        id: school._id,
        name: school.name,
        code: school.code,
        admin: admin.name,
        status: school.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create School Error:', error);
    res.status(500).json({
      message: 'Failed to create school',
      error: error.message
    });
  }
});

// Super Admin: Update school status
router.patch('/:schoolId/status', requireRole('super_admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const School = require('../models/School');

    if (!['active', 'inactive', 'pending'].includes(status)) {
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
        admin: school.admin.name
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

// Admin: Assign teacher to school
router.post('/:schoolId/teachers', requireRole('admin'), async (req, res) => {
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
      return res.status(400).json({ message: 'Invalid teacher' });
    }

    const school = await School.findById(req.params.schoolId);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // Check if teacher already assigned
    if (school.teachers.includes(teacherId)) {
      return res.status(400).json({ message: 'Teacher already assigned to this school' });
    }

    school.teachers.push(teacherId);
    await school.save();

    res.json({
      message: 'Teacher assigned to school successfully',
      school: {
        id: school._id,
        name: school.name,
        code: school.code
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

module.exports = router;
