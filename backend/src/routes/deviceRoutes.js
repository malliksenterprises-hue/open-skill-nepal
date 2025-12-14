/**
 * Device Routes
 * 
 * Handles device registration, management, and device limit enforcement
 * for Open Skill Nepal platform.
 * 
 * @module routes/deviceRoutes
 */

const express = require('express');
const router = express.Router();
const validationMiddleware = require('../middleware/validationMiddleware');
const rateLimiter = require('../middleware/rateLimiter');
const auditLogger = require('../utils/auditLogger');
const deviceLimiter = require('../utils/deviceLimiter');
const { asyncHandler } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Import models
const Device = require('../models/Device');
const ClassLogin = require('../models/ClassLogin');

/**
 * @route POST /api/devices/register
 * @desc Register a new device for class login
 * @access Private (ClassLogin)
 */
router.post('/register',
  rateLimiter.deviceRegistrationLimiter,
  validationMiddleware.expressValidator.body('classLoginId').notEmpty(),
  validationMiddleware.expressValidator.body('deviceInfo').isObject(),
  validationMiddleware.expressValidator.body('deviceInfo.userAgent').optional().trim(),
  validationMiddleware.expressValidator.body('deviceInfo.deviceId').optional().trim(),
  validationMiddleware.expressValidator.body('deviceInfo.fingerprint').optional().trim(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { classLoginId, deviceInfo } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent') || deviceInfo.userAgent;
    
    // For class login users, they can only register devices for themselves
    let targetClassLoginId = classLoginId;
    if (req.user.role === 'classLogin') {
      targetClassLoginId = req.user.classLoginId;
    }
    
    // Verify class login exists and is active
    const classLogin = await ClassLogin.findById(targetClassLoginId);
    
    if (!classLogin) {
      return res.status(404).json({
        success: false,
        message: 'Class login not found'
      });
    }
    
    if (!classLogin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Class login is deactivated'
      });
    }
    
    // Check device access using device limiter
    const sessionId = deviceLimiter.generateSessionId();
    const deviceCheck = await deviceLimiter.checkDeviceAccess(
      targetClassLoginId,
      {
        userAgent,
        ipAddress,
        deviceId: deviceInfo.deviceId,
        fingerprint: deviceInfo.fingerprint
      },
      sessionId
    );
    
    if (!deviceCheck.allowed) {
      // Log device limit exceeded
      await auditLogger.logDeviceEvent({
        eventType: auditLogger.AUDIT_EVENT_TYPES.DEVICE_LIMIT_EXCEEDED,
        classLoginId: targetClassLoginId,
        className: classLogin.className,
        deviceId: deviceInfo.deviceId || 'unknown',
        schoolId: classLogin.school,
        details: {
          currentDevices: await deviceLimiter.getActiveDeviceCount(targetClassLoginId),
          deviceLimit: classLogin.deviceLimit,
          reason: deviceCheck.reason
        },
        ipAddress
      });
      
      return res.status(403).json({
        success: false,
        message: deviceCheck.reason || 'Device limit exceeded',
        code: 'DEVICE_LIMIT_EXCEEDED',
        deviceLimit: classLogin.deviceLimit
      });
    }
    
    // Get the created/updated device
    const device = deviceCheck.existingDevice;
    
    // Log device registration
    await auditLogger.logDeviceEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.DEVICE_REGISTERED,
      classLoginId: targetClassLoginId,
      className: classLogin.className,
      deviceId: device._id,
      schoolId: classLogin.school,
      details: {
        sessionId,
        deviceInfo,
        isNew: !deviceCheck.existingDevice
      },
      ipAddress
    });
    
    res.json({
      success: true,
      message: 'Device registered successfully',
      data: {
        deviceId: device._id,
        sessionId,
        expiresAt: device.expiresAt,
        isNewDevice: !deviceCheck.existingDevice
      }
    });
  })
);

/**
 * @route POST /api/devices/heartbeat
 * @desc Update device heartbeat to keep session alive
 * @access Private (ClassLogin)
 */
router.post('/heartbeat',
  validationMiddleware.expressValidator.body('deviceId').notEmpty(),
  validationMiddleware.expressValidator.body('sessionId').notEmpty(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { deviceId, sessionId } = req.body;
    
    // Find device
    const device = await Device.findOne({
      _id: deviceId,
      sessionId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device session not found or expired'
      });
    }
    
    // Verify device belongs to user's class login
    if (req.user.role === 'classLogin') {
      if (device.classLogin.toString() !== req.user.classLoginId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this device'
        });
      }
    }
    
    // Update heartbeat
    device.lastActive = new Date();
    device.heartbeatCount = (device.heartbeatCount || 0) + 1;
    await device.save();
    
    res.json({
      success: true,
      message: 'Heartbeat updated',
      data: {
        lastActive: device.lastActive,
        expiresAt: device.expiresAt
      }
    });
  })
);

/**
 * @route POST /api/devices/disconnect
 * @desc Disconnect a device
 * @access Private (ClassLogin, Admin, Teacher)
 */
router.post('/disconnect',
  validationMiddleware.expressValidator.body('deviceId').notEmpty(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { deviceId } = req.body;
    
    // Find device
    const device = await Device.findById(deviceId)
      .populate('classLogin', 'className school teacher');
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Check permissions
    if (!canManageDevice(req.user, device)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to disconnect this device'
      });
    }
    
    // Disconnect device
    const success = await deviceLimiter.endDeviceSession(deviceId, 'manual_disconnect');
    
    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to disconnect device'
      });
    }
    
    // Log device disconnection
    await auditLogger.logDeviceEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.DEVICE_DEREGISTERED,
      classLoginId: device.classLogin._id,
      className: device.classLogin.className,
      deviceId,
      schoolId: device.classLogin.school,
      details: {
        disconnectedBy: req.user.userId,
        disconnectedByRole: req.user.role,
        sessionDuration: device.endedAt ? device.endedAt - device.createdAt : null
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
 * @route GET /api/devices
 * @desc Get devices with filtering
 * @access Private (Admin, SchoolAdmin, Teacher)
 */
router.get('/',
  validationMiddleware.validatePagination(),
  validationMiddleware.validateDeviceQuery(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, classLoginId, activeOnly, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query based on user role
    const query = {};
    
    // Apply filters
    if (classLoginId) {
      // Check if user has access to this class login
      const classLogin = await ClassLogin.findById(classLoginId);
      if (classLogin && canAccessClassLogin(req.user, classLogin)) {
        query.classLogin = classLoginId;
      } else {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view devices for this class login'
        });
      }
    } else {
      // If no classLoginId specified, filter by accessible class logins
      const accessibleClassLogins = await getAccessibleClassLogins(req.user);
      if (accessibleClassLogins.length === 0) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
      query.classLogin = { $in: accessibleClassLogins };
    }
    
    if (activeOnly === 'true') {
      query.isActive = true;
      query.expiresAt = { $gt: new Date() };
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Execute query with pagination
    const [devices, total] = await Promise.all([
      Device.find(query)
        .populate({
          path: 'classLogin',
          select: 'className school teacher',
          populate: [
            { path: 'school', select: 'name' },
            { path: 'teacher', select: 'name email' }
          ]
        })
        .sort({ lastActive: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Device.countDocuments(query)
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
 * @route GET /api/devices/stats
 * @desc Get device statistics
 * @access Private (Admin, SchoolAdmin, Teacher)
 */
router.get('/stats',
  validationMiddleware.validateDeviceQuery(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { classLoginId, startDate, endDate } = req.query;
    
    // Build query based on user role
    const query = {};
    
    // Apply filters
    if (classLoginId) {
      // Check if user has access to this class login
      const classLogin = await ClassLogin.findById(classLoginId);
      if (classLogin && canAccessClassLogin(req.user, classLogin)) {
        query.classLogin = classLoginId;
      } else {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view stats for this class login'
        });
      }
    } else {
      // If no classLoginId specified, filter by accessible class logins
      const accessibleClassLogins = await getAccessibleClassLogins(req.user);
      if (accessibleClassLogins.length === 0) {
        return res.json({
          success: true,
          data: {
            totalDevices: 0,
            activeDevices: 0,
            dailyAverage: 0,
            byClassLogin: []
          }
        });
      }
      query.classLogin = { $in: accessibleClassLogins };
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
    // Get statistics
    const [
      totalDevices,
      activeDevices,
      devicesByClassLogin,
      dailyStats
    ] = await Promise.all([
      Device.countDocuments(query),
      Device.countDocuments({
        ...query,
        isActive: true,
        expiresAt: { $gt: new Date() }
      }),
      Device.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$classLogin',
            count: { $sum: 1 },
            active: {
              $sum: {
                $cond: [
                  { 
                    $and: [
                      { $eq: ['$isActive', true] },
                      { $gt: ['$expiresAt', new Date()] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Device.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        { $limit: 30 }
      ])
    ]);
    
    // Populate class login info for devicesByClassLogin
    const devicesByClassLoginWithInfo = await Promise.all(
      devicesByClassLogin.map(async (stat) => {
        const classLogin = await ClassLogin.findById(stat._id)
          .select('className school teacher')
          .populate('school', 'name')
          .populate('teacher', 'name');
        
        return {
          classLogin: {
            _id: stat._id,
            className: classLogin?.className || 'Unknown',
            school: classLogin?.school,
            teacher: classLogin?.teacher
          },
          totalDevices: stat.count,
          activeDevices: stat.active
        };
      })
    );
    
    // Calculate daily average
    const dailyAverage = dailyStats.length > 0
      ? dailyStats.reduce((sum, day) => sum + day.count, 0) / dailyStats.length
      : 0;
    
    res.json({
      success: true,
      data: {
        totalDevices,
        activeDevices,
        dailyAverage: Math.round(dailyAverage * 10) / 10,
        byClassLogin: devicesByClassLoginWithInfo,
        dailyStats: dailyStats.map(stat => ({
          date: `${stat._id.year}-${stat._id.month.toString().padStart(2, '0')}-${stat._id.day.toString().padStart(2, '0')}`,
          count: stat.count
        }))
      }
    });
  })
);

/**
 * @route GET /api/devices/:id
 * @desc Get device by ID
 * @access Private (Admin, SchoolAdmin, Teacher, ClassLogin)
 */
router.get('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const device = await Device.findById(id)
      .populate({
        path: 'classLogin',
        select: 'className school teacher',
        populate: [
          { path: 'school', select: 'name' },
          { path: 'teacher', select: 'name email' }
        ]
      });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Check permissions
    if (!canManageDevice(req.user, device)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this device'
      });
    }
    
    res.json({
      success: true,
      data: device
    });
  })
);

/**
 * @route DELETE /api/devices/cleanup
 * @desc Cleanup expired device sessions (admin only)
 * @access Private (Admin)
 */
router.delete('/cleanup',
  asyncHandler(async (req, res) => {
    // Only super admin and admin can cleanup devices
    if (req.user.role !== 'superAdmin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cleanup devices'
      });
    }
    
    const result = await deviceLimiter.cleanupExpiredSessions();
    
    res.json({
      success: true,
      message: `Cleaned up ${result.cleaned} expired device sessions`,
      data: result
    });
  })
);

/**
 * Helper function to check if user can manage device
 */
function canManageDevice(user, device) {
  // Super admin can manage everything
  if (user.role === 'superAdmin') {
    return true;
  }
  
  // Admin can manage all devices
  if (user.role === 'admin') {
    return true;
  }
  
  // Class login users can manage their own devices
  if (user.role === 'classLogin') {
    return user.classLoginId && user.classLoginId.toString() === device.classLogin._id.toString();
  }
  
  // School admin and teacher need to check if device belongs to their school/class
  if (user.role === 'schoolAdmin' || user.role === 'teacher') {
    // We need to check the class login's school/teacher
    // This requires the device to be populated with classLogin
    if (device.classLogin) {
      if (user.role === 'schoolAdmin') {
        return user.schoolId && user.schoolId.toString() === device.classLogin.school._id.toString();
      }
      if (user.role === 'teacher') {
        return user.userId && user.userId.toString() === device.classLogin.teacher._id.toString();
      }
    }
  }
  
  return false;
}

/**
 * Helper function to get accessible class logins for user
 */
async function getAccessibleClassLogins(user) {
  if (user.role === 'superAdmin' || user.role === 'admin') {
    // Get all class logins
    const classLogins = await ClassLogin.find({ isActive: true }).select('_id');
    return classLogins.map(cl => cl._id);
  }
  
  if (user.role === 'schoolAdmin') {
    const classLogins = await ClassLogin.find({
      school: user.schoolId,
      isActive: true
    }).select('_id');
    return classLogins.map(cl => cl._id);
  }
  
  if (user.role === 'teacher') {
    const classLogins = await ClassLogin.find({
      teacher: user.userId,
      isActive: true
    }).select('_id');
    return classLogins.map(cl => cl._id);
  }
  
  return [];
}

/**
 * Helper function to check if user can access class login
 */
async function canAccessClassLogin(user, classLogin) {
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
 * Health check for device routes
 */
router.get('/health', async (req, res) => {
  try {
    // Check device limiter
    const testSessionId = deviceLimiter.generateSessionId();
    
    // Check database connection
    const count = await Device.countDocuments();
    
    res.json({
      status: 'healthy',
      service: 'device-routes',
      timestamp: new Date().toISOString(),
      checks: {
        deviceLimiter: 'working',
        database: 'connected',
        devicesCount: count
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'device-routes',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
