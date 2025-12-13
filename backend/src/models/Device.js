const mongoose = require('mongoose');
const crypto = require('crypto');

const deviceSchema = new mongoose.Schema({
  // Device identifier (IP + user agent hash)
  deviceHash: {
    type: String,
    required: true,
    index: true
  },
  
  // Class Login association
  classLoginId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassLogin',
    required: true,
    index: true
  },
  
  // Device information
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    required: true
  },
  browser: {
    type: String,
    default: ''
  },
  os: {
    type: String,
    default: ''
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  
  // Session information
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  lastActive: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Metadata
  firstSeen: {
    type: Date,
    default: Date.now
  },
  location: {
    country: String,
    region: String,
    city: String
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Generate device hash from IP and user agent
deviceSchema.statics.generateDeviceHash = function(ipAddress, userAgent) {
  const hash = crypto.createHash('sha256');
  hash.update(`${ipAddress}:${userAgent}`);
  return hash.digest('hex');
};

// Generate session ID
deviceSchema.statics.generateSessionId = function() {
  return crypto.randomBytes(32).toString('hex');
};

// Check if device is stale (inactive for 24 hours)
deviceSchema.methods.isStale = function() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.lastActive < twentyFourHoursAgo;
};

// Update last active timestamp
deviceSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

// Static method to find active devices for a class login
deviceSchema.statics.findActiveByClassLogin = function(classLoginId) {
  return this.find({
    classLoginId: classLoginId,
    isActive: true,
    lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });
};

// Static method to count active devices for a class login
deviceSchema.statics.countActiveByClassLogin = function(classLoginId) {
  return this.countDocuments({
    classLoginId: classLoginId,
    isActive: true,
    lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });
};

// Index for performance
deviceSchema.index({ classLoginId: 1, deviceHash: 1 }, { unique: true });
deviceSchema.index({ lastActive: 1 });
deviceSchema.index({ createdAt: 1 });
deviceSchema.index({ ipAddress: 1, classLoginId: 1 });

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
