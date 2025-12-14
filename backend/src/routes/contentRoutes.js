/**
 * Content Routes
 * 
 * Handles study materials, recorded classes, notes, and content management
 * for Open Skill Nepal platform.
 * 
 * @module routes/contentRoutes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const validationMiddleware = require('../middleware/validationMiddleware');
const cloudStorage = require('../utils/cloudStorage');
const auditLogger = require('../utils/auditLogger');
const { asyncHandler } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Import models
const Content = require('../models/Content');
const LiveClass = require('../models/LiveClass');
const ClassLogin = require('../models/ClassLogin');
const School = require('../models/School');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 5 // Max 5 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'video/mp4',
      'video/webm',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/zip',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`));
    }
  }
});

/**
 * @route GET /api/content
 * @desc Get content with filtering
 * @access Private (Based on user role and permissions)
 */
router.get('/',
  validationMiddleware.validatePagination(),
  validationMiddleware.expressValidator.query('type').optional().isIn(['video', 'document', 'image', 'link', 'assignment']),
  validationMiddleware.expressValidator.query('classLoginId').optional(),
  validationMiddleware.expressValidator.query('schoolId').optional(),
  validationMiddleware.expressValidator.query('teacherId').optional(),
  validationMiddleware.expressValidator.query('search').optional().trim(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      classLoginId, 
      schoolId, 
      teacherId,
      search 
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Build query based on user role and permissions
    const query = { isActive: true };
    
    // Apply filters
    if (type) {
      query.type = type;
    }
    
    if (classLoginId) {
      // Check if user has access to this class login
      const classLogin = await ClassLogin.findById(classLoginId);
      if (classLogin && canAccessClassContent(req.user, classLogin)) {
        query.classLogin = classLoginId;
      } else {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view content for this class'
        });
      }
    } else if (schoolId) {
      // Check if user has access to this school
      if (canAccessSchoolContent(req.user, schoolId)) {
        query.school = schoolId;
      } else {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view content for this school'
        });
      }
    } else if (teacherId) {
      // Teachers can view their own content
      if (req.user.role === 'teacher' && req.user.userId === teacherId) {
        query.teacher = teacherId;
      } else if (req.user.role === 'superAdmin' || req.user.role === 'admin') {
        query.teacher = teacherId;
      } else {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this teacher\'s content'
        });
      }
    } else {
      // Default: show content user has access to
      const accessibleContent = await getAccessibleContentQuery(req.user);
      Object.assign(query, accessibleContent);
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const [content, total] = await Promise.all([
      Content.find(query)
        .populate('classLogin', 'className section')
        .populate('school', 'name')
        .populate('teacher', 'name email')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Content.countDocuments(query)
    ]);
    
    // Generate signed URLs for private content
    const contentWithUrls = await Promise.all(
      content.map(async (item) => {
        const contentObj = item.toObject();
        
        // Generate signed URL for private files
        if (contentObj.fileUrl && !contentObj.isPublic) {
          try {
            const signedUrl = await cloudStorage.getSignedUrl(contentObj.fileUrl, 3600000); // 1 hour
            contentObj.accessUrl = signedUrl;
          } catch (error) {
            logger.error('Failed to generate signed URL:', error);
            contentObj.accessUrl = null;
          }
        } else if (contentObj.fileUrl) {
          contentObj.accessUrl = contentObj.fileUrl;
        }
        
        return contentObj;
      })
    );
    
    res.json({
      success: true,
      data: contentWithUrls,
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
 * @route GET /api/content/:id
 * @desc Get content by ID
 * @access Private (Based on user role and permissions)
 */
router.get('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const content = await Content.findById(id)
      .populate('classLogin', 'className section school teacher')
      .populate('school', 'name')
      .populate('teacher', 'name email')
      .populate('createdBy', 'name');
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    // Check permissions
    if (!canAccessContent(req.user, content)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this content'
      });
    }
    
    // Generate signed URL for private files
    const contentObj = content.toObject();
    
    if (contentObj.fileUrl && !contentObj.isPublic) {
      try {
        const signedUrl = await cloudStorage.getSignedUrl(contentObj.fileUrl, 3600000); // 1 hour
        contentObj.accessUrl = signedUrl;
      } catch (error) {
        logger.error('Failed to generate signed URL:', error);
        contentObj.accessUrl = null;
      }
    } else if (contentObj.fileUrl) {
      contentObj.accessUrl = contentObj.fileUrl;
    }
    
    // Log content access
    await auditLogger.logAuditEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.CONTENT_ACCESSED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetId: content._id,
      targetType: 'Content',
      targetName: content.title,
      description: `Content "${content.title}" accessed by ${req.user.role}`,
      details: {
        contentId: content._id,
        contentType: content.type,
        classLogin: content.classLogin?.className,
        school: content.school?.name
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      data: contentObj
    });
  })
);

/**
 * @route POST /api/content
 * @desc Create new content (upload file or create link)
 * @access Private (Teacher, Admin)
 */
router.post('/',
  upload.array('files', 5),
  validationMiddleware.expressValidator.body('title').trim().notEmpty().isLength({ min: 2, max: 200 }),
  validationMiddleware.expressValidator.body('description').optional().trim().isLength({ max: 1000 }),
  validationMiddleware.expressValidator.body('type').isIn(['video', 'document', 'image', 'link', 'assignment']),
  validationMiddleware.expressValidator.body('classLoginId').optional(),
  validationMiddleware.expressValidator.body('schoolId').optional(),
  validationMiddleware.expressValidator.body('isPublic').optional().isBoolean(),
  validationMiddleware.expressValidator.body('tags').optional().isArray(),
  validationMiddleware.expressValidator.body('url').optional().isURL(),
  validationMiddleware.expressValidator.body('dueDate').optional().isISO8601(),
  validationMiddleware.expressValidator.body('points').optional().isInt({ min: 0, max: 1000 }),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    // Only teachers and admins can create content
    if (req.user.role !== 'teacher' && req.user.role !== 'superAdmin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers and admins can create content'
      });
    }
    
    const { 
      title, 
      description, 
      type, 
      classLoginId, 
      schoolId, 
      isPublic = false,
      tags,
      url,
      dueDate,
      points
    } = req.body;
    
    const files = req.files || [];
    
    // Validate that we have either files or URL for non-link types
    if (type !== 'link' && files.length === 0 && !url) {
      return res.status(400).json({
        success: false,
        message: 'Either files or URL is required for this content type'
      });
    }
    
    // Validate class login access if provided
    let classLogin = null;
    if (classLoginId) {
      classLogin = await ClassLogin.findById(classLoginId);
      
      if (!classLogin) {
        return res.status(400).json({
          success: false,
          message: 'Class login not found'
        });
      }
      
      // Check if teacher has access to this class login
      if (req.user.role === 'teacher' && classLogin.teacher.toString() !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create content for this class'
        });
      }
    }
    
    // Validate school access if provided
    let school = null;
    if (schoolId) {
      school = await School.findById(schoolId);
      
      if (!school) {
        return res.status(400).json({
          success: false,
          message: 'School not found'
        });
      }
      
      // Check if user has access to this school
      if (!canAccessSchoolContent(req.user, schoolId)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to create content for this school'
        });
      }
    }
    
    // Upload files to cloud storage
    let uploadedFiles = [];
    if (files.length > 0) {
      uploadedFiles = await Promise.all(
        files.map(async (file) => {
          try {
            const uploadResult = await cloudStorage.uploadFile(
              file, 
              req.user.userId,
              {
                contentType: type,
                title,
                classLoginId,
                schoolId
              }
            );
            
            return {
              originalName: file.originalname,
              fileName: uploadResult.fileId,
              fileUrl: uploadResult.filePath,
              mimeType: file.mimetype,
              size: file.size,
              publicUrl: uploadResult.publicUrl,
              signedUrl: uploadResult.signedUrl
            };
          } catch (uploadError) {
            logger.error('File upload failed:', uploadError);
            throw new Error(`Failed to upload file: ${file.originalname}`);
          }
        })
      );
    }
    
    // Determine the primary file/URL
    const primaryFile = uploadedFiles.length > 0 ? uploadedFiles[0] : null;
    const fileUrl = primaryFile ? primaryFile.fileUrl : url;
    const thumbnailUrl = uploadedFiles.find(f => f.mimeType.startsWith('image/'))?.publicUrl || null;
    
    // Create content
    const content = new Content({
      title,
      description,
      type,
      fileUrl,
      url: type === 'link' ? url : null,
      thumbnailUrl,
      classLogin: classLoginId,
      school: schoolId || (classLogin ? classLogin.school : null),
      teacher: req.user.role === 'teacher' ? req.user.userId : null,
      createdBy: req.user.userId,
      isPublic,
      tags: tags || [],
      metadata: {
        files: uploadedFiles,
        fileCount: uploadedFiles.length,
        totalSize: uploadedFiles.reduce((sum, file) => sum + file.size, 0)
      },
      // Assignment specific fields
      ...(type === 'assignment' && {
        dueDate: dueDate ? new Date(dueDate) : null,
        points: points || 0,
        assignmentType: 'upload', // or 'text', 'quiz'
        submissions: []
      })
    });
    
    await content.save();
    
    // Populate references
    await content.populate('classLogin', 'className section');
    await content.populate('school', 'name');
    await content.populate('teacher', 'name email');
    
    // Log content creation
    await auditLogger.logAuditEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.CONTENT_UPLOADED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetId: content._id,
      targetType: 'Content',
      targetName: content.title,
      description: `Content "${content.title}" created by ${req.user.role}`,
      details: {
        contentType: type,
        fileCount: uploadedFiles.length,
        classLogin: classLogin?.className,
        school: school?.name,
        isPublic
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    // Generate access URL for private content
    const contentObj = content.toObject();
    if (contentObj.fileUrl && !contentObj.isPublic && primaryFile?.signedUrl) {
      contentObj.accessUrl = primaryFile.signedUrl;
    } else if (contentObj.fileUrl) {
      contentObj.accessUrl = contentObj.fileUrl;
    }
    
    res.status(201).json({
      success: true,
      message: 'Content created successfully',
      data: contentObj
    });
  })
);

/**
 * @route PUT /api/content/:id
 * @desc Update content
 * @access Private (Teacher who created it, Admin)
 */
router.put('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.expressValidator.body('title').optional().trim().isLength({ min: 2, max: 200 }),
  validationMiddleware.expressValidator.body('description').optional().trim().isLength({ max: 1000 }),
  validationMiddleware.expressValidator.body('isPublic').optional().isBoolean(),
  validationMiddleware.expressValidator.body('tags').optional().isArray(),
  validationMiddleware.expressValidator.body('dueDate').optional().isISO8601(),
  validationMiddleware.expressValidator.body('points').optional().isInt({ min: 0, max: 1000 }),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    // Find content
    const content = await Content.findById(id);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    // Check permissions
    if (!canManageContent(req.user, content)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this content'
      });
    }
    
    // Store old values for audit log
    const oldValues = {
      title: content.title,
      isPublic: content.isPublic,
      tags: content.tags
    };
    
    // Apply updates
    const allowedUpdates = ['title', 'description', 'isPublic', 'tags', 'dueDate', 'points'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        content[field] = updates[field];
      }
    });
    
    await content.save();
    
    // Populate references
    await content.populate('classLogin', 'className section');
    await content.populate('school', 'name');
    await content.populate('teacher', 'name email');
    
    // Log content update
    await auditLogger.logAuditEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.CONTENT_UPLOADED, // Using same event for updates
      actorId: req.user.userId,
      actorType: req.user.role,
      targetId: content._id,
      targetType: 'Content',
      targetName: content.title,
      description: `Content "${content.title}" updated by ${req.user.role}`,
      changes: {
        old: oldValues,
        new: {
          title: content.title,
          isPublic: content.isPublic,
          tags: content.tags
        }
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'Content updated successfully',
      data: content
    });
  })
);

/**
 * @route DELETE /api/content/:id
 * @desc Delete content
 * @access Private (Teacher who created it, Admin)
 */
router.delete('/:id',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Find content
    const content = await Content.findById(id);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    // Check permissions
    if (!canManageContent(req.user, content)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this content'
      });
    }
    
    // Delete files from cloud storage
    if (content.fileUrl) {
      try {
        await cloudStorage.deleteFile(content.fileUrl);
        
        // Delete other associated files
        if (content.metadata?.files) {
          for (const file of content.metadata.files) {
            if (file.fileUrl !== content.fileUrl) {
              await cloudStorage.deleteFile(file.fileUrl).catch(() => {});
            }
          }
        }
      } catch (storageError) {
        logger.error('Failed to delete files from storage:', storageError);
        // Continue with deletion even if file deletion fails
      }
    }
    
    // Soft delete content
    content.isActive = false;
    content.deletedAt = new Date();
    content.deletedBy = req.user.userId;
    await content.save();
    
    // Log content deletion
    await auditLogger.logAuditEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.CONTENT_DELETED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetId: content._id,
      targetType: 'Content',
      targetName: content.title,
      description: `Content "${content.title}" deleted by ${req.user.role}`,
      details: {
        contentType: content.type,
        classLogin: content.classLogin?.toString(),
        school: content.school?.toString()
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: 'Content deleted successfully'
    });
  })
);

/**
 * @route POST /api/content/:id/share
 * @desc Share content with additional class logins or schools
 * @access Private (Teacher who created it, Admin)
 */
router.post('/:id/share',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.expressValidator.body('classLoginIds').optional().isArray(),
  validationMiddleware.expressValidator.body('schoolIds').optional().isArray(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { classLoginIds, schoolIds } = req.body;
    
    // Find content
    const content = await Content.findById(id);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }
    
    // Check permissions
    if (!canManageContent(req.user, content)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to share this content'
      });
    }
    
    // Validate class logins
    const validClassLogins = [];
    if (classLoginIds && classLoginIds.length > 0) {
      for (const classLoginId of classLoginIds) {
        const classLogin = await ClassLogin.findById(classLoginId);
        if (classLogin && canAccessClassContent(req.user, classLogin)) {
          validClassLogins.push(classLoginId);
        }
      }
    }
    
    // Validate schools
    const validSchools = [];
    if (schoolIds && schoolIds.length > 0) {
      for (const schoolId of schoolIds) {
        if (canAccessSchoolContent(req.user, schoolId)) {
          validSchools.push(schoolId);
        }
      }
    }
    
    // Update sharedWith field
    content.sharedWith = {
      classLogins: validClassLogins,
      schools: validSchools,
      sharedAt: new Date(),
      sharedBy: req.user.userId
    };
    
    await content.save();
    
    // Log content sharing
    await auditLogger.logAuditEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.CONTENT_SHARED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetId: content._id,
      targetType: 'Content',
      targetName: content.title,
      description: `Content "${content.title}" shared by ${req.user.role}`,
      details: {
        classLogins: validClassLogins.length,
        schools: validSchools.length
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      message: `Content shared with ${validClassLogins.length} class(es) and ${validSchools.length} school(s)`,
      data: {
        sharedWith: content.sharedWith
      }
    });
  })
);

/**
 * @route GET /api/content/recorded-classes
 * @desc Get recorded classes (from live classes)
 * @access Private (Based on user role and permissions)
 */
router.get('/recorded-classes',
  validationMiddleware.validatePagination(),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query for live classes with recordings
    const query = {
      status: 'ended',
      recordingUrl: { $exists: true, $ne: null }
    };
    
    // Apply role-based filtering
    if (req.user.role === 'teacher') {
      query.teacher = req.user.userId;
    } else if (req.user.role === 'schoolAdmin') {
      query.school = req.user.schoolId;
    } else if (req.user.role === 'classLogin') {
      query.classLogin = req.user.classLoginId;
    } else if (req.user.role === 'student') {
      // Students can only access recordings from their class logins
      // This would require a student-class login mapping
      // For now, return empty or implement based on your student model
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
    
    // Get recorded classes
    const [recordedClasses, total] = await Promise.all([
      LiveClass.find(query)
        .populate('classLogin', 'className section')
        .populate('teacher', 'name email')
        .populate('school', 'name')
        .select('title description recordingUrl scheduledStart endedAt duration currentParticipants')
        .sort({ endedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      LiveClass.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: recordedClasses,
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
 * @route POST /api/content/recorded-classes/:id/access
 * @desc Get access URL for recorded class
 * @access Private (Based on user role and permissions)
 */
router.post('/recorded-classes/:id/access',
  validationMiddleware.validateObjectIds('id'),
  validationMiddleware.handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Find live class
    const liveClass = await LiveClass.findById(id)
      .populate('classLogin', 'className section school teacher')
      .populate('school', 'name')
      .populate('teacher', 'name email');
    
    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Recorded class not found'
      });
    }
    
    // Check permissions
    if (!canAccessRecordedClass(req.user, liveClass)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this recorded class'
      });
    }
    
    if (!liveClass.recordingUrl) {
      return res.status(404).json({
        success: false,
        message: 'Recording not available for this class'
      });
    }
    
    // Generate signed URL if needed
    let accessUrl = liveClass.recordingUrl;
    
    // Check if URL is a cloud storage path (not a public URL)
    if (liveClass.recordingUrl.startsWith('videos/') || liveClass.recordingUrl.startsWith('recordings/')) {
      try {
        accessUrl = await cloudStorage.getSignedUrl(liveClass.recordingUrl, 3600000); // 1 hour
      } catch (error) {
        logger.error('Failed to generate signed URL for recording:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to generate access URL for recording'
        });
      }
    }
    
    // Log recording access
    await auditLogger.logAuditEvent({
      eventType: auditLogger.AUDIT_EVENT_TYPES.CONTENT_ACCESSED,
      actorId: req.user.userId,
      actorType: req.user.role,
      targetId: liveClass._id,
      targetType: 'LiveClass',
      targetName: liveClass.title,
      description: `Recorded class "${liveClass.title}" accessed by ${req.user.role}`,
      details: {
        classId: liveClass._id,
        classLogin: liveClass.classLogin?.className,
        school: liveClass.school?.name
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    
    res.json({
      success: true,
      data: {
        liveClass: {
          _id: liveClass._id,
          title: liveClass.title,
          description: liveClass.description,
          teacher: liveClass.teacher,
          classLogin: liveClass.classLogin,
          scheduledStart: liveClass.scheduledStart,
          endedAt: liveClass.endedAt,
          duration: liveClass.duration,
          participants: liveClass.currentParticipants
        },
        accessUrl,
        expiresIn: '1 hour'
      }
    });
  })
);

/**
 * Helper function to check if user can access class content
 */
function canAccessClassContent(user, classLogin) {
  // Super admin can access everything
  if (user.role === 'superAdmin') {
    return true;
  }
  
  // Admin can access all content
  if (user.role === 'admin') {
    return true;
  }
  
  // School admin can access content in their school
  if (user.role === 'schoolAdmin') {
    return user.schoolId && user.schoolId.toString() === classLogin.school.toString();
  }
  
  // Teacher can access content for their classes
  if (user.role === 'teacher') {
    return user.userId && user.userId.toString() === classLogin.teacher.toString();
  }
  
  // Class login can access their own content
  if (user.role === 'classLogin') {
    return user.classLoginId && user.classLoginId.toString() === classLogin._id.toString();
  }
  
  return false;
}

/**
 * Helper function to check if user can access school content
 */
function canAccessSchoolContent(user, schoolId) {
  // Super admin can access everything
  if (user.role === 'superAdmin') {
    return true;
  }
  
  // Admin can access all content
  if (user.role === 'admin') {
    return true;
  }
  
  // School admin can access content in their school
  if (user.role === 'schoolAdmin') {
    return user.schoolId && user.schoolId.toString() === schoolId.toString();
  }
  
  // Teacher can access content in their school
  if (user.role === 'teacher') {
    return user.schoolId && user.schoolId.toString() === schoolId.toString();
  }
  
  return false;
}

/**
 * Helper function to check if user can access content
 */
function canAccessContent(user, content) {
  // Public content is accessible to all authenticated users
  if (content.isPublic) {
    return true;
  }
  
  // Super admin can access everything
  if (user.role === 'superAdmin') {
    return true;
  }
  
  // Admin can access all content
  if (user.role === 'admin') {
    return true;
  }
  
  // Check class login access
  if (content.classLogin) {
    if (canAccessClassContent(user, content.classLogin)) {
      return true;
    }
  }
  
  // Check school access
  if (content.school) {
    if (canAccessSchoolContent(user, content.school)) {
      return true;
    }
  }
  
  // Check teacher access (teacher who created the content)
  if (content.teacher && user.role === 'teacher') {
    return user.userId && user.userId.toString() === content.teacher.toString();
  }
  
  // Check shared content
  if (content.sharedWith) {
    // Check if shared with user's class login
    if (user.classLoginId && content.sharedWith.classLogins?.includes(user.classLoginId.toString())) {
      return true;
    }
    
    // Check if shared with user's school
    if (user.schoolId && content.sharedWith.schools?.includes(user.schoolId.toString())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Helper function to check if user can manage content
 */
function canManageContent(user, content) {
  // Super admin can manage everything
  if (user.role === 'superAdmin') {
    return true;
  }
  
  // Admin can manage all content
  if (user.role === 'admin') {
    return true;
  }
  
  // Teacher can manage their own content
  if (user.role === 'teacher') {
    return user.userId && content.teacher && user.userId.toString() === content.teacher.toString();
  }
  
  return false;
}

/**
 * Helper function to check if user can access recorded class
 */
function canAccessRecordedClass(user, liveClass) {
  // Super admin can access everything
  if (user.role === 'superAdmin') {
    return true;
  }
  
  // Admin can access all recordings
  if (user.role === 'admin') {
    return true;
  }
  
  // Teacher can access their own recordings
  if (user.role === 'teacher') {
    return user.userId && user.userId.toString() === liveClass.teacher.toString();
  }
  
  // School admin can access recordings from their school
  if (user.role === 'schoolAdmin') {
    return user.schoolId && liveClass.school && user.schoolId.toString() === liveClass.school.toString();
  }
  
  // Class login can access recordings from their class
  if (user.role === 'classLogin') {
    return user.classLoginId && liveClass.classLogin && user.classLoginId.toString() === liveClass.classLogin._id.toString();
  }
  
  return false;
}

/**
 * Helper function to get accessible content query based on user role
 */
async function getAccessibleContentQuery(user) {
  const query = {};
  
  if (user.role === 'superAdmin' || user.role === 'admin') {
    // Can access all content
    return query;
  }
  
  if (user.role === 'schoolAdmin') {
    query.$or = [
      { school: user.schoolId },
      { 'sharedWith.schools': user.schoolId },
      { isPublic: true }
    ];
    return query;
  }
  
  if (user.role === 'teacher') {
    query.$or = [
      { teacher: user.userId },
      { school: user.schoolId },
      { 'sharedWith.schools': user.schoolId },
      { 'sharedWith.classLogins': { $in: await getUserClassLogins(user.userId) } },
      { isPublic: true }
    ];
    return query;
  }
  
  if (user.role === 'classLogin') {
    query.$or = [
      { classLogin: user.classLoginId },
      { 'sharedWith.classLogins': user.classLoginId },
      { isPublic: true }
    ];
    return query;
  }
  
  if (user.role === 'student') {
    // Students can only access public content
    // In a real implementation, you would check student enrollment
    query.isPublic = true;
    return query;
  }
  
  return { isPublic: true };
}

/**
 * Helper function to get user's class logins (for teachers)
 */
async function getUserClassLogins(userId) {
  const classLogins = await ClassLogin.find({ teacher: userId, isActive: true }).select('_id');
  return classLogins.map(cl => cl._id.toString());
}

/**
 * Health check for content routes
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const count = await Content.countDocuments();
    
    // Check cloud storage
    const storageAvailable = cloudStorage.isStorageAvailable();
    
    res.json({
      status: 'healthy',
      service: 'content-routes',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        cloudStorage: storageAvailable ? 'connected' : 'fallback',
        contentCount: count
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'content-routes',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
