const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  contact: {
    email: String,
    phone: String,
    website: String
  },
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en'
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY'
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'expired'],
      default: 'active'
    },
    expiresAt: Date,
    features: {
      maxTeachers: { type: Number, default: 10 },
      maxStudents: { type: Number, default: 100 },
      maxClasses: { type: Number, default: 20 },
      storageGB: { type: Number, default: 10 }
    }
  },
  // NEW FIELD: Device limits for different roles
  deviceLimits: {
    admin: {
      type: Number,
      default: 3,
      min: 1,
      max: 10
    },
    teacher: {
      type: Number,
      default: 5,
      min: 1,
      max: 15
    },
    student: {
      type: Number,
      default: 2,
      min: 1,
      max: 5
    },
    parent: {
      type: Number,
      default: 2,
      min: 1,
      max: 5
    }
  },
  // Device management settings
  deviceManagement: {
    allowMultipleSessions: {
      type: Boolean,
      default: false
    },
    sessionTimeout: {
      type: Number,
      default: 30, // minutes
      min: 1,
      max: 240
    },
    notifyOnLimit: {
      type: Boolean,
      default: true
    },
    autoCleanupDays: {
      type: Number,
      default: 30,
      min: 1,
      max: 365
    }
  },
  stats: {
    totalTeachers: { type: Number, default: 0 },
    totalStudents: { type: Number, default: 0 },
    totalClasses: { type: Number, default: 0 },
    activeDevices: { type: Number, default: 0 },
    maxConcurrentSessions: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
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
schoolSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to get device limit for specific role
schoolSchema.methods.getDeviceLimit = function(role) {
  return this.deviceLimits?.[role] || 
    (role === 'admin' ? 3 : 
     role === 'teacher' ? 5 : 
     role === 'student' ? 2 : 2);
};

// Method to check if user can add more devices
schoolSchema.methods.canAddDevice = async function(userId, role) {
  const Device = mongoose.model('Device');
  const activeDevices = await Device.countDocuments({
    userId,
    schoolId: this._id,
    isActive: true,
    removedAt: null
  });
  
  const limit = this.getDeviceLimit(role);
  return activeDevices < limit;
};

// Static method to update school stats
schoolSchema.statics.updateStats = async function(schoolId) {
  const Device = mongoose.model('Device');
  const User = mongoose.model('User');
  const Class = mongoose.model('Class');
  
  const activeDevices = await Device.countDocuments({
    schoolId,
    isActive: true,
    removedAt: null
  });
  
  const totalTeachers = await User.countDocuments({
    schoolId,
    role: 'teacher',
    isActive: true
  });
  
  const totalStudents = await User.countDocuments({
    schoolId,
    role: 'student',
    isActive: true
  });
  
  const totalClasses = await Class.countDocuments({
    schoolId,
    isActive: true
  });
  
  return this.findByIdAndUpdate(
    schoolId,
    {
      $set: {
        'stats.activeDevices': activeDevices,
        'stats.totalTeachers': totalTeachers,
        'stats.totalStudents': totalStudents,
        'stats.totalClasses': totalClasses
      }
    },
    { new: true }
  );
};

const School = mongoose.model('School', schoolSchema);

module.exports = School;
