const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const classLoginSchema = new mongoose.Schema({
  // Basic identification
  loginId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    minlength: 6,
    maxlength: 20
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  
  // School association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  
  // Class association
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  
  // Device management
  maxDevices: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    max: 50
  },
  currentDevices: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Status and metadata
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: null
  },
  
  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null // null means never expires
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

// Hash password before saving
classLoginSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
classLoginSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if login is expired
classLoginSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// Check if device limit is reached
classLoginSchema.methods.isDeviceLimitReached = function() {
  return this.currentDevices >= this.maxDevices;
};

// Static method to find by loginId (case-insensitive)
classLoginSchema.statics.findByLoginId = function(loginId) {
  return this.findOne({ loginId: loginId.toUpperCase() });
};

// Index for performance
classLoginSchema.index({ schoolId: 1, isActive: 1 });
classLoginSchema.index({ classId: 1, isActive: 1 });
classLoginSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
classLoginSchema.index({ createdAt: 1 });

const ClassLogin = mongoose.model('ClassLogin', classLoginSchema);

module.exports = ClassLogin;
