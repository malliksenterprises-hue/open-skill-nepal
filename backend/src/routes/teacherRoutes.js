/**
 * Teacher Routes
 * 
 * Handles teacher account management, profile updates, and teaching activities
 * for Open Skill Nepal platform.
 * 
 * @module routes/teacherRoutes
 */

const express = require('express');
const router = express.Router();
const validationMiddleware = require('../middleware/validationMiddleware');
const authUtils = require('../utils/authUtils');
const auditLogger = require('../utils/auditLogger');
const emailService = require('../utils/emailService');
const { asyncHandler } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Import models
const User = require('../models/User');
const School = require('../models/School');
const ClassLogin = require('../models/ClassLogin');
const LiveClass = require('../models/LiveClass');

/**
 * @route GET /api/teachers
 * @desc Get all teachers (with filtering)
 * @access Private (Admin, SchoolAdmin)
 */
router.get('/',
  validationMiddleware.validatePagination(),
  validationMiddleware.expressValidator.query('schoolId').optional(),
  validationMiddleware.expressValidator.query('activeOnly').optional().isBoolean(),
  validationMiddleware.expressValidator.query('search').optional().trim(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, schoolId, activeOnly, search } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query based on user role
    const query = { role: 'teacher' };
    
    // Apply filters based on user role
    if (req.user.role === 'schoolAdmin') {
      query.school = req.user.schoolId;
    } else if (schoolId && authUtils.canAccessSchool(req.user, schoolId)) {
      query.school = schoolId;
    }
    
    // Apply additional filters
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const [teachers, total] = await Promise.all([
      User.find(query)
        .select('-password -refreshTokens')
        .populate('school', 'name')
        .sort({ name: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    // Get statistics for each teacher
    const teachersWithStats = await Promise.all(
      teachers.map(async (teacher) => {
        const [classLoginCount, liveClassCount, activeClasses] = await Promise.all([
          ClassLogin.countDocuments({ teacher: teacher._id, isActive: true }),
          LiveClass.countDocuments({ teacher: teacher._id }),
          LiveClass.countDocuments({ 
            teacher: teacher._id, 
            status: { $in: ['scheduled', 'live'] } 
          })
        ]);
        
        const teacherObj = teacher.toObject();
        teacherObj.stats = {
          classLogins: classLoginCount,
          totalClasses: liveClassCount,
          activeClasses
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
 * @route GET /api/teachers/:id
 * @desc Get teacher by ID
 * @access Private (Admin, SchoolAdmin, Teacher themselves)
 */
router.get('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const teacher = await User.findById(id)
      .select('-password -refreshTokens')
      .populate('school', 'name address');
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }
    
    // Check permissions
    if (!canAccessTeacher(req.user, teacher)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this teacher'
      });
    }
    
    // Get detailed statistics
    const [classLogins, recentLiveClasses, upcomingClasses] = await Promise.all([
      ClassLogin.find({ teacher: teacher._id, isActive: true })
        .select('className section deviceLimit')
        .sort({ className: 1 })
        .limit(10),
      LiveClass.find({ teacher: teacher._id })
        .select('title status scheduledStart endedAt currentParticipants')
        .sort({ scheduledStart: -1 })
        .limit(5),
      LiveClass.find({ 
        teacher: teacher._id,
        status: { $in: ['scheduled', 'live'] }
      })
        .select('title meetingId scheduledStart currentParticipants')
        .sort({ scheduledStart: 1 })
        .limit(5)
    ]);
    
    const teacherWithDetails = teacher.toObject();
    teacherWithDetails.details = {
      classLogins,
      recentLiveClasses,
      upcomingClasses
    };
    
    res.json({
      success: true,
      data: teacherWithDetails
    });
  })
);

/**
 * @route POST /api/teachers
 * @desc Create a new teacher account
 * @access Private (Admin, SchoolAdmin)
 */
router.post('/',
  validationMiddleware.expressValidator.body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
  validationMiddleware.expressValidator.body('email').trim().isEmail().normalizeEmail(),
  validationMiddleware.expressValidator.body('phone').optional().trim(),
  validationMiddleware.expressValidator.body('schoolId').optional(),
  validationMiddleware.expressValidator.body('subjects').optional().isArray(),
  validationMiddleware.expressValidator.body('sendWelcomeEmail').optional().isBoolean(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { 
      name, 
      email, 
      phone, 
      schoolId, 
      subjects, 
      sendWelcomeEmail = true 
    } = req.body;
    
    // Check permissions
    if (req.user.role !== 'superAdmin' && req.user.role !== 'admin' && req.user.role !== 'schoolAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create teacher accounts'
      });
    }
    
    // Check if email already exists
    const existingTeacher = await User.findOne({ email, role: 'teacher' });
    
    if (existingTeacher) {
      return res.status(400).json({
        success: false,
        message: 'Teacher with this email already exists'
      });
    }
    
    // Validate school if provided
    let school = null;
    if (schoolId) {
      school = await School.findById(schoolId);
      
      if (!school) {
        return res.status(400).json({
          success: false,
          message: 'School not found'
        });
      }
      
      // Check if user can assign teachers to this school
      if (!authUtils.canAccessSchool(req.user, schoolId)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to assign teachers to this school'
        });
      }
    }
    
    // Generate random password
    const password = authUtils.generateRandomPassword(12);
    const hashedPassword = await authUtils.hashPassword(password);
    
    // Create teacher account
    const teacher = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'teacher',
      school: schoolId,
      subjects: subjects || [],
      isActive: true,
      isEmailVerified: false,
      createdBy: req.user.userId
    });
    
    await teacher.save();
    
    // Send welcome email with credentials
    if (sendWelcomeEmail) {
      try {
        await emailService.sendTeacherAccountCreated({
          teacherEmail: email,
          teacherName: name,
          password,
          schoolName: school?.name || 'Not assigned',
          subjects: subjects?.join(', ') || 'Not specified',
          adminEmail: req.user.email || 'admin@openskillnepal.com'
        });
      } catch (emailError) {
        logger.error('Failed to send welcome email:', emailError);
        // Continue even if email fails
      }
    }
    
    // Log teacher creation
    await auditLogger.logUserManagementEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.USER_CREATED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetUserId: teacher._id,
      targetUserType: 'teacher',
      targetUserName: teacher.name,
      changes: {
        name,
        email,
        school: school?.name,
        subjects
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    // Remove password from response
    teacher.password = undefined;
    
    res.status(201).json({
      success: true,
      message: 'Teacher account created successfully',
      data: {
        teacher,
        credentials: sendWelcomeEmail ? null : {
          email,
          password // Only returned if welcome email is not sent
        }
      }
    });
  })
);

/**
 * @route PUT /api/teachers/:id
 * @desc Update teacher account
 * @access Private (Admin, SchoolAdmin, Teacher themselves)
 */
router.put('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.expressValidator.body('name').optional().trim().isLength({ min: 2, max: 100 }),
  validationMiddleware.expressValidator.body('phone').optional().trim(),
  validationMiddleware.expressValidator.body('avatar').optional().isURL(),
  validationMiddleware.expressValidator.body('subjects').optional().isArray(),
  validationMiddleware.expressValidator.body('isActive').optional().isBoolean(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    // Find teacher
    const teacher = await User.findById(id);
    
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }
    
    // Check permissions
    if (!canManageTeacher(req.user, teacher)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this teacher'
      });
    }
    
    // Teachers can only update their own profile (limited fields)
    if (req.user.role === 'teacher' && req.user.userId !== id) {
      const allowedFields = ['name', 'phone', 'avatar'];
      Object.keys(updates).forEach(key => {
        if (!allowedFields.includes(key)) {
          delete updates[key];
        }
      });
    }
    
    // School admin can only update teachers in their school
    if (req.user.role === 'schoolAdmin') {
      if (teacher.school?.toString() !== req.user.schoolId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update teachers from other schools'
        });
      }
      
      // School admin cannot change school assignment
      delete updates.school;
    }
    
    // Store old values for audit log
    const oldValues = {
      name: teacher.name,
      isActive: teacher.isActive,
      subjects: teacher.subjects
    };
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        teacher[key] = updates[key];
      }
    });
    
    await teacher.save();
    
    // Remove sensitive data
    teacher.password = undefined;
    teacher.refreshTokens = undefined;
    
    // Log teacher update
    await auditLogger.logUserManagementEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.USER_UPDATED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetUserId: teacher._id,
      targetUserType: 'teacher',
      targetUserName: teacher.name,
      changes: {
        old: oldValues,
        new: {
          name: teacher.name,
          isActive: teacher.isActive,
          subjects: teacher.subjects
        }
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'Teacher updated successfully',
      data: teacher
    });
  })
);

/**
 * @route DELETE /api/teachers/:id
 * @desc Deactivate teacher account
 * @access Private (Admin, SchoolAdmin)
 */
router.delete('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check permissions
    if (req.user.role !== 'superAdmin' && req.user.role !== 'admin' && req.user.role !== 'schoolAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to deactivate teacher accounts'
      });
    }
    
    // Find teacher
    const teacher = await User.findById(id);
    
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }
    
    // School admin can only deactivate teachers in their school
    if (req.user.role === 'schoolAdmin') {
      if (teacher.school?.toString() !== req.user.schoolId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to deactivate teachers from other schools'
        });
      }
    }
    
    // Deactivate teacher (soft delete)
    teacher.isActive = false;
    teacher.deactivatedAt = new Date();
    teacher.deactivatedBy = req.user.userId;
    await teacher.save();
    
    // Deactivate teacher's class logins
    await ClassLogin.updateMany(
      { teacher: id, isActive: true },
      {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: req.user.userId,
        deactivationReason: 'teacher_deactivated'
      }
    );
    
    // Cancel teacher's upcoming live classes
    await LiveClass.updateMany(
      { 
        teacher: id,
        status: { $in: ['scheduled', 'live'] }
      },
      {
        status: 'cancelled',
        endedAt: new Date(),
        cancellationReason: 'teacher_deactivated'
      }
    );
    
    // Log teacher deactivation
    await auditLogger.logUserManagementEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.USER_DELETED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetUserId: teacher._id,
      targetUserType: 'teacher',
      targetUserName: teacher.name,
      changes: {
        deactivatedAt: teacher.deactivatedAt,
        affectedClassLogins: await ClassLogin.countDocuments({ teacher: id }),
        affectedLiveClasses: await LiveClass.countDocuments({ 
          teacher: id,
          status: { $in: ['scheduled', 'live'] }
        })
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'Teacher account deactivated successfully'
    });
  })
);

/**
 * @route POST /api/teachers/:id/reset-password
 * @desc Reset teacher password (admin only)
 * @access Private (Admin, SchoolAdmin)
 */
router.post('/:id/reset-password',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { sendEmail = true } = req.body;
    
    // Check permissions
    if (req.user.role !== 'superAdmin' && req.user.role !== 'admin' && req.user.role !== 'schoolAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reset teacher passwords'
      });
    }
    
    // Find teacher
    const teacher = await User.findById(id);
    
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }
    
    // School admin can only reset passwords for teachers in their school
    if (req.user.role === 'schoolAdmin') {
      if (teacher.school?.toString() !== req.user.schoolId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to reset passwords for teachers from other schools'
        });
      }
    }
    
    // Generate new password
    const newPassword = authUtils.generateRandomPassword(12);
    const hashedPassword = await authUtils.hashPassword(newPassword);
    
    // Update password
    teacher.password = hashedPassword;
    
    // Invalidate all refresh tokens
    teacher.refreshTokens = [];
    
    await teacher.save();
    
    // Send password reset email
    if (sendEmail) {
      try {
        await emailService.sendEmail({
          to: teacher.email,
          template: 'TEACHER_ACCOUNT_CREATED', // Reuse template with new password
          data: {
            teacherName: teacher.name,
            email: teacher.email,
            password: newPassword,
            schoolName: 'Your school',
            subjects: teacher.subjects?.join(', ') || 'Not specified',
            adminEmail: req.user.email || 'admin@openskillnepal.com'
          }
        });
      } catch (emailError) {
        logger.error('Failed to send password reset email:', emailError);
      }
    }
    
    // Log password reset
    await auditLogger.logUserManagementEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.USER_UPDATED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetUserId: teacher._id,
      targetUserType: 'teacher',
      targetUserName: teacher.name,
      changes: {
        passwordReset: true,
        resetBy: req.user.role
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'Teacher password reset successfully',
      data: {
        email: teacher.email,
        password: sendEmail ? null : newPassword // Only return password if email not sent
      }
    });
  })
);

/**
 * @route GET /api/teachers/:id/class-logins
 * @desc Get teacher's class logins
 * @access Private (Admin, SchoolAdmin, Teacher themselves)
 */
router.get('/:id/class-logins',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.validatePagination(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20, activeOnly = 'true' } = req.query;
    const skip = (page - 1) * limit;
    
    // Find teacher
    const teacher = await User.findById(id);
    
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }
    
    // Check permissions
    if (!canAccessTeacher(req.user, teacher)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view class logins for this teacher'
      });
    }
    
    // Build query
    const query = { teacher: id };
    
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    
    // Get class logins with pagination
    const [classLogins, total] = await Promise.all([
      ClassLogin.find(query)
        .populate('school', 'name')
        .sort({ className: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ClassLogin.countDocuments(query)
    ]);
    
    // Get active device counts for each class login
    const classLoginsWithDeviceCounts = await Promise.all(
      classLogins.map(async (classLogin) => {
        const deviceCount = await require('../models/Device').countDocuments({
          classLogin: classLogin._id,
          isActive: true,
          expiresAt: { $gt: new Date() }
        });
        
        const classLoginObj = classLogin.toObject();
        classLoginObj.activeDevices = deviceCount;
        return classLoginObj;
      })
    );
    
    res.json({
      success: true,
      data: classLoginsWithDeviceCounts,
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
 * @route GET /api/teachers/:id/live-classes
 * @desc Get teacher's live classes
 * @access Private (Admin, SchoolAdmin, Teacher themselves)
 */
router.get('/:id/live-classes',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.validatePagination(),
  validationMiddleware.expressValidator.query('status').optional().isIn(['scheduled', 'live', 'ended', 'cancelled']),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    
    // Find teacher
    const teacher = await User.findById(id);
    
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }
    
    // Check permissions
    if (!canAccessTeacher(req.user, teacher)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view live classes for this teacher'
      });
    }
    
    // Build query
    const query = { teacher: id };
    
    if (status) {
      query.status = status;
    }
    
    // Get live classes with pagination
    const [liveClasses, total] = await Promise.all([
      LiveClass.find(query)
        .populate('classLogin', 'className section')
        .populate('school', 'name')
        .sort({ scheduledStart: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      LiveClass.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: liveClasses,
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
 * @route GET /api/teachers/:id/stats
 * @desc Get teacher statistics
 * @access Private (Admin, SchoolAdmin, Teacher themselves)
 */
router.get('/:id/stats',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Find teacher
    const teacher = await User.findById(id);
    
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }
    
    // Check permissions
    if (!canAccessTeacher(req.user, teacher)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view statistics for this teacher'
      });
    }
    
    // Get comprehensive statistics
    const [
      classLoginCount,
      activeClassLoginCount,
      totalLiveClasses,
      completedClasses,
      totalParticipants,
      averageParticipants,
      monthlyStats,
      deviceStats
    ] = await Promise.all([
      // Class login stats
      ClassLogin.countDocuments({ teacher: id }),
      ClassLogin.countDocuments({ teacher: id, isActive: true }),
      
      // Live class stats
      LiveClass.countDocuments({ teacher: id }),
      LiveClass.countDocuments({ teacher: id, status: 'ended' }),
      
      // Participant stats
      LiveClass.aggregate([
        { $match: { teacher: teacher._id, status: 'ended' } },
        { $group: { _id: null, total: { $sum: '$currentParticipants' } } }
      ]),
      LiveClass.aggregate([
        { $match: { teacher: teacher._id, status: 'ended', currentParticipants: { $gt: 0 } } },
        { $group: { _id: null, average: { $avg: '$currentParticipants' } } }
      ]),
      
      // Monthly statistics (last 6 months)
      LiveClass.aggregate([
        {
          $match: {
            teacher: teacher._id,
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
      ]),
      
      // Device statistics
      ClassLogin.aggregate([
        { $match: { teacher: teacher._id, isActive: true } },
        {
          $lookup: {
            from: 'devices',
            localField: '_id',
            foreignField: 'classLogin',
            as: 'devices'
          }
        },
        {
          $project: {
            className: 1,
            deviceLimit: 1,
            activeDevices: {
              $size: {
                $filter: {
                  input: '$devices',
                  as: 'device',
                  cond: {
                    $and: [
                      { $eq: ['$$device.isActive', true] },
                      { $gt: ['$$device.expiresAt', new Date()] }
                    ]
                  }
                }
              }
            }
          }
        }
      ])
    ]);
    
    const stats = {
      overview: {
        classLogins: {
          total: classLoginCount,
          active: activeClassLoginCount
        },
        liveClasses: {
          total: totalLiveClasses,
          completed: completedClasses
        },
        participants: {
          total: totalParticipants[0]?.total || 0,
          average: Math.round(averageParticipants[0]?.average || 0)
        }
      },
      monthly: monthlyStats.map(stat => ({
        month: `${stat._id.year}-${stat._id.month.toString().padStart(2, '0')}`,
        classes: stat.count,
        participants: stat.totalParticipants || 0,
        duration: stat.totalDuration || 0
      })),
      deviceUsage: deviceStats.map(stat => ({
        className: stat.className,
        deviceLimit: stat.deviceLimit,
        activeDevices: stat.activeDevices,
        usage: stat.deviceLimit > 0 
          ? `${Math.round((stat.activeDevices / stat.deviceLimit) * 100)}%`
          : '0%'
      }))
    };
    
    res.json({
      success: true,
      data: stats
    });
  })
);

/**
 * Helper function to check if user can access teacher
 */
function canAccessTeacher(user, teacher) {
  // Super admin can access everything
  if (user.role === 'superAdmin') {
    return true;
  }
  
  // Admin can access all teachers
  if (user.role === 'admin') {
    return true;
  }
  
  // School admin can access teachers in their school
  if (user.role === 'schoolAdmin') {
    return user.schoolId && teacher.school && user.schoolId.toString() === teacher.school.toString();
  }
  
  // Teacher can access their own profile
  if (user.role === 'teacher') {
    return user.userId && user.userId.toString() === teacher._id.toString();
  }
  
  return false;
}

/**
 * Helper function to check if user can manage teacher
 */
function canManageTeacher(user, teacher) {
  // Super admin can manage everything
  if (user.role === 'superAdmin') {
    return true;
  }
  
  // Admin can manage all teachers
  if (user.role === 'admin') {
    return true;
  }
  
  // School admin can manage teachers in their school
  if (user.role === 'schoolAdmin') {
    return user.schoolId && teacher.school && user.schoolId.toString() === teacher.school.toString();
  }
  
  // Teacher can manage their own profile (limited fields)
  if (user.role === 'teacher') {
    return user.userId && user.userId.toString() === teacher._id.toString();
  }
  
  return false;
}

/**
 * Health check for teacher routes
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const count = await User.countDocuments({ role: 'teacher' });
    
    res.json({
      status: 'healthy',
      service: 'teacher-routes',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        teachersCount: count
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'teacher-routes',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
