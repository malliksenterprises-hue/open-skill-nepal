const express = require('express');
const { requireRole } = require('../middleware/authMiddleware');
const router = express.Router();
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const path = require('path');

// ============ ENHANCED GOOGLE CLOUD STORAGE CONFIG ============
let storage;
let bucket;
let storageInitialized = false;

const initializeStorage = () => {
  try {
    // Method 1: Service account key file
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      storage = new Storage({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        projectId: 'open-skill-nepal-478611'
      });
      console.log('✅ Google Cloud Storage initialized with service account');
    }
    // Method 2: Base64 encoded key in environment variable (for Cloud Run)
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const keyData = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, 'base64').toString();
      const credentials = JSON.parse(keyData);
      storage = new Storage({
        credentials: credentials,
        projectId: credentials.project_id || 'open-skill-nepal-478611'
      });
      console.log('✅ Google Cloud Storage initialized with base64 credentials');
    }
    // Method 3: Default credentials (for Cloud Run with workload identity)
    else {
      storage = new Storage();
      console.log('✅ Google Cloud Storage initialized with default credentials');
    }
    
    bucket = storage.bucket('open-skill-nepal-videos');
    storageInitialized = true;
    console.log(`✅ Using bucket: open-skill-nepal-videos`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Google Cloud Storage:', error.message);
    console.log('⚠️ Video uploads will not work. Please configure credentials.');
    return false;
  }
};

// Initialize storage on startup
initializeStorage();

// ============ MULTER CONFIGURATION ============
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/mkv', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files (MP4, MKV, AVI, MOV, WMV, WEBM) are allowed.'), false);
    }
  }
});

// ============ HEALTH CHECK ENDPOINT ============
router.get('/health', async (req, res) => {
  res.json({
    success: true,
    message: 'Video API is working',
    storage: storageInitialized ? 'configured' : 'not configured',
    bucket: 'open-skill-nepal-videos',
    timestamp: new Date().toISOString()
  });
});

// ============ NEW PHASE 2 ENDPOINTS ============

// GET /api/videos/live-now - Get currently live videos
router.get('/live-now', async (req, res) => {
  try {
    const Video = require('../models/Video');
    const currentTime = new Date();
    
    // Find videos that are scheduled as live
    const liveVideos = await Video.find({
      status: 'live',
      scheduledFor: { $lte: currentTime }
    })
    .populate('teacher', 'name email avatar')
    .populate('assignedSchools', 'name code')
    .limit(10);

    res.json({
      success: true,
      liveVideos,
      count: liveVideos.length,
      currentTime: currentTime.toISOString(),
      message: liveVideos.length > 0 ? 'Live videos found' : 'No live videos at the moment'
    });
  } catch (error) {
    console.error('❌ Live videos error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch live videos',
      details: error.message 
    });
  }
});

// GET /api/videos/upcoming - Get upcoming scheduled videos
router.get('/upcoming', async (req, res) => {
  try {
    const Video = require('../models/Video');
    const currentTime = new Date();
    
    const upcomingVideos = await Video.find({
      status: 'scheduled',
      scheduledFor: { $gt: currentTime }
    })
    .populate('teacher', 'name email')
    .populate('assignedSchools', 'name code')
    .sort({ scheduledFor: 1 })
    .limit(20);

    res.json({
      success: true,
      upcomingVideos,
      count: upcomingVideos.length,
      currentTime: currentTime.toISOString()
    });
  } catch (error) {
    console.error('❌ Upcoming videos error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch upcoming videos',
      details: error.message 
    });
  }
});

// GET /api/videos/recorded - Get recorded/past videos
router.get('/recorded', async (req, res) => {
  try {
    const Video = require('../models/Video');
    const { page = 1, limit = 20, schoolId } = req.query;
    
    const query = { 
      status: { $in: ['recorded', 'completed', 'published'] }
    };
    
    if (schoolId) {
      query.assignedSchools = schoolId;
    }

    const videos = await Video.find(query)
      .populate('teacher', 'name email avatar')
      .populate('assignedSchools', 'name code')
      .sort({ scheduledFor: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Video.countDocuments(query);

    res.json({
      success: true,
      videos,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('❌ Recorded videos error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch recorded videos',
      details: error.message 
    });
  }
});

// PUT /api/videos/:id/status - Update video status (for cron scheduler)
router.put('/:id/status', async (req, res) => {
  try {
    const Video = require('../models/Video');
    const { status } = req.body;
    
    if (!['scheduled', 'live', 'recorded', 'completed', 'published'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid status. Must be: scheduled, live, recorded, completed, or published' 
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ 
        success: false,
        error: 'Video not found' 
      });
    }

    video.status = status;
    video.updatedAt = new Date();
    await video.save();

    res.json({
      success: true,
      message: `Video status updated to ${status}`,
      video: {
        id: video._id,
        title: video.title,
        status: video.status,
        scheduledFor: video.scheduledFor,
        updatedAt: video.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Update status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update video status',
      details: error.message 
    });
  }
});

// GET /api/videos/:id - Get single video details
router.get('/:id', async (req, res) => {
  try {
    const Video = require('../models/Video');
    
    const video = await Video.findById(req.params.id)
      .populate('teacher', 'name email avatar qualifications')
      .populate('assignedSchools', 'name code address');

    if (!video) {
      return res.status(404).json({ 
        success: false,
        error: 'Video not found' 
      });
    }

    res.json({
      success: true,
      video,
      playback: {
        url: video.fileUrl,
        duration: video.duration || 0,
        canPlay: ['live', 'recorded', 'completed', 'published'].includes(video.status)
      }
    });
  } catch (error) {
    console.error('❌ Get video error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch video',
      details: error.message 
    });
  }
});

// ============ ENHANCED UPLOAD ENDPOINT ============

// POST /api/videos/upload - Teacher: Upload and schedule video
router.post('/upload', requireRole('teacher'), upload.single('video'), async (req, res) => {
  try {
    // Check storage initialization
    if (!storageInitialized) {
      const initialized = initializeStorage();
      if (!initialized) {
        return res.status(500).json({ 
          success: false,
          message: 'Video storage not configured',
          details: 'Google Cloud Storage is not initialized. Please check service account credentials.',
          fix: 'Set GOOGLE_APPLICATION_CREDENTIALS environment variable'
        });
      }
    }

    const { title, description, scheduledFor, assignedSchools, subjects, gradeLevel, duration, thumbnailUrl } = req.body;

    // Validation
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No video file provided' 
      });
    }

    if (!title || !scheduledFor) {
      return res.status(400).json({ 
        success: false,
        message: 'Title and scheduled time are required' 
      });
    }

    const Video = require('../models/Video');
    const School = require('../models/School');

    // Validate assigned schools
    let schools = [];
    try {
      schools = JSON.parse(assignedSchools || '[]');
    } catch (e) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid schools format. Must be JSON array' 
      });
    }
    
    if (schools.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'At least one school must be selected' 
      });
    }

    // Check if teacher has access to these schools
    const teacherSchools = await School.find({ teachers: req.user._id });
    const accessibleSchoolIds = teacherSchools.map(school => school._id.toString());
    
    const invalidSchools = schools.filter(schoolId => 
      !accessibleSchoolIds.includes(schoolId)
    );

    if (invalidSchools.length > 0) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied to some selected schools',
        invalidSchools 
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const safeFilename = req.file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\s+/g, '_');
    const filename = `videos/${timestamp}_${req.user._id}_${safeFilename}`;
    
    console.log(`📤 Uploading video: ${filename} (${req.file.size} bytes)`);

    // Upload to Google Cloud Storage
    const blob = bucket.file(filename);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          originalName: req.file.originalname,
          uploadedBy: req.user.email,
          teacherId: req.user._id.toString(),
          uploadTime: new Date().toISOString()
        }
      },
    });

    let uploadError = null;
    blobStream.on('error', (err) => {
      uploadError = err;
      console.error('❌ GCS Upload Error:', err);
    });

    blobStream.on('finish', async () => {
      if (uploadError) {
        return res.status(500).json({ 
          success: false,
          message: 'Video upload failed',
          error: uploadError.message 
        });
      }

      try {
        // Make the file publicly accessible
        await blob.makePublic();
        const fileUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        console.log('✅ Video uploaded to:', fileUrl);

        // Determine initial status based on schedule
        const scheduledTime = new Date(scheduledFor);
        const currentTime = new Date();
        let initialStatus = 'scheduled';
        
        if (scheduledTime <= currentTime) {
          initialStatus = 'published';
        }

        // Parse subjects
        let subjectList = [];
        try {
          subjectList = subjects ? JSON.parse(subjects) : [];
        } catch (e) {
          subjectList = subjects ? [subjects] : [];
        }

        // Create video document
        const video = new Video({
          title,
          description: description || '',
          filename: req.file.originalname,
          fileUrl,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          teacher: req.user._id,
          scheduledFor: scheduledTime,
          assignedSchools: schools,
          subjects: subjectList,
          gradeLevel: gradeLevel || 'all',
          status: initialStatus,
          // New Phase 2 fields
          duration: parseInt(duration) || 0,
          thumbnailUrl: thumbnailUrl || '',
          videoType: 'lecture',
          views: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await video.save();

        // Populate response data
        await video.populate('teacher', 'name email avatar');
        await video.populate('assignedSchools', 'name code');

        res.status(201).json({
          success: true,
          message: initialStatus === 'scheduled' 
            ? 'Video uploaded and scheduled successfully' 
            : 'Video uploaded successfully',
          video: {
            id: video._id,
            title: video.title,
            description: video.description,
            fileUrl: video.fileUrl,
            scheduledFor: video.scheduledFor,
            status: video.status,
            assignedSchools: video.assignedSchools,
            teacher: video.teacher,
            duration: video.duration,
            thumbnailUrl: video.thumbnailUrl
          },
          storage: {
            bucket: bucket.name,
            filename: filename,
            url: fileUrl
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Video Save Error:', error);
        res.status(500).json({ 
          success: false,
          message: 'Failed to save video details', 
          error: error.message 
        });
      }
    });

    blobStream.end(req.file.buffer);
  } catch (error) {
    console.error('❌ Video Upload Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Video upload failed',
      error: error.message 
    });
  }
});

// ============ YOUR EXISTING ENDPOINTS (ENHANCED) ============

// Teacher: Get my uploaded videos
router.get('/my-videos', requireRole('teacher'), async (req, res) => {
  try {
    const Video = require('../models/Video');
    const { page = 1, limit = 10, status } = req.query;

    const query = { teacher: req.user._id };
    if (status && ['scheduled', 'live', 'completed', 'recorded', 'published'].includes(status)) {
      query.status = status;
    }

    const videos = await Video.find(query)
      .populate('assignedSchools', 'name code')
      .sort({ scheduledFor: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Video.countDocuments(query);

    // Get statistics
    const stats = {
      scheduled: await Video.countDocuments({ teacher: req.user._id, status: 'scheduled' }),
      live: await Video.countDocuments({ teacher: req.user._id, status: 'live' }),
      recorded: await Video.countDocuments({ teacher: req.user._id, status: 'recorded' }),
      completed: await Video.countDocuments({ teacher: req.user._id, status: 'completed' }),
      total: total
    };

    res.json({
      success: true,
      videos,
      stats,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      totalVideos: total,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get My Videos Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch videos',
      error: error.message 
    });
  }
});

// School Admin: Get videos for their school
router.get('/school-videos', requireRole('school_admin'), async (req, res) => {
  try {
    const Video = require('../models/Video');
    const School = require('../models/School');
    const { status, page = 1, limit = 10 } = req.query;

    // Get school managed by this admin
    const school = await School.findOne({ admin: req.user._id });
    if (!school) {
      return res.status(404).json({ 
        success: false,
        message: 'School not found' 
      });
    }

    const query = { assignedSchools: school._id };
    if (status && ['scheduled', 'live', 'completed', 'recorded', 'published'].includes(status)) {
      query.status = status;
    }

    const videos = await Video.find(query)
      .populate('teacher', 'name email avatar')
      .populate('assignedSchools', 'name code')
      .sort({ scheduledFor: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Video.countDocuments(query);

    // Get statistics for dashboard
    const stats = {
      scheduled: await Video.countDocuments({ assignedSchools: school._id, status: 'scheduled' }),
      live: await Video.countDocuments({ assignedSchools: school._id, status: 'live' }),
      recorded: await Video.countDocuments({ assignedSchools: school._id, status: 'recorded' }),
      completed: await Video.countDocuments({ assignedSchools: school._id, status: 'completed' }),
      total: total
    };

    res.json({
      success: true,
      videos,
      stats,
      school: { 
        id: school._id,
        name: school.name, 
        code: school.code 
      },
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      totalVideos: total,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get School Videos Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch school videos',
      error: error.message 
    });
  }
});

// Student: Get accessible videos
router.get('/student-videos', requireRole('student'), async (req, res) => {
  try {
    const Video = require('../models/Video');
    const currentTime = new Date();

    // Get live videos for student's school
    const liveClasses = await Video.find({
      assignedSchools: req.user.school,
      status: 'live',
      scheduledFor: { $lte: currentTime }
    })
    .populate('teacher', 'name avatar')
    .sort({ scheduledFor: -1 })
    .limit(5);

    // Get upcoming videos
    const upcomingClasses = await Video.find({
      assignedSchools: req.user.school,
      status: 'scheduled',
      scheduledFor: { $gt: currentTime }
    })
    .populate('teacher', 'name avatar')
    .sort({ scheduledFor: 1 })
    .limit(10);

    // Get recorded videos
    const recordedClasses = await Video.find({
      assignedSchools: req.user.school,
      status: { $in: ['recorded', 'completed', 'published'] }
    })
    .populate('teacher', 'name avatar')
    .sort({ scheduledFor: -1 })
    .limit(20);

    res.json({
      success: true,
      liveClasses,
      upcomingClasses,
      recordedClasses,
      timestamp: new Date().toISOString(),
      message: `Found ${liveClasses.length} live, ${upcomingClasses.length} upcoming, ${recordedClasses.length} recorded classes`
    });
  } catch (error) {
    console.error('❌ Get Student Videos Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch videos',
      error: error.message 
    });
  }
});

// Update video viewing progress
router.post('/:videoId/view', requireRole('student'), async (req, res) => {
  try {
    const { durationWatched, completed } = req.body;
    const Video = require('../models/Video');

    const video = await Video.findById(req.params.videoId);
    if (!video) {
      return res.status(404).json({ 
        success: false,
        message: 'Video not found' 
      });
    }

    // Check if student has access
    if (!video.assignedSchools.includes(req.user.school)) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied to this video' 
      });
    }

    // Find existing view or create new one
    const existingViewIndex = video.viewers.findIndex(
      view => view.student.toString() === req.user._id.toString()
    );

    if (existingViewIndex > -1) {
      // Update existing view
      video.viewers[existingViewIndex].durationWatched = durationWatched || video.viewers[existingViewIndex].durationWatched;
      video.viewers[existingViewIndex].completed = completed !== undefined ? completed : video.viewers[existingViewIndex].completed;
      video.viewers[existingViewIndex].watchedAt = new Date();
    } else {
      // Create new view
      video.viewers.push({
        student: req.user._id,
        durationWatched: durationWatched || 0,
        completed: completed || false,
        watchedAt: new Date()
      });
    }

    // Increment view count
    video.views = (video.views || 0) + 1;
    video.updatedAt = new Date();

    await video.save();

    res.json({
      success: true,
      message: 'View progress updated',
      durationWatched,
      completed,
      totalViews: video.views,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Update View Progress Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update view progress',
      error: error.message 
    });
  }
});

module.exports = router;
