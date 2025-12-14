/**
 * School Routes
 * 
 * Handles school management, teacher assignments, and school administration
 * for Open Skill Nepal platform.
 * 
 * @module routes/schoolRoutes
 */

const express = require('express');
const router = express.Router();
const validationMiddleware = require('../middleware/validationMiddleware');
const auditLogger = require('../utils/auditLogger');
const emailService = require('../utils/emailService');
const { asyncHandler } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Import models
const School = require('../models/School');
const User = require('../models/User');
const ClassLogin = require('../models/ClassLogin');
const LiveClass = require('../models/LiveClass');

/**
 * @route GET /api/schools
 * @desc Get all schools (with filtering)
 * @access Private (Admin, SchoolAdmin)
 */
router.get('/',
  validationMiddleware.validatePagination(),
  validationMiddleware.expressValidator.query('activeOnly').optional().isBoolean(),
  validationMiddleware.expressValidator.query('search').optional().trim(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, activeOnly, search } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query based on user role
    const query = {};
    
    // School admin can only see their own school
    if (req.user.role === 'schoolAdmin') {
      query._id = req.user.schoolId;
    }
    
    // Apply filters
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const [schools, total] = await Promise.all([
      School.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      School.countDocuments(query)
    ]);
    
    // Get statistics for each school
    const schoolsWithStats = await Promise.all(
      schools.map(async (school) => {
        const [teacherCount, classLoginCount, activeClasses] = await Promise.all([
          User.countDocuments({ school: school._id, role: 'teacher', isActive: true }),
          ClassLogin.countDocuments({ school: school._id, isActive: true }),
          LiveClass.countDocuments({ 
            school: school._id, 
            status: { $in: ['scheduled', 'live'] } 
          })
        ]);
        
        const schoolObj = school.toObject();
        schoolObj.stats = {
          teachers: teacherCount,
          classLogins: classLoginCount,
          activeClasses
        };
        
        return schoolObj;
      })
    );
    
    res.json({
      success: true,
      data: schoolsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

/**
 * @route GET /api/schools/:id
 * @desc Get school by ID
 * @access Private (Admin, SchoolAdmin of the school)
 */
router.get('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const school = await School.findById(id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }
    
    // Check permissions
    if (!canAccessSchool(req.user, school._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this school'
      });
    }
    
    // Get detailed statistics
    const [teachers, classLogins, recentLiveClasses, schoolAdmin] = await Promise.all([
      User.find({ school: school._id, role: 'teacher', isActive: true })
        .select('name email avatar isActive')
        .limit(10),
      ClassLogin.find({ school: school._id, isActive: true })
        .select('className section teacher deviceLimit')
        .populate('teacher', 'name')
        .limit(10),
      LiveClass.find({ school: school._id })
        .select('title status scheduledStart endedAt currentParticipants')
        .populate('teacher', 'name')
        .sort({ scheduledStart: -1 })
        .limit(5),
      User.findOne({ school: school._id, role: 'schoolAdmin', isActive: true })
        .select('name email phone')
    ]);
    
    const schoolWithDetails = school.toObject();
    schoolWithDetails.details = {
      teachers,
      classLogins,
      recentLiveClasses,
      schoolAdmin
    };
    
    res.json({
      success: true,
      data: schoolWithDetails
    });
  })
);

/**
 * @route POST /api/schools
 * @desc Create a new school
 * @access Private (Admin)
 */
router.post('/',
  validationMiddleware.validateCreateSchool(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    // Only admin and super admin can create schools
    if (req.user.role !== 'superAdmin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create schools'
      });
    }
    
    const { 
      name, 
      address, 
      email, 
      phone, 
      principalName, 
      website, 
      maxClasses 
    } = req.body;
    
    // Check if school with same name or email already exists
    const existingSchool = await School.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${name}$`, 'i') } },
        { email: email ? { $regex: new RegExp(`^${email}$`, 'i') } : null }
      ]
    });
    
    if (existingSchool) {
      return res.status(400).json({
        success: false,
        message: 'School with this name or email already exists'
      });
    }
    
    // Create school
    const school = new School({
      name,
      address,
      email,
      phone,
      principalName,
      website,
      maxClasses: maxClasses || 50,
      isActive: true,
      createdBy: req.user.userId
    });
    
    await school.save();
    
    // Log school creation
    await auditLogger.logAuditEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.SCHOOL_CREATED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetId: school._id,
      targetType: 'School',
      targetName: school.name,
      description: `School "${school.name}" created by ${req.user.role}`,
      details: {
        name: school.name,
        address: school.address,
        email: school.email
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.status(201).json({
      success: true,
      message: 'School created successfully',
      data: school
    });
  })
);

/**
 * @route PUT /api/schools/:id
 * @desc Update school
 * @access Private (Admin, SchoolAdmin of the school)
 */
router.put('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.expressValidator.body('name').optional().trim().isLength({ min: 2, max: 200 }),
  validationMiddleware.expressValidator.body('address').optional().trim().isLength({ min: 5, max: 500 }),
  validationMiddleware.expressValidator.body('email').optional().trim().isEmail().normalizeEmail(),
  validationMiddleware.expressValidator.body('phone').optional().trim(),
  validationMiddleware.expressValidator.body('principalName').optional().trim().isLength({ max: 100 }),
  validationMiddleware.expressValidator.body('website').optional().trim().isURL(),
  validationMiddleware.expressValidator.body('maxClasses').optional().isInt({ min: 1, max: 1000 }),
  validationMiddleware.expressValidator.body('isActive').optional().isBoolean(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    // Find school
    const school = await School.findById(id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }
    
    // Check permissions
    if (!canManageSchool(req.user, school._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this school'
      });
    }
    
    // School admin can only update certain fields
    if (req.user.role === 'schoolAdmin') {
      const allowedFields = ['address', 'phone', 'principalName', 'website'];
      Object.keys(updates).forEach(key => {
        if (!allowedFields.includes(key)) {
          delete updates[key];
        }
      });
    }
    
    // Store old values for audit log
    const oldValues = {
      name: school.name,
      address: school.address,
      email: school.email,
      isActive: school.isActive
    };
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        school[key] = updates[key];
      }
    });
    
    await school.save();
    
    // Log school update
    await auditLogger.logAuditEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.SCHOOL_UPDATED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetId: school._id,
      targetType: 'School',
      targetName: school.name,
      description: `School "${school.name}" updated by ${req.user.role}`,
      changes: {
        old: oldValues,
        new: {
          name: school.name,
          address: school.address,
          email: school.email,
          isActive: school.isActive
        }
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'School updated successfully',
      data: school
    });
  })
);

/**
 * @route DELETE /api/schools/:id
 * @desc Deactivate school
 * @access Private (Admin)
 */
router.delete('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Only admin and super admin can deactivate schools
    if (req.user.role !== 'superAdmin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to deactivate schools'
      });
    }
    
    // Find school
    const school = await School.findById(id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }
    
    // Deactivate school (soft delete)
    school.isActive = false;
    school.deactivatedAt = new Date();
    school.deactivatedBy = req.user.userId;
    await school.save();
    
    // Deactivate all class logins for this school
    await ClassLogin.updateMany(
      { school: id, isActive: true },
      {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: req.user.userId,
        deactivationReason: 'school_deactivated'
      }
    );
    
    // Deactivate all teachers for this school
    await User.updateMany(
      { school: id, role: 'teacher', isActive: true },
      {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: req.user.userId
      }
    );
    
    // Log school deactivation
    await auditLogger.logAuditEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.SCHOOL_DELETED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetId: school._id,
      targetType: 'School',
      targetName: school.name,
      description: `School "${school.name}" deactivated by ${req.user.role}`,
      details: {
        deactivatedAt: school.deactivatedAt,
        affectedClassLogins: await ClassLogin.countDocuments({ school: id }),
        affectedTeachers: await User.countDocuments({ school: id, role: 'teacher' })
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'School deactivated successfully'
    });
  })
);

/**
 * @route GET /api/schools/:id/teachers
 * @desc Get teachers for a school
 * @access Private (Admin, SchoolAdmin of the school)
 */
router.get('/:id/teachers',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.validatePagination(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20, activeOnly = 'true' } = req.query;
    const skip = (page - 1) * limit;
    
    // Check if school exists
    const school = await School.findById(id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }
    
    // Check permissions
    if (!canAccessSchool(req.user, school._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view teachers for this school'
      });
    }
    
    // Build query
    const query = { school: id, role: 'teacher' };
    
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    
    // Get teachers with pagination
    const [teachers, total] = await Promise.all([
      User.find(query)
        .select('-password -refreshTokens')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    // Get class login count for each teacher
    const teachersWithStats = await Promise.all(
      teachers.map(async (teacher) => {
        const classLoginCount = await ClassLogin.countDocuments({
          teacher: teacher._id,
          isActive: true
        });
        
        const teacherObj = teacher.toObject();
        teacherObj.stats = {
          classLogins: classLoginCount
        };
        
        return teacherObj;
      })
    );
    
    res.json({
      success: true,
      data: teachersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

/**
 * @route POST /api/schools/:id/teachers
 * @desc Assign teacher to school
 * @access Private (Admin, SchoolAdmin of the school)
 */
router.post('/:id/teachers',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.validateAssignTeacher(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { teacherId, subjects } = req.body;
    
    // Check if school exists and is active
    const school = await School.findById(id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }
    
    if (!school.isActive) {
      return res.status(400).json({
        success: false,
        message: 'School is deactivated'
      });
    }
    
    // Check permissions
    if (!canManageSchool(req.user, school._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to assign teachers to this school'
      });
    }
    
    // Check if teacher exists
    const teacher = await User.findById(teacherId);
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }
    
    // Check if teacher is already assigned to a school
    if (teacher.school && teacher.school.toString() !== id) {
      return res.status(400).json({
        success: false,
        message: 'Teacher is already assigned to another school'
      });
    }
    
    // Update teacher
    teacher.school = id;
    if (subjects && subjects.length > 0) {
      teacher.subjects = subjects;
    }
    
    await teacher.save();
    
    // Log teacher assignment
    await auditLogger.logAuditEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.SCHOOL_TEACHER_ASSIGNED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetId: teacher._id,
      targetType: 'User',
      targetName: teacher.name,
      schoolId: id,
      description: `Teacher "${teacher.name}" assigned to school "${school.name}"`,
      details: {
        teacherName: teacher.name,
        teacherEmail: teacher.email,
        schoolName: school.name,
        subjects: teacher.subjects
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'Teacher assigned to school successfully',
      data: teacher
    });
  })
);

/**
 * @route DELETE /api/schools/:id/teachers/:teacherId
 * @desc Remove teacher from school
 * @access Private (Admin, SchoolAdmin of the school)
 */
router.delete('/:id/teachers/:teacherId',
  validationMiddleware.validateObjectIds('id', 'teacherId'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id, teacherId } = req.params;
    
    // Check if school exists
    const school = await School.findById(id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }
    
    // Check permissions
    if (!canManageSchool(req.user, school._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove teachers from this school'
      });
    }
    
    // Check if teacher exists and is assigned to this school
    const teacher = await User.findOne({
      _id: teacherId,
      school: id,
      role: 'teacher'
    });
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found in this school'
      });
    }
    
    // Deactivate teacher's class logins
    await ClassLogin.updateMany(
      { teacher: teacherId, school: id, isActive: true },
      {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: req.user.userId,
        deactivationReason: 'teacher_removed'
      }
    );
    
    // Remove teacher from school
    teacher.school = undefined;
    teacher.subjects = [];
    await teacher.save();
    
    // Log teacher removal
    await auditLogger.logAuditEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.SCHOOL_TEACHER_REMOVED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetId: teacher._id,
      targetType: 'User',
      targetName: teacher.name,
      schoolId: id,
      description: `Teacher "${teacher.name}" removed from school "${school.name}"`,
      details: {
        teacherName: teacher.name,
        teacherEmail: teacher.email,
        schoolName: school.name
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'Teacher removed from school successfully'
    });
  })
);

/**
 * @route GET /api/schools/:id/stats
 * @desc Get school statistics
 * @access Private (Admin, SchoolAdmin of the school)
 */
router.get('/:id/stats',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check if school exists
    const school = await School.findById(id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }
    
    // Check permissions
    if (!canAccessSchool(req.user, school._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view statistics for this school'
      });
    }
    
    // Get comprehensive statistics
    const [
      teacherCount,
      activeTeacherCount,
      classLoginCount,
      activeClassLoginCount,
      totalLiveClasses,
      activeLiveClasses,
      totalDevices,
      activeDevices,
      monthlyStats
    ] = await Promise.all([
      // Teacher stats
      User.countDocuments({ school: id, role: 'teacher' }),
      User.countDocuments({ school: id, role: 'teacher', isActive: true }),
      
      // Class login stats
      ClassLogin.countDocuments({ school: id }),
      ClassLogin.countDocuments({ school: id, isActive: true }),
      
      // Live class stats
      LiveClass.countDocuments({ school: id }),
      LiveClass.countDocuments({ 
        school: id, 
        status: { $in: ['scheduled', 'live'] } 
      }),
      
      // Device stats
      require('../models/Device').countDocuments({ 
        'classLogin.school': id 
      }),
      require('../models/Device').countDocuments({ 
        'classLogin.school': id,
        isActive: true,
        expiresAt: { $gt: new Date() }
      }),
      
      // Monthly statistics (last 6 months)
      LiveClass.aggregate([
        {
          $match: {
            school: school._id,
            scheduledStart: {
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$scheduledStart' },
              month: { $month: '$scheduledStart' }
            },
            count: { $sum: 1 },
            totalParticipants: { $sum: '$currentParticipants' },
            totalDuration: { $sum: '$duration' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
    ]);
    
    // Calculate device limit usage
    const classLogins = await ClassLogin.find({ school: id, isActive: true })
      .select('deviceLimit');
    
    const totalDeviceLimit = classLogins.reduce((sum, cl) => sum + (cl.deviceLimit || 1), 0);
    const deviceLimitUsage = totalDeviceLimit > 0 
      ? Math.round((activeDevices / totalDeviceLimit) * 100) 
      : 0;
    
    const stats = {
      overview: {
        teachers: {
          total: teacherCount,
          active: activeTeacherCount
        },
        classLogins: {
          total: classLoginCount,
          active: activeClassLoginCount
        },
        liveClasses: {
          total: totalLiveClasses,
          active: activeLiveClasses
        },
        devices: {
          total: totalDevices,
          active: activeDevices,
          limitUsage: `${deviceLimitUsage}%`
        }
      },
      monthly: monthlyStats.map(stat => ({
        month: `${stat._id.year}-${stat._id.month.toString().padStart(2, '0')}`,
        classes: stat.count,
        participants: stat.totalParticipants || 0,
        duration: stat.totalDuration || 0
      })),
      school: {
        name: school.name,
        maxClasses: school.maxClasses,
        classUsage: `${classLoginCount}/${school.maxClasses} (${Math.round((classLoginCount / school.maxClasses) * 100)}%)`
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
  })
);

/**
 * Helper function to check if user can access school
 */
function canAccessSchool(user, schoolId) {
  // Super admin can access everything
  if (user.role === 'superAdmin') {
    return true;
  }
  
  // Admin can access all schools
  if (user.role === 'admin') {
    return true;
  }
  
  // School admin can only access their school
  if (user.role === 'schoolAdmin') {
    return user.schoolId && user.schoolId.toString() === schoolId.toString();
  }
  
  return false;
}

/**
 * Helper function to check if user can manage school
 */
function canManageSchool(user, schoolId) {
  // Only admin and super admin can manage schools
  if (user.role === 'superAdmin' || user.role === 'admin') {
    return true;
  }
  
  // School admin can manage their own school (limited fields)
  if (user.role === 'schoolAdmin') {
    return user.schoolId && user.schoolId.toString() === schoolId.toString();
  }
  
  return false;
}

/**
 * Health check for school routes
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const count = await School.countDocuments();
    
    res.json({
      status: 'healthy',
      service: 'school-routes',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        schoolsCount: count
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'school-routes',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
