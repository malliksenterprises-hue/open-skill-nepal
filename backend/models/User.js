const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define user roles as constants
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  TEACHER: 'teacher',
  SCHOOL_ADMIN: 'school_admin',
  STUDENT: 'student'
};

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    // Password not required for Google OAuth users
    required: function() {
      return !this.googleId; // Only required if not using Google OAuth
    }
  },
  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.STUDENT,
    required: true
  },
  googleId: {
    type: String,
    sparse: true // Allows multiple nulls but unique values
  },
  avatar: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  school: {
    type: String,
    default: ''
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Hash password before saving (only if modified)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
