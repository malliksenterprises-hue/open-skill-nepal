const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  deviceFingerprint: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ['web', 'mobile', 'desktop'],
    default: 'web'
  },
  browser: {
    name: String,
    version: String
  },
  os: {
    name: String,
    version: String
  },
  ipAddress: String,
  isActive: {
    type: Boolean,
    default: true
  },
  // NEW FIELDS FOR PHASE 3
  sessionCount: {
    type: Number,
    default: 0
  },
  lastSessionType: {
    type: String,
    enum: ['live-class', 'meeting', 'recorded', null],
    default: null
  },
  lastSessionAt: {
    type: Date,
    default: null
  },
  removedReason: {
    type: String,
    enum: ['device-limit', 'admin-removed', 'inactive', null],
    default: null
  },
  removedAt: {
    type: Date,
    default: null
  },
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for faster queries
deviceSchema.index({ userId: 1, schoolId: 1, isActive: 1 });
deviceSchema.index({ schoolId: 1, lastSessionAt: -1 });
deviceSchema.index({ deviceFingerprint: 1, isActive: 1 });

// Update the updatedAt field on save
deviceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to check if device is within limit
deviceSchema.methods.isWithinSessionLimit = async function(role, school) {
  const limit = school.deviceLimits?.[role] || 
    (role === 'admin' ? 3 : role === 'teacher' ? 5 : 2);
  
  return this.sessionCount <= limit;
};

// Static method to get active devices count for user
deviceSchema.statics.getActiveDevicesCount = async function(userId, schoolId) {
  return this.countDocuments({
    userId,
    schoolId,
    isActive: true,
    removedAt: null
  });
};

// Static method to clean up inactive devices (older than 30 days)
deviceSchema.statics.cleanupInactiveDevices = async function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  return this.updateMany(
    {
      lastSessionAt: { $lt: thirtyDaysAgo },
      isActive: true
    },
    {
      $set: {
        isActive: false,
        removedReason: 'inactive',
        removedAt: Date.now()
      }
    }
  );
};

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
