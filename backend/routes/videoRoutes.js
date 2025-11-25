const express = require('express');
const { requireRole } = require('../middleware/authMiddleware');
const router = express.Router();
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Configure Google Cloud Storage
const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/mkv', 'video/avi', 'video/mov', 'video/wmv'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'), false);
    }
  }
});

// Teacher: Upload and schedule video
router.post('/upload', requireRole('teacher'), upload.single('video'), async (req, res) => {
  try {
    const { title, description, scheduledFor, assignedSchools, subjects, gradeLevel } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    if (!title || !scheduledFor) {
      return res.status(400).json({ message: 'Title and scheduled time are required' });
    }

    const Video = require('../models/Video');
    const School = require('../models/School');

    // Validate assigned schools
    const schools = JSON.parse(assignedSchools || '[]');
    if (schools.length === 0) {
      return res.status(400).json({ message: 'At least one school must be selected' });
    }

    // Check if teacher has access to these schools
    const teacherSchools = await School.find({ teachers: req.user._id });
    const accessibleSchoolIds = teacherSchools.map(school => school._id.toString());
    
    const invalidSchools = schools.filter(schoolId => 
      !accessibleSchoolIds.includes(schoolId)
    );

    if (invalidSchools.length > 0) {
      return res.status(403).json({ message: 'Access denied to some selected schools' });
    }

    // Upload to Google Cloud Storage
    const timestamp = Date.now();
    const filename = `videos/${timestamp}-${req.file.originalname.replace(/\s+/g, '_')}`;
    const blob = bucket.file(filename);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    blobStream.on('error', (err) => {
      console.error('GCS Upload Error:', err);
      res.status(500).json({ message: 'Video upload failed' });
    });

    blobStream.on('finish', async () => {
      try {
        const fileUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        
        // Make the file publicly accessible
        await blob.makePublic();

        const video = new Video({
          title,
          description,
          filename: req.file.originalname,
          fileUrl,
          fileSize: req.file.size,
          teacher: req.user._id,
          scheduledFor: new Date(scheduledFor),
          assignedSchools: schools,
          subjects: JSON.parse(subjects || '[]'),
          gradeLevel: gradeLevel || 'all'
        });

        await video.save();

        // Populate the response with teacher and school data
        await video.populate('teacher', 'name');
        await video.populate('assignedSchools', 'name');

        res.status(201).json({
          message: 'Video uploaded and scheduled successfully',
          video: {
            id: video._id,
            title: video.title,
            description: video.description,
            fileUrl: video.fileUrl,
            scheduledFor: video.scheduledFor,
            status: video.status,
            assignedSchools: video.assignedSchools,
            teacher: video.teacher
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Video Save Error:', error);
        res.status(500).json({ message: 'Failed to save video details', error: error.message });
      }
    });

    blobStream.end(req.file.buffer);
  } catch (error) {
    console.error('Video Upload Error:', error);
    res.status(500).json({ 
      message: 'Video upload failed',
      error: error.message 
    });
  }
});

// Teacher: Get my uploaded videos
router.get('/my-videos', requireRole('teacher'), async (req, res) => {
  try {
    const Video = require('../models/Video');
    const { page = 1, limit = 10, status } = req.query;

    const query = { teacher: req.user._id };
    if (status && ['scheduled', 'live', 'completed'].includes(status)) {
      query.status = status;
    }

    const videos = await Video.find(query)
      .populate('assignedSchools', 'name code')
      .sort({ scheduledFor: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Video.countDocuments(query);

    res.json({
      videos,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalVideos: total,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get My Videos Error:', error);
    res.status(500).json({ 
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
      return res.status(404).json({ message: 'School not found' });
    }

    const query = { assignedSchools: school._id };
    if (status && ['scheduled', 'live', 'completed'].includes(status)) {
      query.status = status;
    }

    const videos = await Video.find(query)
      .populate('teacher', 'name email avatar')
      .populate('assignedSchools', 'name')
      .sort({ scheduledFor: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Video.countDocuments(query);

    // Get statistics
    const stats = {
      scheduled: await Video.countDocuments({ 
        assignedSchools: school._id, 
        status: 'scheduled' 
      }),
      live: await Video.countDocuments({ 
        assignedSchools: school._id, 
        status: 'live' 
      }),
      completed: await Video.countDocuments({ 
        assignedSchools: school._id, 
        status: 'completed' 
      })
    };

    res.json({
      videos,
      stats,
      school: { name: school.name, code: school.code },
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalVideos: total,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get School Videos Error:', error);
    res.status(500).json({ 
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

    const [liveClasses, upcomingClasses, recordedClasses] = await Promise.all([
      Video.getLiveClassesForSchool(req.user.school),
      Video.getUpcomingClassesForSchool(req.user.school),
      Video.find({
        assignedSchools: req.user.school,
        status: 'completed'
      }).populate('teacher', 'name avatar')
        .sort({ scheduledFor: -1 })
        .limit(20)
    ]);

    res.json({
      liveClasses,
      upcomingClasses,
      recordedClasses,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Student Videos Error:', error);
    res.status(500).json({ 
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
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if student has access
    if (!video.assignedSchools.includes(req.user.school)) {
      return res.status(403).json({ message: 'Access denied to this video' });
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

    await video.save();

    res.json({
      message: 'View progress updated',
      durationWatched,
      completed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update View Progress Error:', error);
    res.status(500).json({ 
      message: 'Failed to update view progress',
      error: error.message 
    });
  }
});

module.exports = router;
