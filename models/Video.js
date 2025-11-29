const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  filename: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  fileSize: {
    type: Number, // in bytes
    default: 0
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subjects: [{
    type: String,
    enum: ['mathematics', 'science', 'english', 'nepali', 'social', 'computer', 'other']
  }],
  gradeLevel: {
    type: String,
    enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'all'],
    default: 'all'
  },
  scheduledFor: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed'],
    default: 'scheduled'
  },
  assignedSchools: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  }],
  viewers: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    watchedAt: {
      type: Date,
      default: Date.now
    },
    durationWatched: {
      type: Number, // in seconds
      default: 0
    },
    completed: {
      type: Boolean,
      default: false
    }
  }],
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for better query performance
videoSchema.index({ teacher: 1 });
videoSchema.index({ assignedSchools: 1 });
videoSchema.index({ status: 1 });
videoSchema.index({ scheduledFor: 1 });
videoSchema.index({ assignedSchools: 1, status: 1 });
videoSchema.index({ teacher: 1, scheduledFor: -1 });

// Static method to get live classes for a school
videoSchema.statics.getLiveClassesForSchool = function(schoolId) {
  const currentTime = new Date();
  const twoHoursAgo = new Date(currentTime.getTime() - 2 * 60 * 60 * 1000);
  
  return this.find({
    assignedSchools: schoolId,
    status: 'live',
    scheduledFor: { $gte: twoHoursAgo }
  }).populate('teacher', 'name avatar');
};

// Static method to get upcoming classes for a school
videoSchema.statics.getUpcomingClassesForSchool = function(schoolId) {
  const currentTime = new Date();
  
  return this.find({
    assignedSchools: schoolId,
    status: 'scheduled',
    scheduledFor: { $gt: currentTime }
  }).populate('teacher', 'name avatar')
    .sort({ scheduledFor: 1 })
    .limit(10);
};

// Instance method to check if student can access
videoSchema.methods.canStudentAccess = function(studentSchool) {
  return this.assignedSchools.includes(studentSchool) && 
         (this.status === 'live' || this.status === 'completed');
};

module.exports = mongoose.model('Video', videoSchema);
