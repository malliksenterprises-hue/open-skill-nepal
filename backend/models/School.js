const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  code: { 
    type: String, 
    unique: true,
    required: true,
    uppercase: true
  },
  address: {
    street: String,
    city: String,
    district: String,
    province: String
  },
  contact: {
    phone: String,
    email: String,
    principalName: String
  },
  admin: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  deviceLimit: { 
    type: Number, 
    default: 100 
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'pending'], 
    default: 'pending' 
  },
  students: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  teachers: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  metadata: {
    establishedYear: Number,
    totalClassrooms: Number,
    studentCapacity: Number
  }
}, { 
  timestamps: true 
});

// Index for faster queries
schoolSchema.index({ name: 1 });
schoolSchema.index({ code: 1 });
schoolSchema.index({ status: 1 });

module.exports = mongoose.model('School', schoolSchema);
