const express = require('express');
const { requireRole } = require('../middleware/authMiddleware');
const router = express.Router();
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const path = require('path');

// ============ ENHANCED GOOGLE CLOUD STORAGE CONFIG ============
let storage;
let bucket;

try {
  // Try to initialize with service account key
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    storage = new Storage({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: 'open-skill-nepal-478611'
    });
    console.log('✅ Google Cloud Storage initialized with service account');
  } else {
    // Try default initialization (for Cloud Run)
    storage = new Storage();
    console.log('✅ Google Cloud Storage initialized with default credentials');
  }
  
  // Use our bucket name
  bucket = storage.bucket('open-skill-nepal-videos');
  console.log(`✅ Using bucket: open-skill-nepal-videos`);
  
} catch (error) {
  console.error('❌ Failed to initialize Google Cloud Storage:', error.message);
  console.log('⚠️ Video uploads will not work. Please set GOOGLE_APPLICATION_CREDENTIALS');
}

// ============ NEW ENDPOINTS FOR PHASE 2 ============

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
      currentTime: currentTime.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    .populate('assignedSchools', 'name')
    .sort({ scheduledFor: 1 })
    .limit(20);

    res.json({
      success: true,
      upcomingVideos,
      count: upcomingVideos.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/videos/:id/status - Update video status (for cron scheduler)
router.put('/:id/status', async (req, res) => {
  try {
    const Video = require('../models/Video');
    const { status } = req.body;
    
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    video.status = status;
    await video.save();

    res.json({
      success: true,
      message: `Video status updated to ${status}`,
      video: {
        id: video._id,
        title: video.title,
        status: video.status,
        scheduledFor: video.scheduledFor
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ENHANCE EXISTING UPLOAD ENDPOINT ============

// Teacher: Upload and schedule video - ENHANCED VERSION
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

    // Check if storage is initialized
    if (!bucket) {
      return res.status(500).json({ 
        message: 'Video storage not configured',
        details: 'Google Cloud Storage is not initialized. Please check service account credentials.'
      });
    }

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
      console.error('❌ GCS Upload Error:', err);
      res.status(500).json({ message: 'Video upload failed', error: err.message });
    });

    blobStream.on('finish', async () => {
      try {
        const fileUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        
        // Make the file publicly accessible
        await blob.makePublic();
        console.log('✅ Video uploaded to:', fileUrl);

        // Determine initial status
        const scheduledTime = new Date(scheduledFor);
        const currentTime = new Date();
        let initialStatus = 'scheduled';
        
        if (scheduledTime <= currentTime) {
          initialStatus = 'published';
        }

        const video = new Video({
          title,
          description,
          filename: req.file.originalname,
          fileUrl,
          fileSize: req.file.size,
          teacher: req.user._id,
          scheduledFor: scheduledTime,
          assignedSchools: schools,
          subjects: JSON.parse(subjects || '[]'),
          gradeLevel: gradeLevel || 'all',
          status: initialStatus,
          // New fields for Phase 2
          videoType: 'lecture',
          duration: req.body.duration || 0,
          thumbnailUrl: req.body.thumbnailUrl || '',
          createdAt: new Date()
        });

        await video.save();

        // Populate the response with teacher and school data
        await video.populate('teacher', 'name email');
        await video.populate('assignedSchools', 'name code');

        res.status(201).json({
          success: true,
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

// ============ KEEP ALL YOUR EXISTING ENDPOINTS ============
// (Your existing /my-videos, /school-videos, /student-videos, /:videoId/view remain as-is)

module.exports = router;
