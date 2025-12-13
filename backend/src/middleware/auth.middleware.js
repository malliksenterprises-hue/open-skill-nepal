const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const ClassLogin = require('../models/ClassLogin');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 * Handles both regular users and Class Login authentication
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
        code: 'NO_TOKEN'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check token type and load appropriate entity
    if (decoded.role === 'classLogin') {
      // Handle Class Login authentication
      const classLogin = await ClassLogin.findById(decoded.id);
      
      if (!classLogin) {
        return res.status(401).json({
          success: false,
          message: 'Class Login not found',
          code: 'CLASS_LOGIN_NOT_FOUND'
        });
      }
      
      if (!classLogin.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Class Login is disabled',
          code: 'CLASS_LOGIN_DISABLED'
        });
      }
      
      if (classLogin.isExpired()) {
        return res.status(403).json({
          success: false,
          message: 'Class Login has expired',
          code: 'CLASS_LOGIN_EXPIRED'
        });
      }
      
      // Attach Class Login info to request
      req.user = {
        id: classLogin._id,
        loginId: classLogin.loginId,
        schoolId: classLogin.schoolId,
        classId: classLogin.classId,
        role: 'classLogin',
        deviceId: decoded.deviceId,
        sessionId: decoded.sessionId,
        isClassLogin: true,
        permissions: ['access_live_classes'] // Class Login specific permission
      };
      
    } else {
      // Handle regular user authentication
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'User account is disabled',
          code: 'USER_DISABLED'
        });
      }
      
      // For teachers, check if they are verified
      if (user.role === 'teacher') {
        const teacher = await Teacher.findOne({ userId: user._id });
        if (!teacher || !teacher.isVerified) {
          return res.status(403).json({
            success: false,
            message: 'Teacher account is not verified',
            code: 'TEACHER_NOT_VERIFIED'
          });
        }
      }
      
      // For school admins, check if they are verified
      if (user.role === 'schoolAdmin') {
        const school = await School.findOne({ adminId: user._id });
        if (!school || !school.isVerified) {
          return res.status(403).json({
            success: false,
            message: 'School Admin account is not verified',
            code: 'SCHOOL_ADMIN_NOT_VERIFIED'
          });
        }
      }
      
      // Attach user info to request
      req.user = {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: user.schoolId, // For schoolAdmin and teacher
        isVerified: user.isVerified,
        isClassLogin: false,
        permissions: getUserPermissions(user.role)
      };
    }
    
    // Add IP and user agent for logging
    req.user.ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    req.user.userAgent = req.headers['user-agent'] || '';
    
    logger.debug(`Authentication successful`, {
      userId: req.user.id,
      role: req.user.role,
      endpoint: req.originalUrl
    });
    
    next();
    
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'AUTH_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user permissions based on role
 */
function getUserPermissions(role) {
  const permissions = {
    superAdmin: [
      'create_admins',
      'verify_teachers',
      'verify_schools',
      'set_device_limits',
      'manage_all_schools',
      'rename_all_content',
      'upload_videos',
      'schedule_live_classes',
      'access_admin_dashboard',
      'manage_platform_settings'
    ],
    admin: [
      'create_live_classes',
      'assign_teachers',
      'manage_school_access',
      'upload_videos',
      'rename_all_content',
      'verify_teachers',
      'verify_schools',
      'access_admin_dashboard',
      'schedule_live_classes'
    ],
    teacher: [
      'teach_live_classes',
      'screen_share',
      'control_classroom_mic',
      'upload_videos',
      'schedule_videos',
      'add_text_notes',
      'rename_own_content',
      'access_teacher_dashboard'
    ],
    schoolAdmin: [
      'manage_class_logins',
      'verify_students',
      'access_school_dashboard',
      'view_school_analytics',
      'reset_devices'
    ],
    classLogin: [
      'access_live_classes'
    ],
    student: [
      'access_recorded_classes',
      'access_text_notes',
      'access_student_dashboard'
    ]
  };
  
  return permissions[role] || [];
}

/**
 * Authorization Middleware
 * Checks if user has required role(s) to access the resource
 * 
 * Role Hierarchy (highest to lowest):
 * 1. superAdmin (Platform Owner - Open Skill Nepal)
 * 2. admin (Open Skill Nepal Manager)
 * 3. teacher (Verified Teacher)
 * 4. schoolAdmin (Verified School Admin)
 * 5. classLogin (Classroom Device Login)
 * 6. student (Google OAuth Student - RECORDINGS ONLY)
 * 
 * Special Rules:
 * - Students CANNOT access live classes or Class Login features
 * - Class Login can ONLY access device-limited live classes
 * - Teachers can only access their assigned classes
 * - School Admin can only access their own school
 */
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    try {
      const userRole = req.user.role;
      
      // Check if user role is in allowed roles
      if (!allowedRoles.includes(userRole)) {
        // Special case: Super Admin can access everything
        if (userRole === 'superAdmin') {
          return next();
        }
        
        // Special case: Admin can access everything except superAdmin routes
        if (userRole === 'admin' && !allowedRoles.includes('superAdmin')) {
          return next();
        }
        
        logger.warn(`Unauthorized access attempt`, {
          userId: req.user.id,
          userRole,
          allowedRoles,
          endpoint: req.originalUrl,
          ip: req.user.ipAddress
        });
        
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      // Special validations based on role
      
      // Block students from live class routes
      if (userRole === 'student') {
        const liveClassRoutes = [
          '/api/live-class',
          '/api/class-login',
          '/api/devices/validate',
          '/api/teacher/'
        ];
        
        const isLiveClassRoute = liveClassRoutes.some(route => 
          req.originalUrl.startsWith(route)
        );
        
        if (isLiveClassRoute) {
          return res.status(403).json({
            success: false,
            message: 'Students cannot access live classes',
            code: 'STUDENT_LIVE_CLASS_BLOCKED'
          });
        }
      }
      
      // Class Login specific validations
      if (userRole === 'classLogin') {
        // Class Login can only access specific endpoints
        const allowedClassLoginRoutes = [
          '/api/devices/validate',
          '/api/live-class/join',
          '/api/live-class/stream',
          '/api/class-login/auth'
        ];
        
        const isAllowedRoute = allowedClassLoginRoutes.some(route => 
          req.originalUrl.startsWith(route)
        );
        
        if (!isAllowedRoute) {
          return res.status(403).json({
            success: false,
            message: 'Class Login can only access live class endpoints',
            code: 'CLASS_LOGIN_RESTRICTED'
          });
        }
      }
      
      // School Admin can only access their own school resources
      if (userRole === 'schoolAdmin') {
        const requestedSchoolId = req.params.schoolId || req.body.schoolId;
        
        if (requestedSchoolId && requestedSchoolId !== req.user.schoolId) {
          return res.status(403).json({
            success: false,
            message: 'Cannot access resources from other schools',
            code: 'SCHOOL_ACCESS_DENIED'
          });
        }
      }
      
      // Teacher can only access their assigned classes
      if (userRole === 'teacher') {
        // This would be validated in specific controller methods
        // based on teacher's assigned classes
      }
      
      next();
      
    } catch (error) {
      logger.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'AUTHORIZATION_ERROR'
      });
    }
  };
};

/**
 * Check if user has specific permission
 */
const hasPermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.permissions) {
        return res.status(403).json({
          success: false,
          message: 'User permissions not found',
          code: 'NO_PERMISSIONS'
        });
      }
      
      if (!req.user.permissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          message: `Required permission: ${permission}`,
          code: 'MISSING_PERMISSION'
        });
      }
      
      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
};

/**
 * Verify teacher is assigned to the class they're trying to access
 */
const verifyTeacherClassAccess = async (req, res, next) => {
  try {
    if (req.user.role !== 'teacher') {
      return next();
    }
    
    const classId = req.params.classId || req.body.classId;
    
    if (!classId) {
      return next();
    }
    
    // Check if teacher is assigned to this class
    const teacher = await Teacher.findOne({ userId: req.user.id });
    
    if (!teacher || !teacher.assignedClasses.includes(classId)) {
      return res.status(403).json({
        success: false,
        message: 'Teacher not assigned to this class',
        code: 'TEACHER_NOT_ASSIGNED'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Teacher class access verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  authenticate,
  authorize,
  hasPermission,
  verifyTeacherClassAccess
};
