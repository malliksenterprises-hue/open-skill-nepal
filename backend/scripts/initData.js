const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const sampleUsers = [
  {
    name: 'Super Admin',
    email: 'superadmin@example.com',
    password: 'password',
    role: 'super_admin'
  },
  {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password',
    role: 'admin'
  },
  {
    name: 'Teacher User',
    email: 'teacher@example.com',
    password: 'password',
    role: 'teacher'
  },
  {
    name: 'School Admin',
    email: 'school@example.com',
    password: 'password',
    role: 'school_admin'
  },
  {
    name: 'Student User',
    email: 'student@example.com',
    password: 'password',
    role: 'student'
  }
];

async function initData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/open-skill-nepal');
    console.log('✅ Connected to MongoDB');

    // Clear existing users (optional - for clean setup)
    await User.deleteMany({});
    console.log('🗑️ Cleared existing users');

    // Create sample users
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`✅ Created user: ${user.email} (${user.role})`);
    }

    console.log('\n🎉 Sample data initialized successfully!');
    console.log('\n📧 You can now login with these credentials:');
    sampleUsers.forEach(user => {
      console.log(`   👤 ${user.email} / password (Role: ${user.role})`);
    });
    
    console.log('\n🚀 Open Skill Nepal is ready for testing!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing data:', error);
    console.error('🔍 Error details:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initData();
}

module.exports = initData;
