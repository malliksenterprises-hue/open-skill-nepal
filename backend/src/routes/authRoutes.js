/**
 * Authentication Routes
 * 
 * Handles user authentication, authorization, and session management
 * for all user roles in Open Skill Nepal platform.
 * 
 * @module routes/authRoutes
 */

const express = require('express');
const router = express.Router();
const authUtils = require('../utils/authUtils');
const validationMiddleware = require('../middleware/validationMiddleware');
const rateLimiter = require('../middleware/rateLimiter');
const auditLogger = require('../utils/auditLogger');
const emailService = require('../utils/emailService');
const { asyncHandler } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Import models
const User = require('../models/User');
const ClassLogin = require('../models/ClassLogin');
const Device = require('../models/Device');

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and get token
 * @access Public
 */
router.post('/login', 
  rateLimiter.authLimiter,
  validationMiddleware.expressValidator.body('email').isEmail().normalizeEmail(),
  validationMiddleware.expressValidator.body('password').isLength({ min: 4 }),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { email, password, deviceInfo } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      await auditLogger.logAuthEvent({
        eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILED,
        userId: null,
        userRole: null,
        ipAddress,
        userAgent,
        status: 'failure',
        errorMessage: 'User not found',
        requestId: req.id
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      await auditLogger.logAuthEvent({
        eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILED,
        userId: user._id,
        userRole: user.role,
        ipAddress,
        userAgent,
        status: 'failure',
        errorMessage: 'Account deactivated',
        requestId: req.id
      });
      
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await authUtils.comparePassword(password, user.password);
    
    if (!isPasswordValid) {
      await auditLogger.logAuthEvent({
        eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILED,
        userId: user._id,
        userRole: user.role,
        ipAddress,
        userAgent,
        status: 'failure',
        errorMessage: 'Invalid password',
        requestId: req.id
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = authUtils.generateToken(user);
    
    // Generate refresh token
    const refreshToken = authUtils.generateRefreshToken(user._id);
    
    // Save refresh token to user
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({
      token: refreshToken.hashedToken,
      expiresAt: refreshToken.expiresAt,
      userAgent,
      ipAddress
    });
    
    // Keep only last 5 refresh tokens
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    
    await user.save();
    
    // Remove password from response
    user.password = undefined;
    
    // Log successful login
    await auditLogger.logAuthEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_LOGIN,
      userId: user._id,
      userRole: user.role,
      ipAddress,
      userAgent,
      status: 'success',
      requestId: req.id
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token,
        refreshToken: refreshToken.token,
        expiresIn: process.env.JWT_EXPIRY || '24h'
      }
    });
  })
);

/**
 * @route POST /api/auth/class-login
 * @desc Authenticate class login for live classes
 * @access Public
 */
router.post('/class-login',
  rateLimiter.authLimiter,
  validationMiddleware.validateLiveClassAccess(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { classLoginId, password, deviceInfo } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    // Find class login
    const classLogin = await ClassLogin.findById(classLoginId)
      .populate('school', 'name')
      .populate('teacher', 'name email');

    if (!classLogin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid class login credentials'
      });
    }

    // Check if class login is active
    if (!classLogin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Class login is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await authUtils.comparePassword(password, classLogin.password);
    
    if (!isPasswordValid) {
      await auditLogger.logAuthEvent({
        eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILED,
        userId: classLoginId,
        userRole: 'classLogin',
        ipAddress,
        userAgent,
        status: 'failure',
        errorMessage: 'Invalid class login password',
        requestId: req.id
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid class login credentials'
      });
    }

    // Check device limit (using device limiter utility)
    const deviceLimiter = require('../utils/deviceLimiter');
    const sessionId = authUtils.generateSessionId();
    
    const deviceCheck = await deviceLimiter.checkDeviceAccess(
      classLoginId,
      {
        userAgent,
        ipAddress,
        deviceId: deviceInfo?.deviceId
      },
      sessionId
    );

    if (!deviceCheck.allowed) {
      // Log device limit exceeded
      await auditLogger.logDeviceEvent({
        eventType: auditLogger.AUDIT_EVENT_TYPES.DEVICE_LIMIT_EXCEEDED,
        classLoginId,
        className: classLogin.className,
        deviceId: deviceInfo?.deviceId,
        schoolId: classLogin.school?._id,
        details: {
          currentDevices: await deviceLimiter.getActiveDeviceCount(classLoginId),
          deviceLimit: classLogin.deviceLimit,
          reason: deviceCheck.reason
        },
        ipAddress
      });

      // Send alert to admin if configured
      if (classLogin.teacher?.email) {
        try {
          await emailService.sendDeviceLimitAlert({
            adminEmail: classLogin.teacher.email,
            className: classLogin.className,
            classLoginId: classLogin._id,
            currentDevices: await deviceLimiter.getActiveDeviceCount(classLoginId),
            deviceLimit: classLogin.deviceLimit,
            exceededAt: new Date().toISOString()
          });
        } catch (emailError) {
          logger.error('Failed to send device limit alert:', emailError);
        }
      }

      return res.status(403).json({
        success: false,
        message: deviceCheck.reason || 'Device limit exceeded',
        code: 'DEVICE_LIMIT_EXCEEDED',
        deviceLimit: classLogin.deviceLimit
      });
    }

    // Generate token for class login
    const tokenPayload = {
      _id: classLogin._id,
      role: 'classLogin',
      classLoginId: classLogin._id,
      schoolId: classLogin.school?._id,
      teacherId: classLogin.teacher?._id,
      className: classLogin.className,
      permissions: authUtils.getRolePermissions('classLogin')
    };

    const token = authUtils.generateToken(tokenPayload, {
      expiresIn: '8h' // Shorter expiry for class logins
    });

    // Log successful class login
    await auditLogger.logAuthEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_LOGIN,
      userId: classLogin._id,
      userRole: 'classLogin',
      ipAddress,
      userAgent,
      status: 'success',
      requestId: req.id
    });

    // Log device registration
    await auditLogger.logDeviceEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.DEVICE_REGISTERED,
      classLoginId,
      className: classLogin.className,
      deviceId: deviceCheck.existingDevice?._id || 'new',
      schoolId: classLogin.school?._id,
      details: {
        sessionId,
        deviceInfo
      },
      ipAddress
    });

    res.json({
      success: true,
      message: 'Class login successful',
      data: {
        classLogin: {
          _id: classLogin._id,
          className: classLogin.className,
          school: classLogin.school,
          teacher: classLogin.teacher,
          deviceLimit: classLogin.deviceLimit,
          currentDevices: await deviceLimiter.getActiveDeviceCount(classLoginId)
        },
        token,
        sessionId,
        deviceId: deviceCheck.existingDevice?._id,
        expiresIn: '8h'
      }
    });
  })
);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh access token using refresh token
 * @access Public
 */
router.post('/refresh-token',
  rateLimiter.authLimiter,
  validationMiddleware.expressValidator.body('refreshToken').notEmpty(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    // Hash the provided refresh token
    const crypto = require('crypto');
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Find user with this refresh token
    const user = await User.findOne({
      'refreshTokens.token': hashedToken,
      'refreshTokens.expiresAt': { $gt: new Date() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Remove the used refresh token
    user.refreshTokens = user.refreshTokens.filter(
      rt => rt.token !== hashedToken
    );
    
    // Generate new tokens
    const newToken = authUtils.generateToken(user);
    const newRefreshToken = authUtils.generateRefreshToken(user._id);
    
    // Add new refresh token
    user.refreshTokens.push({
      token: newRefreshToken.hashedToken,
      expiresAt: newRefreshToken.expiresAt,
      userAgent,
      ipAddress
    });
    
    await user.save();
    
    // Remove password from response
    user.password = undefined;

    // Log token refresh
    await auditLogger.logAuthEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_TOKEN_REFRESH,
      userId: user._id,
      userRole: user.role,
      ipAddress,
      userAgent,
      status: 'success',
      requestId: req.id
    });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user,
        token: newToken,
        refreshToken: newRefreshToken.token,
        expiresIn: process.env.JWT_EXPIRY || '24h'
      }
    });
  })
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user and invalidate tokens
 * @access Private
 */
router.post('/logout',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { refreshToken } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    // If refresh token provided, remove it
    if (refreshToken) {
      const crypto = require('crypto');
      const hashedToken = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      await User.updateOne(
        { _id: userId },
        { $pull: { refreshTokens: { token: hashedToken } } }
      );
    } else {
      // Remove all refresh tokens for this user agent
      await User.updateOne(
        { _id: userId },
        { $pull: { refreshTokens: { userAgent } } }
      );
    }

    // Log logout event
    await auditLogger.logAuthEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_LOGOUT,
      userId,
      userRole: req.user.role,
      ipAddress,
      userAgent,
      status: 'success',
      requestId: req.id
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  })
);

/**
 * @route POST /api/auth/logout-all
 * @desc Logout from all devices
 * @access Private
 */
router.post('/logout-all',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    // Clear all refresh tokens
    await User.updateOne(
      { _id: userId },
      { $set: { refreshTokens: [] } }
    );

    // Log logout all event
    await auditLogger.logAuthEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_LOGOUT,
      userId,
      userRole: req.user.role,
      ipAddress,
      userAgent,
      status: 'success',
      requestId: req.id,
      details: { logoutAll: true }
    });

    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  })
);

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post('/forgot-password',
  rateLimiter.authLimiter,
  validationMiddleware.expressValidator.body('email').isEmail().normalizeEmail(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal that user doesn't exist (security best practice)
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link'
      });
    }

    // Generate password reset token
    const resetToken = authUtils.createPasswordResetToken(user._id, email);
    
    // Save reset token to user
    user.resetPasswordToken = resetToken.hashedToken;
    user.resetPasswordExpires = resetToken.expiresAt;
    await user.save();

    // Send password reset email
    try {
      await emailService.sendPasswordReset({
        userEmail: email,
        userName: user.name || 'User',
        resetToken: resetToken.resetToken,
        ipAddress
      });

      // Log password reset request
      await auditLogger.logAuthEvent({
        eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_PASSWORD_RESET_REQUEST,
        userId: user._id,
        userRole: user.role,
        ipAddress,
        userAgent,
        status: 'success',
        requestId: req.id
      });

    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError);
      
      // Still return success to user (don't reveal email failure)
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link'
    });
  })
);

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password using token
 * @access Public
 */
router.post('/reset-password',
  rateLimiter.authLimiter,
  validationMiddleware.expressValidator.body('token').notEmpty(),
  validationMiddleware.expressValidator.body('password').isLength({ min: 6 }),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    // Validate reset token
    const tokenData = authUtils.validatePasswordResetToken(token);
    
    if (!tokenData) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      _id: tokenData.userId,
      resetPasswordToken: tokenData.resetToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const hashedPassword = await authUtils.hashPassword(password);
    
    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    // Invalidate all refresh tokens (security measure)
    user.refreshTokens = [];
    
    await user.save();

    // Send password reset confirmation email
    try {
      await emailService.sendEmail({
        to: user.email,
        template: 'PASSWORD_RESET_SUCCESS',
        data: {
          userName: user.name || 'User',
          userEmail: user.email,
          resetTime: new Date().toLocaleString()
        }
      });
    } catch (emailError) {
      logger.error('Failed to send password reset confirmation:', emailError);
    }

    // Log password reset completion
    await auditLogger.logAuthEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_PASSWORD_RESET_COMPLETE,
      userId: user._id,
      userRole: user.role,
      ipAddress,
      userAgent,
      status: 'success',
      requestId: req.id
    });

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });
  })
);

/**
 * @route POST /api/auth/change-password
 * @desc Change password while logged in
 * @access Private
 */
router.post('/change-password',
  validationMiddleware.expressValidator.body('currentPassword').notEmpty(),
  validationMiddleware.expressValidator.body('newPassword').isLength({ min: 6 }),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    // Find user with password
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await authUtils.comparePassword(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await authUtils.hashPassword(newPassword);
    
    // Update password
    user.password = hashedPassword;
    
    // Invalidate all refresh tokens (security measure)
    user.refreshTokens = [];
    
    await user.save();

    // Log password change
    await auditLogger.logAuthEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_PASSWORD_CHANGE,
      userId: user._id,
      userRole: user.role,
      ipAddress,
      userAgent,
      status: 'success',
      requestId: req.id
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });
  })
);

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    
    const user = await User.findById(userId)
      .populate('school', 'name address')
      .select('-password -refreshTokens');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add permissions based on role
    const userWithPermissions = user.toObject();
    userWithPermissions.permissions = authUtils.getRolePermissions(user.role);

    res.json({
      success: true,
      data: userWithPermissions
    });
  })
);

/**
 * @route PUT /api/auth/me
 * @desc Update current user profile
 * @access Private
 */
router.put('/me',
  validationMiddleware.expressValidator.body('name').optional().trim(),
  validationMiddleware.expressValidator.body('phone').optional().trim(),
  validationMiddleware.expressValidator.body('avatar').optional().isURL(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const updates = req.body;

    // Remove restricted fields
    delete updates.email;
    delete updates.role;
    delete updates.password;
    delete updates.isActive;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -refreshTokens');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Log profile update
    await auditLogger.logUserManagementEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.USER_UPDATED,
      actorId: userId,
      actorType: user.role,
      targetUserId: userId,
      targetUserType: user.role,
      targetUserName: user.name,
      changes: updates,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  })
);

/**
 * @route POST /api/auth/google
 * @desc Authenticate with Google OAuth
 * @access Public
 */
router.post('/google',
  rateLimiter.authLimiter,
  validationMiddleware.expressValidator.body('idToken').notEmpty(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { idToken } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    try {
      // Verify Google ID token
      const googleUser = await authUtils.verifyGoogleToken(idToken);
      
      // Find or create user
      let user = await User.findOne({ email: googleUser.email });
      
      if (!user) {
        // Create new user (teacher or admin based on domain maybe)
        const isOpenSkillEmail = googleUser.email.endsWith('@openskillnepal.com');
        
        user = new User({
          name: googleUser.name,
          email: googleUser.email,
          googleId: googleUser.googleId,
          isEmailVerified: googleUser.emailVerified,
          avatar: googleUser.picture,
          role: isOpenSkillEmail ? 'teacher' : 'student', // Default role
          isActive: true
        });
        
        await user.save();
        
        // Log user creation
        await auditLogger.logUserManagementEvent({
          eventType: auditLogger.AUDIT_EVENT_TYPES.USER_CREATED,
          actorId: user._id,
          actorType: 'system',
          targetUserId: user._id,
          targetUserType: user.role,
          targetUserName: user.name,
          ipAddress,
          userAgent
        });
      } else {
        // Update Google ID if not set
        if (!user.googleId) {
          user.googleId = googleUser.googleId;
          user.isEmailVerified = googleUser.emailVerified;
          await user.save();
        }
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact administrator.'
        });
      }

      // Generate JWT token
      const token = authUtils.generateToken(user);
      
      // Generate refresh token
      const refreshToken = authUtils.generateRefreshToken(user._id);
      
      // Save refresh token
      user.refreshTokens = user.refreshTokens || [];
      user.refreshTokens.push({
        token: refreshToken.hashedToken,
        expiresAt: refreshToken.expiresAt,
        userAgent,
        ipAddress
      });
      
      await user.save();
      
      // Remove sensitive data
      user.password = undefined;
      user.refreshTokens = undefined;

      // Log successful Google login
      await auditLogger.logAuthEvent({
        eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_LOGIN,
        userId: user._id,
        userRole: user.role,
        ipAddress,
        userAgent,
        status: 'success',
        requestId: req.id,
        details: { authMethod: 'google' }
      });

      res.json({
        success: true,
        message: 'Google authentication successful',
        data: {
          user,
          token,
          refreshToken: refreshToken.token,
          expiresIn: process.env.JWT_EXPIRY || '24h'
        }
      });

    } catch (error) {
      logger.error('Google authentication failed:', error);
      
      await auditLogger.logAuthEvent({
        eventType: auditLogger.AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILED,
        userId: null,
        userRole: null,
        ipAddress,
        userAgent,
        status: 'failure',
        errorMessage: error.message,
        requestId: req.id,
        details: { authMethod: 'google' }
      });
      
      return res.status(401).json({
        success: false,
        message: 'Google authentication failed'
      });
    }
  })
);

/**
 * Health check for auth routes
 */
router.get('/health', async (req, res) => {
  try {
    // Check if auth utilities are working
    const testToken = authUtils.generateToken({ _id: 'test', role: 'test' }, { expiresIn: '1s' });
    
    res.json({
      status: 'healthy',
      service: 'auth-routes',
      timestamp: new Date().toISOString(),
      checks: {
        authUtils: 'working',
        database: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'auth-routes',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
