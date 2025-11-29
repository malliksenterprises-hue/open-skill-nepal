const express = require('express');
const { requireRole } = require('../middleware/authMiddleware');
const router = express.Router();

// Student signup with school selection
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, schoolId } = req.body;
    const User = require('../models/User');
    const School = require('../models/School');
    const bcrypt = require('bcryptjs');
    
    // Validation
    if (!name || !email || !password || !schoolId) {
      return res.status(400).json({ 
        message: 'All fields are required: name, email, password, schoolId' 
      });
    }

    // Check if school exists and is active
    const school = await School.findById(schoolId);
    if (!school || school.status !== 'active') {
      return res.status(400).json({ message: 'Invalid or inactive school selected' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create student with pending status
    const student = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'student',
      school: schoolId,
      status: 'pending',
      isActive: false // Cannot login until approved
    });

    await student.save();

    // Add student to school's students array
    school.students.push(student._id);
    await school.save();

    res.status(201).json({
      message: 'Registration successful! Waiting for school admin verification.',
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        status: student.status,
        school: school.name
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Student Signup Error:', error);
    res.status(500).json({ 
      message: 'Registration failed',
      error: error.message 
    });
  }
});

// School Admin: Get pending students for their school
router.get('/pending', requireRole('school_admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const School = require('../models/School');
    
    const school = await School.findOne({ admin: req.user._id });
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    const pendingStudents = await User.find({
      role: 'student',
      school: school._id,
      status: 'pending'
    }).select('name email createdAt school')
      .populate('school', 'name code');

    res.json({
      pendingStudents,
      totalCount: pendingStudents.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Pending Students Error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch pending students',
      error: error.message 
    });
  }
});

// School Admin: Approve/Reject student
router.patch('/:studentId/verify', requireRole('school_admin'), async (req, res) => {
  try {
    const { action, notes } = req.body; // action: 'approve' or 'reject'
    const User = require('../models/User');
    const School = require('../models/School');
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be "approve" or "reject"' });
    }

    const school = await School.findOne({ admin: req.user._id });
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    const student = await User.findOne({
      _id: req.params.studentId,
      school: school._id,
      role: 'student'
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found in your school' });
    }

    student.status = action === 'approve' ? 'approved' : 'rejected';
    student.verificationNotes = notes;
    student.isActive = action === 'approve';

    await student.save();

    res.json({
      message: `Student ${action}d successfully`,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        status: student.status,
        isActive: student.isActive
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Student Verification Error:', error);
    res.status(500).json({ 
      message: 'Failed to verify student',
      error: error.message 
    });
  }
});

// Get all students for a school (School Admin view)
router.get('/school/:schoolId', requireRole('school_admin'), async (req, res) => {
  try {
    const User = require('../models/User');
    const School = require('../models/School');
    
    // Verify the school admin owns this school
    const school = await School.findOne({ 
      _id: req.params.schoolId, 
      admin: req.user._id 
    });
    
    if (!school) {
      return res.status(403).json({ message: 'Access denied to this school' });
    }

    const students = await User.find({
      role: 'student',
      school: school._id
    }).select('name email status isActive createdAt verificationNotes')
      .sort({ createdAt: -1 });

    const stats = {
      total: students.length,
      approved: students.filter(s => s.status === 'approved').length,
      pending: students.filter(s => s.status === 'pending').length,
      rejected: students.filter(s => s.status === 'rejected').length
    };

    res.json({
      students,
      stats,
      school: { name: school.name, code: school.code },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get School Students Error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch students',
      error: error.message 
    });
  }
});

module.exports = router;
