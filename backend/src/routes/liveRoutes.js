/**
 * Live Class Routes
 * 
 * Handles live class streaming, device management, and real-time interactions
 * for Open Skill Nepal platform.
 * 
 * @module routes/liveRoutes
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
const LiveClass = require('../models/LiveClass');
const ClassLogin = require('../models/ClassLogin');
const Device = require('../models/Device');

/**
 * @route POST /api/live/start
 * @desc Start a new live class
 * @access Private (Teacher)
 */
router.post('/start',
  rateLimiter.liveClassLimiter,
  validationMiddleware.expressValidator.body('classLoginId').notEmpty(),
  validationMiddleware.expressValidator.body('title').trim().notEmpty().isLength({ min: 2, max: 200 }),
  validationMiddleware.expressValidator.body('description').optional().trim().isLength({ max: 500 }),
  validationMiddleware.expressValidator.body('scheduledStart').optional().isISO8601(),
  validationMiddleware.expressValidator.body('estimatedDuration').optional().isInt({ min: 5, max: 240 }),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { classLoginId, title, description, scheduledStart, estimatedDuration } = req.body;
    
    // Verify user is a teacher
    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can start live classes'
      });
    }
    
    // Find class login
    const classLogin = await ClassLogin.findById(classLoginId)
      .populate('school', 'name')
      .populate('teacher', 'name email');
    
    if (!classLogin) {
      return res.status(404).json({
        success: false,
        message: 'Class login not found'
      });
    }
    
    // Verify teacher owns this class login
    if (classLogin.teacher._id.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to start live class for this class login'
      });
    }
    
    // Check if class login is active
    if (!classLogin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Class login is deactivated'
      });
    }
    
    // Check if there's already an active live class for this class login
    const existingLiveClass = await LiveClass.findOne({
      classLogin: classLoginId,
      status: { $in: ['scheduled', 'live', 'starting'] }
    });
    
    if (existingLiveClass) {
      return res.status(400).json({
        success: false,
        message: 'There is already an active or scheduled live class for this class login',
        data: {
          existingClassId: existingLiveClass._id,
          status: existingLiveClass.status
        }
      });
    }
    
    // Generate unique meeting ID
    const meetingId = generateMeetingId();
    
    // Generate teacher access token (for controlling the class)
    const teacherToken = generateAccessToken(meetingId, 'teacher', req.user.userId);
    
    // Generate student join token (for students to join)
    const studentToken = generateAccessToken(meetingId, 'student', classLoginId);
    
    // Create live class
    const liveClass = new LiveClass({
      classLogin: classLoginId,
      teacher: req.user.userId,
      school: classLogin.school,
      meetingId,
      title,
      description,
      scheduledStart: scheduledStart ? new Date(scheduledStart) : new Date(),
      estimatedDuration: estimatedDuration || 60, // Default 60 minutes
      status: 'scheduled',
      teacherToken,
      maxParticipants: classLogin.deviceLimit * 2, // Allow some buffer
      settings: {
        allowStudentAudio: false, // Mic off by default
        allowStudentVideo: false, // Webcam off by default
        recordingEnabled: true,
        raiseHandEnabled: true,
        chatEnabled: true
      }
    });
    
    await liveClass.save();
    
    // Populate references
    await liveClass.populate('classLogin', 'className section');
    await liveClass.populate('teacher', 'name email avatar');
    await liveClass.populate('school', 'name');
    
    // Log live class creation
    await auditLogger.logLiveClassEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.LIVE_CLASS_STARTED,
      classId: liveClass._id,
      className: `${classLogin.className}${classLogin.section ? ` - ${classLogin.section}` : ''}`,
      teacherId: req.user.userId,
      teacherName: req.user.name || 'Teacher',
      schoolId: classLogin.school,
      details: {
        meetingId,
        title,
        scheduledStart: liveClass.scheduledStart
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Live class scheduled successfully',
      data: {
        liveClass,
        access: {
          teacherToken,
          studentToken,
          meetingId,
          joinUrl: `${process.env.FRONTEND_URL}/live/${meetingId}`
        }
      }
    });
  })
);

/**
 * @route POST /api/live/:meetingId/join
 * @desc Join a live class
 * @access Private (Teacher, ClassLogin)
 */
router.post('/:meetingId/join',
  rateLimiter.liveClassLimiter,
  validationMiddleware.expressValidator.param('meetingId').notEmpty(),
  validationMiddleware.expressValidator.body('participantName').optional().trim(),
  validationMiddleware.expressValidator.body('deviceId').optional().trim(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { participantName, deviceId } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');
    
    // Find live class
    const liveClass = await LiveClass.findOne({ meetingId })
      .populate('classLogin', 'className section school teacher deviceLimit')
      .populate('teacher', 'name email')
      .populate('school', 'name');
    
    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }
    
    // Check live class status
    if (liveClass.status === 'ended' || liveClass.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Live class has already been ${liveClass.status}`
      });
    }
    
    // Determine participant type and validate access
    let participantType;
    let participantId;
    let isValidParticipant = false;
    
    // Check if user is the teacher
    if (req.user.role === 'teacher' && req.user.userId === liveClass.teacher._id.toString()) {
      participantType = 'teacher';
      participantId = req.user.userId;
      isValidParticipant = true;
    }
    // Check if user is a class login for this class
    else if (req.user.role === 'classLogin' && req.user.classLoginId === liveClass.classLogin._id.toString()) {
      participantType = 'student';
      participantId = req.user.classLoginId;
      isValidParticipant = true;
      
      // Check device limit for students
      const deviceCheck = await deviceLimiter.checkDeviceAccess(
        liveClass.classLogin._id,
        {
          userAgent,
          ipAddress,
          deviceId
        },
        `live_${meetingId}_${Date.now()}`
      );
      
      if (!deviceCheck.allowed) {
        return res.status(403).json({
          success: false,
          message: deviceCheck.reason || 'Device limit exceeded for this class',
          code: 'DEVICE_LIMIT_EXCEEDED',
          deviceLimit: liveClass.classLogin.deviceLimit
        });
      }
    }
    
    if (!isValidParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to join this live class'
      });
    }
    
    // Generate participant token
    const participantToken = generateAccessToken(
      meetingId,
      participantType,
      participantId,
      participantName || (participantType === 'teacher' ? liveClass.teacher.name : 'Student')
    );
    
    // Update live class participant count
    if (participantType === 'student') {
      liveClass.currentParticipants = (liveClass.currentParticipants || 0) + 1;
      
      // Check if max participants reached
      if (liveClass.currentParticipants >= liveClass.maxParticipants) {
        liveClass.status = 'full';
      }
      
      await liveClass.save();
    }
    
    // Add participant to participants list
    const participant = {
      participantId,
      participantType,
      participantName: participantName || (participantType === 'teacher' ? liveClass.teacher.name : 'Student'),
      joinedAt: new Date(),
      ipAddress,
      userAgent,
      deviceId: deviceId || null
    };
    
    await LiveClass.updateOne(
      { _id: liveClass._id },
      { $push: { participants: participant } }
    );
    
    // Log join event
    await auditLogger.logLiveClassEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.LIVE_CLASS_JOINED,
      classId: liveClass._id,
      className: `${liveClass.classLogin.className}${liveClass.classLogin.section ? ` - ${liveClass.classLogin.section}` : ''}`,
      teacherId: liveClass.teacher._id,
      teacherName: liveClass.teacher.name,
      participantId,
      participantType,
      schoolId: liveClass.school?._id,
      details: {
        meetingId,
        participantName: participant.participantName
      }
    });
    
    res.json({
      success: true,
      message: 'Joined live class successfully',
      data: {
        liveClass: {
          _id: liveClass._id,
          meetingId: liveClass.meetingId,
          title: liveClass.title,
          teacher: liveClass.teacher,
          classLogin: liveClass.classLogin,
          status: liveClass.status,
          settings: liveClass.settings,
          startedAt: liveClass.startedAt,
          currentParticipants: liveClass.currentParticipants,
          maxParticipants: liveClass.maxParticipants
        },
        participant: {
          type: participantType,
          name: participant.participantName,
          token: participantToken
        },
        websocket: {
          url: process.env.WEBSOCKET_URL || `wss://${req.headers.host}/ws`,
          channel: `live_${meetingId}`
        }
      }
    });
  })
);

/**
 * @route POST /api/live/:meetingId/leave
 * @desc Leave a live class
 * @access Private (Teacher, ClassLogin)
 */
router.post('/:meetingId/leave',
  validationMiddleware.expressValidator.param('meetingId').notEmpty(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { participantId } = req.body;
    
    // Find live class
    const liveClass = await LiveClass.findOne({ meetingId });
    
    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }
    
    // Determine which participant is leaving
    let leavingParticipantId = participantId;
    if (!leavingParticipantId) {
      if (req.user.role === 'teacher') {
        leavingParticipantId = req.user.userId;
      } else if (req.user.role === 'classLogin') {
        leavingParticipantId = req.user.classLoginId;
      }
    }
    
    // Update participant leftAt time
    await LiveClass.updateOne(
      { 
        _id: liveClass._id,
        'participants.participantId': leavingParticipantId,
        'participants.leftAt': { $exists: false }
      },
      {
        $set: { 'participants.$.leftAt': new Date() }
      }
    );
    
    // Update participant count if student
    if (req.user.role === 'classLogin') {
      liveClass.currentParticipants = Math.max(0, (liveClass.currentParticipants || 0) - 1);
      await liveClass.save();
    }
    
    // Log leave event
    await auditLogger.logLiveClassEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.LIVE_CLASS_LEFT,
      classId: liveClass._id,
      className: liveClass.title,
      teacherId: liveClass.teacher,
      teacherName: 'Teacher',
      participantId: leavingParticipantId,
      participantType: req.user.role === 'teacher' ? 'teacher' : 'student',
      schoolId: liveClass.school,
      details: {
        meetingId,
        leftAt: new Date()
      }
    });
    
    res.json({
      success: true,
      message: 'Left live class successfully'
    });
  })
);

/**
 * @route POST /api/live/:meetingId/end
 * @desc End a live class
 * @access Private (Teacher)
 */
router.post('/:meetingId/end',
  validationMiddleware.expressValidator.param('meetingId').notEmpty(),
  validationMiddleware.expressValidator.body('recordingUrl').optional().isURL(),
  validationMiddleware.expressValidator.body('summary').optional().trim(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { recordingUrl, summary } = req.body;
    
    // Find live class
    const liveClass = await LiveClass.findOne({ meetingId })
      .populate('classLogin', 'className section')
      .populate('teacher', 'name email');
    
    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }
    
    // Verify user is the teacher
    if (req.user.role !== 'teacher' || req.user.userId !== liveClass.teacher._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the teacher can end the live class'
      });
    }
    
    // Update live class
    liveClass.status = 'ended';
    liveClass.endedAt = new Date();
    liveClass.recordingUrl = recordingUrl;
    liveClass.summary = summary;
    liveClass.duration = Math.round((liveClass.endedAt - (liveClass.startedAt || liveClass.scheduledStart)) / 60000); // minutes
    
    await liveClass.save();
    
    // Log live class end
    await auditLogger.logLiveClassEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.LIVE_CLASS_ENDED,
      classId: liveClass._id,
      className: `${liveClass.classLogin.className}${liveClass.classLogin.section ? ` - ${liveClass.classLogin.section}` : ''}`,
      teacherId: req.user.userId,
      teacherName: req.user.name || 'Teacher',
      schoolId: liveClass.school,
      details: {
        meetingId,
        duration: liveClass.duration,
        participants: liveClass.currentParticipants || 0
      }
    });
    
    res.json({
      success: true,
      message: 'Live class ended successfully',
      data: liveClass
    });
  })
);

/**
 * @route GET /api/live/:meetingId
 * @desc Get live class details
 * @access Private (Teacher, ClassLogin, Admin, SchoolAdmin)
 */
router.get('/:meetingId',
  validationMiddleware.expressValidator.param('meetingId').notEmpty(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    
    const liveClass = await LiveClass.findOne({ meetingId })
      .populate('classLogin', 'className section school teacher')
      .populate('teacher', 'name email avatar')
      .populate('school', 'name');
    
    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }
    
    // Check permissions
    if (!canAccessLiveClass(req.user, liveClass)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this live class'
      });
    }
    
    res.json({
      success: true,
      data: liveClass
    });
  })
);

/**
 * @route GET /api/live
 * @desc Get live classes with filtering
 * @access Private (Teacher, Admin, SchoolAdmin)
 */
router.get('/',
  validationMiddleware.validatePagination(),
  validationMiddleware.expressValidator.query('status').optional().isIn(['scheduled', 'live', 'ended', 'cancelled']),
  validationMiddleware.expressValidator.query('classLoginId').optional(),
  validationMiddleware.expressValidator.query('teacherId').optional(),
  validationMiddleware.expressValidator.query('schoolId').optional(),
  validationMiddleware.expressValidator.query('startDate').optional().isISO8601(),
  validationMiddleware.expressValidator.query('endDate').optional().isISO8601(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      classLoginId, 
      teacherId, 
      schoolId,
      startDate,
      endDate
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Build query based on user role
    const query = {};
    
    // Apply filters based on user role
    if (req.user.role === 'teacher') {
      query.teacher = req.user.userId;
    } else if (req.user.role === 'schoolAdmin') {
      query.school = req.user.schoolId;
    } else if (req.user.role === 'classLogin') {
      query.classLogin = req.user.classLoginId;
    }
    
    // Apply additional filters
    if (status) {
      query.status = status;
    }
    
    if (classLoginId && (req.user.role === 'superAdmin' || req.user.role === 'admin')) {
      query.classLogin = classLoginId;
    }
    
    if (teacherId && (req.user.role === 'superAdmin' || req.user.role === 'admin')) {
      query.teacher = teacherId;
    }
    
    if (schoolId && (req.user.role === 'superAdmin' || req.user.role === 'admin')) {
      query.school = schoolId;
    }
    
    if (startDate || endDate) {
      query.scheduledStart = {};
      if (startDate) {
        query.scheduledStart.$gte = new Date(startDate);
      }
      if (endDate) {
        query.scheduledStart.$lte = new Date(endDate);
      }
    }
    
    // Execute query with pagination
    const [liveClasses, total] = await Promise.all([
      LiveClass.find(query)
        .populate('classLogin', 'className section')
        .populate('teacher', 'name email')
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
 * @route PUT /api/live/:meetingId/settings
 * @desc Update live class settings
 * @access Private (Teacher)
 */
router.put('/:meetingId/settings',
  validationMiddleware.expressValidator.param('meetingId').notEmpty(),
  validationMiddleware.expressValidator.body('settings').isObject(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { meetingId } = req.params;
    const { settings } = req.body;
    
    // Find live class
    const liveClass = await LiveClass.findOne({ meetingId });
    
    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }
    
    // Verify user is the teacher
    if (req.user.role !== 'teacher' || req.user.userId !== liveClass.teacher.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the teacher can update settings'
      });
    }
    
    // Update settings
    const allowedSettings = [
      'allowStudentAudio',
      'allowStudentVideo',
      'recordingEnabled',
      'raiseHandEnabled',
      'chatEnabled'
    ];
    
    allowedSettings.forEach(setting => {
      if (settings[setting] !== undefined) {
        liveClass.settings[setting] = settings[setting];
      }
    });
    
    await liveClass.save();
    
    res.json({
      success: true,
      message: 'Live class settings updated',
      data: liveClass.settings
    });
  })
);

/**
 * @route POST /api/live/:meetingId/participants/:participantId/control
 * @desc Control participant (mute/unmute, video on/off)
 * @access Private (Teacher)
 */
router.post('/:meetingId/participants/:participantId/control',
  validationMiddleware.expressValidator.param('meetingId').notEmpty(),
  validationMiddleware.expressValidator.param('participantId').notEmpty(),
  validationMiddleware.expressValidator.body('action').isIn(['mute', 'unmute', 'video_on', 'video_off', 'remove']),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { meetingId, participantId } = req.params;
    const { action } = req.body;
    
    // Find live class
    const liveClass = await LiveClass.findOne({ meetingId });
    
    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }
    
    // Verify user is the teacher
    if (req.user.role !== 'teacher' || req.user.userId !== liveClass.teacher.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the teacher can control participants'
      });
    }
    
    // Find participant in the class
    const participant = liveClass.participants.find(
      p => p.participantId === participantId && !p.leftAt
    );
    
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found in this live class'
      });
    }
    
    // Don't allow controlling other teachers
    if (participant.participantType === 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Cannot control other teachers'
      });
    }
    
    // Create control action
    const controlAction = {
      action,
      participantId,
      participantName: participant.participantName,
      controlledBy: req.user.userId,
      controlledAt: new Date()
    };
    
    // Add to control actions log
    await LiveClass.updateOne(
      { _id: liveClass._id },
      { $push: { controlActions: controlAction } }
    );
    
    // If action is remove, mark participant as left
    if (action === 'remove') {
      await LiveClass.updateOne(
        { 
          _id: liveClass._id,
          'participants.participantId': participantId
        },
        {
          $set: { 'participants.$.leftAt': new Date() }
        }
      );
      
      // Update participant count
      liveClass.currentParticipants = Math.max(0, (liveClass.currentParticipants || 0) - 1);
      await liveClass.save();
    }
    
    res.json({
      success: true,
      message: `Participant ${action}d successfully`,
      data: controlAction
    });
  })
);

/**
 * Helper function to generate meeting ID
 */
function generateMeetingId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`.toUpperCase();
}

/**
 * Helper function to generate access token
 */
function generateAccessToken(meetingId, role, userId, name = '') {
  const crypto = require('crypto');
  const payload = {
    meetingId,
    role,
    userId,
    name,
    timestamp: Date.now()
  };
  
  const secret = process.env.JWT_SECRET || 'open-skill-nepal-secret';
  const data = JSON.stringify(payload);
  
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
    .substring(0, 32);
}

/**
 * Helper function to check if user can access live class
 */
function canAccessLiveClass(user, liveClass) {
  // Super admin can access everything
  if (user.role === 'superAdmin') {
    return true;
  }
  
  // Admin can access all live classes
  if (user.role === 'admin') {
    return true;
  }
  
  // Teacher can access their own live classes
  if (user.role === 'teacher') {
    return user.userId && user.userId.toString() === liveClass.teacher._id.toString();
  }
  
  // School admin can access live classes in their school
  if (user.role === 'schoolAdmin') {
    return user.schoolId && user.schoolId.toString() === liveClass.school._id.toString();
  }
  
  // Class login can access live classes for their class
  if (user.role === 'classLogin') {
    return user.classLoginId && user.classLoginId.toString() === liveClass.classLogin._id.toString();
  }
  
  return false;
}

/**
 * Health check for live routes
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const count = await LiveClass.countDocuments();
    
    res.json({
      status: 'healthy',
      service: 'live-routes',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        liveClassesCount: count
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'live-routes',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
