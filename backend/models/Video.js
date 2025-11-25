const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    enum: ['mathematics', 'science', 'english', 'nepali', 'social', 'computer', 'other']
  },
  grade: {
    type: String,
    required: true,
    enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  },
  teacher: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  school: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true 
  },
  videoUrl: { 
    type: String, 
    required: true 
  },
  thumbnailUrl: { 
    type: String 
  },
  scheduledFor: { 
    type: Date, 
    required: true 
  },
  duration: { 
    type: Number, 
    default: 45 
  },
  status: { 
    type: String, 
    enum: ['scheduled', 'live', 'completed', 'cancelled'], 
    default: 'scheduled' 
  },
  attendees: [{ 
    student: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    joinedAt: { 
      type: Date, 
      default: Date.now 
    },
    duration: { 
      type: Number, 
      default: 0 
    },
    completed: {
      type: Boolean,
      default: false
    }
  }],
  resources: [{
    name: String,
    url: String,
    type: String
  }]
}, { 
  timestamps: true 
});

// Index for efficient queries
videoSchema.index({ school: 1, scheduledFor: 1 });
videoSchema.index({ teacher: 1, status: 1 });
videoSchema.index({ status: 1, scheduledFor: 1 });

// Virtual for checking if class is live
videoSchema.virtual('isLive').get(function() {
  const now = new Date();
  const start = this.scheduledFor;
  const end = new Date(start.getTime() + this.duration * 60000);
  return now >= start && now <= end && this.status === 'scheduled';
});

module.exports = mongoose.model('Video', videoSchema);
