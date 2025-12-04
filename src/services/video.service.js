const logger = require('../utils/logger');
const gcpStorage = require('../config/gcp.config');
const Video = require('../models/video.model');

class VideoService {
  constructor() {
    this.supportedFormats = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    this.maxFileSize = 500 * 1024 * 1024; // 500MB
  }

  async uploadVideo(file, metadata) {
    try {
      // Validate file
      this.validateVideoFile(file);
      
      // Generate unique filename
      const fileName = this.generateFileName(file.originalname);
      
      // Upload to GCP
      const uploadResult = await gcpStorage.uploadVideo(
        file.buffer,
        fileName,
        {
          originalName: file.originalname,
          contentType: file.mimetype,
          size: file.size,
          ...metadata
        }
      );
      
      // Create video record in database
      const video = await Video.create({
        title: metadata.title,
        description: metadata.description,
        category: metadata.category,
        fileName,
        fileUrl: uploadResult.url,
        fileSize: file.size,
        duration: metadata.duration || 0,
        status: 'uploaded',
        scheduledTime: metadata.scheduledTime || null,
        uploadedBy: metadata.userId,
        gcpMetadata: {
          bucket: uploadResult.bucket,
          uploadedAt: uploadResult.uploadedAt
        }
      });
      
      logger.info(`✅ Video uploaded successfully: ${video._id}`);
      return video;
      
    } catch (error) {
      logger.error('Video upload failed:', error);
      throw error;
    }
  }

  async scheduleVideo(videoId, scheduledTime) {
    const video = await Video.findByIdAndUpdate(
      videoId,
      {
        status: 'scheduled',
        scheduledTime,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!video) {
      throw new Error('Video not found');
    }
    
    logger.info(`⏰ Video scheduled: ${videoId} for ${scheduledTime}`);
    return video;
  }

  async getLiveVideos() {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    
    return await Video.find({
      status: 'live',
      scheduledTime: { $lte: now },
      $or: [
        { liveEndTime: { $exists: false } },
        { liveEndTime: { $gt: now } }
      ]
    })
    .populate('uploadedBy', 'name email')
    .sort({ scheduledTime: -1 })
    .limit(20);
  }

  async getUpcomingVideos() {
    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return await Video.find({
      status: 'scheduled',
      scheduledTime: { 
        $gt: now,
        $lte: twentyFourHoursLater
      }
    })
    .populate('uploadedBy', 'name email')
    .sort({ scheduledTime: 1 })
    .limit(50);
  }

  validateVideoFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }
    
    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds ${this.maxFileSize / (1024*1024)}MB limit`);
    }
    
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    if (!this.supportedFormats.includes(fileExtension)) {
      throw new Error(`Unsupported file format. Supported: ${this.supportedFormats.join(', ')}`);
    }
    
    if (!file.mimetype.startsWith('video/')) {
      throw new Error('File is not a video');
    }
  }

  generateFileName(originalName) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop().toLowerCase();
    
    return `video_${timestamp}_${randomString}.${extension}`;
  }
}

module.exports = new VideoService();
