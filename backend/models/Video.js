const mongoose = require('mongoose');

const viewerSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  durationWatched: {
    type: Number,
    default: 0
  },
  completed: {
    type: Boolean,
    default: false
  },
  watchedAt: {
    type: Date,
    default: Date.now
  }
});

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  filename: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledFor: {
    type: Date,
    required: true
  },
  assignedSchools: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  }],
  subjects: [{
    type: String,
    trim: true
  }],
  gradeLevel: {
    type: String,
    default: 'all',
    enum: ['9', '10', '11', '12', 'college', 'all']
  },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'recorded', 'completed', 'published', 'draft'],
    default: 'scheduled'
  },
  // New Phase 2 fields
  duration: {
    type: Number, // in seconds
    default: 0
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  videoType: {
    type: String,
    enum: ['lecture', 'tutorial', 'demo', 'review', 'qna'],
    default: 'lecture'
  },
  views: {
    type: Number,
    default: 0
  },
  viewers: [viewerSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
videoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static methods
videoSchema.statics.getLiveClassesForSchool = async function(schoolId) {
  const currentTime = new Date();
  return this.find({
    assignedSchools: schoolId,
    status: 'live',
    scheduledFor: { $lte: currentTime }
  })
  .populate('teacher', 'name avatar')
  .sort({ scheduledFor: -1 });
};

videoSchema.statics.getUpcomingClassesForSchool = async function(schoolId) {
  const currentTime = new Date();
  return this.find({
    assignedSchools: schoolId,
    status: 'scheduled',
    scheduledFor: { $gt: currentTime }
  })
  .populate('teacher', 'name avatar')
  .sort({ scheduledFor: 1 });
};

// Indexes for performance
videoSchema.index({ teacher: 1, createdAt: -1 });
videoSchema.index({ assignedSchools: 1, status: 1, scheduledFor: -1 });
videoSchema.index({ status: 1, scheduledFor: 1 });
videoSchema.index({ scheduledFor: 1 });

const Video = mongoose.model('Video', videoSchema);

module.exports = Video;
