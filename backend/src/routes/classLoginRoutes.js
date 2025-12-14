/**
 * Class Login Routes
 * 
 * Handles Class Login creation, management, and device limit configuration
 * for Open Skill Nepal platform.
 * 
 * @module routes/classLoginRoutes
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
const ClassLogin = require('../models/ClassLogin');
const School = require('../models/School');
const User = require('../models/User');
const Device = require('../models/Device');

/**
 * @route GET /api/class-logins
 * @desc Get all class logins (with filtering)
 * @access Private (Admin, SchoolAdmin, Teacher)
 */
router.get('/',
  validationMiddleware.validatePagination(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search, schoolId, teacherId, activeOnly } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query based on user role
    const query = {};
    
    // Filter by school if user is school admin or teacher
    if (req.user.role === 'schoolAdmin' || req.user.role === 'teacher') {
      query.school = req.user.schoolId;
    }
    
    // Filter by teacher if user is teacher
    if (req.user.role === 'teacher') {
      query.teacher = req.user.userId;
    }
    
    // Apply filters
    if (schoolId && authUtils.canAccessSchool(req.user, schoolId)) {
      query.school = schoolId;
    }
    
    if (teacherId) {
      // Only allow filtering by teacher if user has permission
      if (req.user.role === 'superAdmin' || req.user.role === 'admin') {
        query.teacher = teacherId;
      }
    }
    
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    
    if (search) {
      query.$or = [
        { className: { $regex: search, $options: 'i' } },
        { section: { $regex: search, $options: 'i' } },
        { classLoginId: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const [classLogins, total] = await Promise.all([
      ClassLogin.find(query)
        .populate('school', 'name address')
        .populate('teacher', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ClassLogin.countDocuments(query)
    ]);
    
    // Get active device counts for each class login
    const classLoginsWithDeviceCounts = await Promise.all(
      classLogins.map(async (classLogin) => {
        const deviceCount = await Device.countDocuments({
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
 * @route GET /api/class-logins/:id
 * @desc Get class login by ID
 * @access Private (Admin, SchoolAdmin, Teacher of the class)
 */
router.get('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const classLogin = await ClassLogin.findById(id)
      .populate('school', 'name address')
      .populate('teacher', 'name email');
    
    if (!classLogin) {
      return res.status(404).json({
        success: false,
        message: 'Class login not found'
      });
    }
    
    // Check permission
    if (!canAccessClassLogin(req.user, classLogin)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this class login'
      });
    }
    
    // Get active device count
    const activeDevices = await Device.countDocuments({
      classLogin: id,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
    
    const classLoginWithDevices = classLogin.toObject();
    classLoginWithDevices.activeDevices = activeDevices;
    
    res.json({
      success: true,
      data: classLoginWithDevices
    });
  })
);

/**
 * @route POST /api/class-logins
 * @desc Create a new class login
 * @access Private (Admin, SchoolAdmin, Teacher)
 */
router.post('/',
  validationMiddleware.validateCreateClassLogin(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { schoolId, className, section, gradeLevel, deviceLimit, notes } = req.body;
    
    // Check if user can create class login for this school
    if (!authUtils.canAccessSchool(req.user, schoolId)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create class login for this school'
      });
    }
    
    // Verify school exists and is active
    const school = await School.findById(schoolId);
    if (!school || !school.isActive) {
      return res.status(400).json({
        success: false,
        message: 'School not found or inactive'
      });
    }
    
    // For teachers, they can only create class logins for themselves
    let teacherId = req.body.teacherId;
    if (req.user.role === 'teacher') {
      teacherId = req.user.userId;
    } else if (!teacherId) {
      // Default to the requesting user if not specified
      teacherId = req.user.userId;
    }
    
    // Verify teacher exists and is assigned to school
    const teacher = await User.findOne({
      _id: teacherId,
      role: 'teacher',
      school: schoolId,
      isActive: true
    });
    
    if (!teacher) {
      return res.status(400).json({
        success: false,
        message: 'Teacher not found or not assigned to this school'
      });
    }
    
    // Generate unique class login ID
    const classLoginId = generateClassLoginId(className, section);
    
    // Generate random password
    const password = authUtils.generateRandomPassword(10);
    
    // Hash password
    const hashedPassword = await authUtils.hashPassword(password);
    
    // Create class login
    const classLogin = new ClassLogin({
      school: schoolId,
      teacher: teacherId,
      className,
      section,
      gradeLevel,
      classLoginId,
      password: hashedPassword,
      deviceLimit: deviceLimit || 1,
      notes,
      createdBy: req.user.userId,
      isActive: true
    });
    
    await classLogin.save();
    
    // Populate references
    await classLogin.populate('school', 'name address');
    await classLogin.populate('teacher', 'name email');
    
    // Send email to teacher with credentials
    try {
      await emailService.sendClassLoginCredentials({
        teacherEmail: teacher.email,
        teacherName: teacher.name,
        className: `${className}${section ? ` - ${section}` : ''}`,
        classLoginId: classLogin.classLoginId,
        password,
        section,
        deviceLimit: classLogin.deviceLimit,
        schoolName: school.name
      });
    } catch (emailError) {
      logger.error('Failed to send class login credentials email:', emailError);
      // Continue even if email fails
    }
    
    // Log class login creation
    await auditLogger.logClassLoginEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.CLASS_LOGIN_CREATED,
      actorId: req.user.userId,
      actorType: req.user.role,
      classLoginId: classLogin._id,
      className: classLogin.className,
      schoolId,
      changes: {
        className,
        section,
        deviceLimit: classLogin.deviceLimit
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    // Return response with plain text password (only this time)
    res.status(201).json({
      success: true,
      message: 'Class login created successfully',
      data: {
        classLogin,
        credentials: {
          classLoginId: classLogin.classLoginId,
          password // Only returned on creation
        }
      }
    });
  })
);

/**
 * @route PUT /api/class-logins/:id
 * @desc Update class login
 * @access Private (Admin, SchoolAdmin, Teacher of the class)
 */
router.put('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.expressValidator.body('className').optional().trim().isLength({ min: 2, max: 100 }),
  validationMiddleware.expressValidator.body('section').optional().trim().isLength({ max: 50 }),
  validationMiddleware.expressValidator.body('gradeLevel').optional().isInt({ min: 1, max: 12 }),
  validationMiddleware.expressValidator.body('deviceLimit').optional().isInt({ min: 1, max: 100 }),
  validationMiddleware.expressValidator.body('isActive').optional().isBoolean(),
  validationMiddleware.expressValidator.body('notes').optional().trim().isLength({ max: 500 }),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    // Find class login
    const classLogin = await ClassLogin.findById(id);
    
    if (!classLogin) {
      return res.status(404).json({
        success: false,
        message: 'Class login not found'
      });
    }
    
    // Check permission
    if (!canAccessClassLogin(req.user, classLogin)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this class login'
      });
    }
    
    // Store old values for audit log
    const oldValues = {
      className: classLogin.className,
      section: classLogin.section,
      deviceLimit: classLogin.deviceLimit,
      isActive: classLogin.isActive
    };
    
    // Apply updates
    const allowedUpdates = ['className', 'section', 'gradeLevel', 'deviceLimit', 'isActive', 'notes'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        classLogin[field] = updates[field];
      }
    });
    
    await classLogin.save();
    
    // Populate references
    await classLogin.populate('school', 'name address');
    await classLogin.populate('teacher', 'name email');
    
    // Log class login update
    await auditLogger.logClassLoginEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.CLASS_LOGIN_UPDATED,
      actorId: req.user.userId,
      actorType: req.user.role,
      classLoginId: classLogin._id,
      className: classLogin.className,
      schoolId: classLogin.school,
      changes: {
        old: oldValues,
        new: {
          className: classLogin.className,
          section: classLogin.section,
          deviceLimit: classLogin.deviceLimit,
          isActive: classLogin.isActive
        }
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'Class login updated successfully',
      data: classLogin
    });
  })
);

/**
 * @route DELETE /api/class-logins/:id
 * @desc Delete class login
 * @access Private (Admin, SchoolAdmin, Teacher of the class)
 */
router.delete('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Find class login
    const classLogin = await ClassLogin.findById(id);
    
    if (!classLogin) {
      return res.status(404).json({
        success: false,
        message: 'Class login not found'
      });
    }
    
    // Check permission
    if (!canAccessClassLogin(req.user, classLogin)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this class login'
      });
    }
    
    // Instead of deleting, deactivate and archive
    classLogin.isActive = false;
    classLogin.deactivatedAt = new Date();
    classLogin.deactivatedBy = req.user.userId;
    await classLogin.save();
    
    // Deactivate all active devices for this class login
    await Device.updateMany(
      {
        classLogin: id,
        isActive: true
      },
      {
        isActive: false,
        endedAt: new Date(),
        endReason: 'class_login_deactivated'
      }
    );
    
    // Log class login deactivation
    await auditLogger.logClassLoginEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.CLASS_LOGIN_DELETED,
      actorId: req.user.userId,
      actorType: req.user.role,
      classLoginId: classLogin._id,
      className: classLogin.className,
      schoolId: classLogin.school,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'Class login deactivated successfully'
    });
  })
);

/**
 * @route POST /api/class-logins/:id/reset-password
 * @desc Reset class login password
 * @access Private (Admin, SchoolAdmin, Teacher of the class)
 */
router.post('/:id/reset-password',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Find class login
    const classLogin = await ClassLogin.findById(id)
      .populate('school', 'name')
      .populate('teacher', 'name email');
    
    if (!classLogin) {
      return res.status(404).json({
        success: false,
        message: 'Class login not found'
      });
    }
    
    // Check permission
    if (!canAccessClassLogin(req.user, classLogin)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reset password for this class login'
      });
    }
    
    // Generate new password
    const newPassword = authUtils.generateRandomPassword(10);
    const hashedPassword = await authUtils.hashPassword(newPassword);
    
    // Update password
    classLogin.password = hashedPassword;
    await classLogin.save();
    
    // Send email to teacher with new credentials
    try {
      await emailService.sendClassLoginCredentials({
        teacherEmail: classLogin.teacher.email,
        teacherName: classLogin.teacher.name,
        className: `${classLogin.className}${classLogin.section ? ` - ${classLogin.section}` : ''}`,
        classLoginId: classLogin.classLoginId,
        password: newPassword,
        section: classLogin.section,
        deviceLimit: classLogin.deviceLimit,
        schoolName: classLogin.school.name
      });
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError);
    }
    
    // Log password reset
    await auditLogger.logClassLoginEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.CLASS_LOGIN_CREDENTIALS_VIEWED,
      actorId: req.user.userId,
      actorType: req.user.role,
      classLoginId: classLogin._id,
      className: classLogin.className,
      schoolId: classLogin.school,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { action: 'password_reset' }
    });
    
    res.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        classLoginId: classLogin.classLoginId,
        password: newPassword // Only returned on reset
      }
    });
  })
);

/**
 * @route GET /api/class-logins/:id/devices
 * @desc Get active devices for a class login
 * @access Private (Admin, SchoolAdmin, Teacher of the class)
 */
router.get('/:id/devices',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.validatePagination(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 20, activeOnly = 'true' } = req.query;
    const skip = (page - 1) * limit;
    
    // Find class login
    const classLogin = await ClassLogin.findById(id);
    
    if (!classLogin) {
      return res.status(404).json({
        success: false,
        message: 'Class login not found'
      });
    }
    
    // Check permission
    if (!canAccessClassLogin(req.user, classLogin)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view devices for this class login'
      });
    }
    
    // Build device query
    const deviceQuery = { classLogin: id };
    
    if (activeOnly === 'true') {
      deviceQuery.isActive = true;
      deviceQuery.expiresAt = { $gt: new Date() };
    }
    
    // Get devices with pagination
    const [devices, total] = await Promise.all([
      Device.find(deviceQuery)
        .sort({ lastActive: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Device.countDocuments(deviceQuery)
    ]);
    
    res.json({
      success: true,
      data: devices,
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
 * @route POST /api/class-logins/:id/disconnect-device
 * @desc Disconnect a specific device from class login
 * @access Private (Admin, SchoolAdmin, Teacher of the class)
 */
router.post('/:id/disconnect-device',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.expressValidator.body('deviceId').notEmpty(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { deviceId } = req.body;
    
    // Find class login
    const classLogin = await ClassLogin.findById(id);
    
    if (!classLogin) {
      return res.status(404).json({
        success: false,
        message: 'Class login not found'
      });
    }
    
    // Check permission
    if (!canAccessClassLogin(req.user, classLogin)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to disconnect devices for this class login'
      });
    }
    
    // Find and disconnect device
    const device = await Device.findOne({
      _id: deviceId,
      classLogin: id,
      isActive: true
    });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Active device not found'
      });
    }
    
    // Disconnect device
    device.isActive = false;
    device.endedAt = new Date();
    device.endReason = 'manual_disconnect_by_admin';
    await device.save();
    
    // Log device disconnection
    await auditLogger.logDeviceEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.DEVICE_DEREGISTERED,
      classLoginId: id,
      className: classLogin.className,
      deviceId,
      schoolId: classLogin.school,
      details: {
        disconnectedBy: req.user.userId,
        disconnectedByRole: req.user.role
      },
      ipAddress: req.ip
    });
    
    res.json({
      success: true,
      message: 'Device disconnected successfully'
    });
  })
);

/**
 * @route POST /api/class-logins/:id/disconnect-all
 * @desc Disconnect all devices from class login
 * @access Private (Admin, SchoolAdmin, Teacher of the class)
 */
router.post('/:id/disconnect-all',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Find class login
    const classLogin = await ClassLogin.findById(id);
    
    if (!classLogin) {
      return res.status(404).json({
        success: false,
        message: 'Class login not found'
      });
    }
    
    // Check permission
    if (!canAccessClassLogin(req.user, classLogin)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to disconnect devices for this class login'
      });
    }
    
    // Disconnect all active devices
    const result = await Device.updateMany(
      {
        classLogin: id,
        isActive: true
      },
      {
        isActive: false,
        endedAt: new Date(),
        endReason: 'mass_disconnect_by_admin'
      }
    );
    
    // Log mass disconnection
    await auditLogger.logDeviceEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.DEVICE_DEREGISTERED,
      classLoginId: id,
      className: classLogin.className,
      deviceId: 'all',
      schoolId: classLogin.school,
      details: {
        disconnectedCount: result.modifiedCount,
        disconnectedBy: req.user.userId,
        disconnectedByRole: req.user.role
      },
      ipAddress: req.ip
    });
    
    res.json({
      success: true,
      message: `Disconnected ${result.modifiedCount} device(s) successfully`,
      disconnectedCount: result.modifiedCount
    });
  })
);

/**
 * Helper function to generate unique class login ID
 */
function generateClassLoginId(className, section) {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const classNameCode = className.substring(0, 3).toUpperCase();
  const sectionCode = section ? section.substring(0, 2).toUpperCase() : '00';
  
  return `${classNameCode}${sectionCode}${timestamp}${random}`;
}

/**
 * Helper function to check if user can access class login
 */
function canAccessClassLogin(user, classLogin) {
  // Super admin can access everything
  if (user.role === 'superAdmin') {
    return true;
  }
  
  // Admin can access all class logins
  if (user.role === 'admin') {
    return true;
  }
  
  // School admin can access class logins in their school
  if (user.role === 'schoolAdmin') {
    return user.schoolId && user.schoolId.toString() === classLogin.school.toString();
  }
  
  // Teacher can access their own class logins
  if (user.role === 'teacher') {
    return user.userId && user.userId.toString() === classLogin.teacher.toString();
  }
  
  return false;
}

/**
 * Health check for class login routes
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const count = await ClassLogin.countDocuments();
    
    res.json({
      status: 'healthy',
      service: 'class-login-routes',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        classLoginsCount: count
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'class-login-routes',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
