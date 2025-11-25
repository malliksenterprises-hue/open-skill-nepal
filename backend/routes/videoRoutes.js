const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/authMiddleware');
const router = express.Router();

// Configure multer for video uploads (memory storage for now)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// Teacher: Upload and schedule video
router.post('/upload', requireRole('teacher'), upload.single('video'), async (req, res) => {
  try {
    const { title, description, subject, grade, scheduledFor, schoolId } = req.body;
    const Video = require('../models/Video');
    const School = require('../models/School');
    
    // Validation
    if (!title || !subject || !grade || !scheduledFor || !schoolId) {
      return res.status(400).json({
        message: 'Missing required fields: title, subject, grade, scheduledFor, schoolId'
      });
    }

    // Verify teacher is assigned to this school
    const school = await School.findOne({
      _id: schoolId,
      teachers: req.user._id
    });
    
    if (!school) {
      return res.status(403).json({ message: 'Not assigned to this school' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'Video file is required' });
    }

    // In production: Upload to Google Cloud Storage
    // For development: Store file info and use mock URL
    const videoUrl = `https://storage.googleapis.com/openskillnepal-videos/${Date.now()}-${req.file.originalname}`;
    const thumbnailUrl = `https://storage.googleapis.com/openskillnepal-thumbnails/${Date.now()}-thumb.jpg`;

    const video = new Video({
      title,
      description,
      subject,
      grade,
      teacher: req.user._id,
      school: schoolId,
      videoUrl,
      thumbnailUrl,
      scheduledFor: new Date(scheduledFor),
      duration: Math.floor(Math.random() * 45) + 30, // 30-75 minutes mock
      status: 'scheduled'
    });

    await video.save();

    res.status(201).json({
      message: 'Video uploaded and scheduled successfully!',
      video: {
        id: video._id,
        title: video.title,
        subject: video.subject,
        grade: video.grade,
        scheduledFor: video.scheduledFor,
        status: video.status,
        duration: video.duration
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Video Upload Error:', error);
    res.status(500).json({
      message: 'Video upload failed',
      error: error.message
    });
  }
});

// Get teacher's uploaded videos
router.get('/my-videos', requireRole('teacher'), async (req, res) => {
  try {
    const Video = require('../models/Video');
    
    const videos = await Video.find({ teacher: req.user._id })
      .populate('school', 'name code')
      .sort({ scheduledFor: -1 });

    res.json({
      videos,
      totalCount: videos.length,
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

// Get live classes for student
router.get('/live', requireRole('student'), async (req, res) => {
  try {
    // Check if student is approved
    if (req.user.status !== 'approved') {
      return res.status(403).json({
        message: 'Account pending verification'
      });
    }

    const Video = require('../models/Video');
    const now = new Date();
    
    const liveClasses = await Video.find({
      school: req.user.school,
      status: { $in: ['scheduled', 'live'] },
      scheduledFor: {
        $lte: new Date(now.getTime() + 30 * 60000), // 30 minutes buffer
        $gte: new Date(now.getTime() - 120 * 60000) // Started within last 2 hours
      }
    }).populate('teacher', 'name')
      .populate('school', 'name')
      .sort({ scheduledFor: 1 });

    res.json({
      liveClasses,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Live Classes Error:', error);
    res.status(500).json({
      message: 'Failed to fetch live classes',
      error: error.message
    });
  }
});

// Student: Join live class
router.post('/:videoId/join', requireRole('student'), async (req, res) => {
  try {
    // Check if student is approved
    if (req.user.status !== 'approved') {
      return res.status(403).json({
        message: 'Account pending verification'
      });
    }

    const Video = require('../models/Video');
    
    const video = await Video.findById(req.params.videoId)
      .populate('teacher', 'name')
      .populate('school', 'name');

    if (!video) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Check if class is accessible to student's school
    if (video.school._id.toString() !== req.user.school.toString()) {
      return res.status(403).json({ message: 'Access denied to this class' });
    }

    // Check if class is live or scheduled to start soon
    const now = new Date();
    const startTime = new Date(video.scheduledFor);
    const endTime = new Date(startTime.getTime() + video.duration * 60000);

    if (now < startTime) {
      return res.status(400).json({
        message: 'Class has not started yet',
        startsIn: Math.floor((startTime - now) / 60000) // minutes
      });
    }

    if (now > endTime) {
      return res.status(400).json({
        message: 'Class has ended',
        videoUrl: video.videoUrl // Still allow access to recording
      });
    }

    // Mark class as live if it's scheduled and has started
    if (video.status === 'scheduled') {
      video.status = 'live';
      await video.save();
    }

    // Record attendance
    const existingAttendance = video.attendees.find(
      attendee => attendee.student.toString() === req.user._id.toString()
    );

    if (!existingAttendance) {
      video.attendees.push({
        student: req.user._id,
        joinedAt: new Date(),
        duration: 0,
        completed: false
      });
      await video.save();
    }

    res.json({
      message: 'Joined class successfully',
      video: {
        id: video._id,
        title: video.title,
        description: video.description,
        videoUrl: video.videoUrl,
        teacher: video.teacher.name,
        school: video.school.name,
        scheduledFor: video.scheduledFor,
        duration: video.duration,
        status: video.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Join Class Error:', error);
    res.status(500).json({
      message: 'Failed to join class',
      error: error.message
    });
  }
});

// Get class recordings for student
router.get('/recordings', requireRole('student'), async (req, res) => {
  try {
    if (req.user.status !== 'approved') {
      return res.status(403).json({
        message: 'Account pending verification'
      });
    }

    const Video = require('../models/Video');
    
    const recordings = await Video.find({
      school: req.user.school,
      status: 'completed'
    }).populate('teacher', 'name')
      .populate('school', 'name')
      .sort({ scheduledFor: -1 })
      .limit(20);

    res.json({
      recordings,
      totalCount: recordings.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Recordings Error:', error);
    res.status(500).json({
      message: 'Failed to fetch recordings',
      error: error.message
    });
  }
});

module.exports = router;
