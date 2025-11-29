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

// User status for student verification
const USER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
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
  
  // ===== PHASE 2 ADDITIONS =====
  
  // School reference (for students, teachers, school_admins)
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: function() {
      // Students, teachers, and school_admins must be associated with a school
      return [ROLES.STUDENT, ROLES.TEACHER, ROLES.SCHOOL_ADMIN].includes(this.role);
    }
  },
  
  // Student verification status
  status: {
    type: String,
    enum: Object.values(USER_STATUS),
    default: function() {
      // Students start as pending, others are automatically approved
      return this.role === ROLES.STUDENT ? USER_STATUS.PENDING : USER_STATUS.APPROVED;
    }
  },
  
  // Verification notes from school admin
  verificationNotes: {
    type: String,
    default: ''
  },
  
  // Student/Teacher profile information
  profile: {
    dateOfBirth: Date,
    phone: String,
    address: {
      street: String,
      city: String,
      district: String,
      province: String
    },
    grade: { // For students
      type: String,
      enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    },
    subjects: [{ // For teachers
      type: String,
      enum: ['mathematics', 'science', 'english', 'nepali', 'social', 'computer', 'other']
    }],
    bio: String,
    qualifications: [{
      degree: String,
      institution: String,
      year: Number
    }]
  },
  
  // Account activity tracking
  lastLogin: {
    type: Date
  },
  loginCount: {
    type: Number,
    default: 0
  },
  
  // ===== EXISTING FIELDS =====
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
    default: function() {
      // Students are inactive until approved, others are active by default
      return this.role === ROLES.STUDENT ? false : true;
    }
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

// Method to check if user can login (for student verification)
userSchema.methods.canLogin = function() {
  if (this.role === ROLES.STUDENT) {
    return this.status === USER_STATUS.APPROVED && this.isActive;
  }
  return this.isActive;
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Instance method to get user dashboard data based on role
userSchema.methods.getDashboardData = async function() {
  const School = require('./School');
  const Video = require('./Video');
  
  switch (this.role) {
    case ROLES.STUDENT:
      if (this.status !== USER_STATUS.APPROVED) {
        return { status: 'pending', message: 'Waiting for school admin approval' };
      }
      
      const school = await School.findById(this.school);
      const liveClasses = await Video.countDocuments({
        school: this.school,
        status: 'live'
      });
      
      return {
        role: 'student',
        school: school?.name,
        status: this.status,
        liveClasses,
        canAccess: this.status === USER_STATUS.APPROVED
      };
      
    case ROLES.TEACHER:
      const teacherSchool = await School.findById(this.school);
      const myVideos = await Video.countDocuments({ teacher: this._id });
      
      return {
        role: 'teacher',
        school: teacherSchool?.name,
        totalVideos: myVideos,
        canAccess: true
      };
      
    case ROLES.SCHOOL_ADMIN:
      const adminSchool = await School.findOne({ admin: this._id });
      const pendingStudents = await this.constructor.countDocuments({
        role: ROLES.STUDENT,
        school: adminSchool?._id,
        status: USER_STATUS.PENDING
      });
      
      return {
        role: 'school_admin',
        school: adminSchool?.name,
        pendingStudents,
        canAccess: true
      };
      
    case ROLES.ADMIN:
      const pendingSchools = await School.countDocuments({ status: 'pending' });
      const totalTeachers = await this.constructor.countDocuments({ role: ROLES.TEACHER });
      
      return {
        role: 'admin',
        pendingSchools,
        totalTeachers,
        canAccess: true
      };
      
    case ROLES.SUPER_ADMIN:
      const totalSchools = await School.countDocuments();
      const totalAdmins = await this.constructor.countDocuments({ role: ROLES.ADMIN });
      
      return {
        role: 'super_admin',
        totalSchools,
        totalAdmins,
        canAccess: true
      };
      
    default:
      return { role: this.role, canAccess: false };
  }
};

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ school: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ school: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
module.exports.USER_STATUS = USER_STATUS;
