const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// =======================
// ENHANCED CORS CONFIGURATION FOR PHASE 2
// =======================
app.use(cors({
  origin: [
    'https://openskillnepal.com',
    'https://www.openskillnepal.com',
    'https://api.openskillnepal.com',
    'https://open-skill-nepal.vercel.app',
    'https://open-skill-nepal-qsq3idytx-dinesh-malliks-projects.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-CSRF-Token'],
  optionsSuccessStatus: 204
}));

// =======================
// BODY PARSER MIDDLEWARE - ENHANCED FOR VIDEO UPLOADS
// =======================
app.use(express.json({ limit: '100mb' })); // Increased for video metadata
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// =======================
// REQUEST LOGGING MIDDLEWARE - ENHANCED FOR PHASE 2
// =======================
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// =======================
// ROOT ROUTE - ENHANCED FOR PHASE 2
// =======================
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Open Skill Nepal Backend API - Phase 2 Ready',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    phase: '2 - Dashboard & Live Classes',
    features: {
      studentVerification: true,
      videoUpload: true,
      liveClasses: true,
      roleDashboards: true,
      cronJobs: true
    },
    endpoints: {
      auth: '/api/auth/*',
      dashboard: '/api/dashboard/*',
      students: '/api/students/*',
      videos: '/api/videos/*',
      schools: '/api/schools/*',
      health: '/api/health',
      debug: '/api/debug/*'
    },
    documentation: 'https://github.com/malliksenterprises-hue/open-skill-nepal'
  });
});

// =======================
// MONGODB CONNECTION - ENHANCED FOR PHASE 2
// =======================
console.log('🔧 Initializing MongoDB connection for Phase 2...');
console.log('📝 MongoDB URI present:', process.env.MONGO_URI ? '✅ Yes' : '❌ No');

if (!process.env.MONGO_URI) {
  console.error('💥 CRITICAL: MONGO_URI environment variable is missing!');
} else {
  const safeURI = process.env.MONGO_URI.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://$1:********@');
  console.log('🔗 Connection URI:', safeURI);
}

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 25, // Increased for Phase 2 video operations
  retryWrites: true,
  w: 'majority',
  ssl: true,
  sslValidate: true
};

// Connection event listeners
mongoose.connection.on('connecting', () => {
  console.log('🔄 MongoDB Connecting...');
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB Connected successfully');
  console.log('📊 Database name:', mongoose.connection.db?.databaseName || 'Unknown');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Connection Error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB Disconnected');
});

// Auto-create sample data when connection opens
mongoose.connection.once('open', async () => {
  console.log('🔓 MongoDB connection open - checking for Phase 2 sample data...');
  await initializePhase2SampleData();
});

// Initialize database connection
async function connectDB() {
  try {
    console.log('🚀 Attempting MongoDB connection...');
    await mongoose.connect(process.env.MONGO_URI, mongooseOptions);
    console.log('🎉 MongoDB connection established successfully');
  } catch (error) {
    console.error('💥 MongoDB connection failed:', error.message);
  }
}

// =======================
// PHASE 2 SAMPLE DATA INITIALIZATION - ENHANCED WITH VIDEOS
// =======================
async function initializePhase2SampleData() {
  try {
    const User = require('./models/User');
    const School = require('./models/School');
    const Video = require('./models/Video');
    
    const userCount = await User.countDocuments();
    const schoolCount = await School.countDocuments();
    const videoCount = await Video.countDocuments();
    
    console.log(`👥 Found ${userCount} users in database`);
    console.log(`🏫 Found ${schoolCount} schools in database`);
    console.log(`🎥 Found ${videoCount} videos in database`);
    
    if (userCount === 0 || schoolCount === 0) {
      console.log('📝 Initializing Phase 2 sample data...');
      await createPhase2SampleData();
    } else {
      console.log('✅ Database already has data, skipping initialization');
      
      // Log existing schools for reference
      const schools = await School.find({}, 'name code status');
      console.log('📋 Existing schools:');
      schools.forEach(school => {
        console.log(`   - ${school.name} (${school.code}) - ${school.status}`);
      });

      // Initialize cron jobs even if data exists
      initializeCronJobs();
    }
  } catch (error) {
    console.log('💥 Error during Phase 2 sample data check:', error.message);
  }
}

// =======================
// CRON JOBS INITIALIZATION FOR VIDEO STATUS UPDATES
// =======================
function initializeCronJobs() {
  try {
    console.log('⏰ Initializing Phase 2 cron jobs...');
    require('./cron/videoStatusUpdater');
    console.log('✅ Cron jobs initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize cron jobs:', error.message);
  }
}

async function createPhase2SampleData() {
  try {
    const User = require('./models/User');
    const School = require('./models/School');
    const Video = require('./models/Video');
    
    // Create sample schools first
    const schools = [
      {
        name: 'Kathmandu Model Secondary School',
        code: 'KMSS',
        address: {
          street: 'Baneshwor',
          city: 'Kathmandu',
          district: 'Kathmandu',
          province: 'Bagmati'
        },
        contact: {
          phone: '+977-1-4781234',
          email: 'info@kmss.edu.np',
          principalName: 'Dr. Sharma'
        },
        deviceLimit: 200,
        status: 'active'
      },
      {
        name: 'Pokhara Public School',
        code: 'PPS',
        address: {
          street: 'Lakeside',
          city: 'Pokhara',
          district: 'Kaski',
          province: 'Gandaki'
        },
        contact: {
          phone: '+977-61-461234',
          email: 'admin@pps.edu.np',
          principalName: 'Mr. Gurung'
        },
        deviceLimit: 150,
        status: 'active'
      }
    ];

    const createdSchools = [];
    for (const schoolData of schools) {
      const school = new School(schoolData);
      await school.save();
      createdSchools.push(school);
      console.log(`✅ Created school: ${school.name} (${school.code})`);
    }

    // Create sample users with school associations
    const sampleUsers = [
      // Super Admin (no school)
      {
        name: 'Super Admin',
        email: 'superadmin@example.com',
        password: await bcrypt.hash('password', 12),
        role: 'super_admin',
        isActive: true
      },
      // Admin (no school)
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: await bcrypt.hash('password', 12),
        role: 'admin',
        isActive: true
      },
      // School Admin for KMSS
      {
        name: 'KMSS School Admin',
        email: 'schooladmin@kmss.edu.np',
        password: await bcrypt.hash('password', 12),
        role: 'school_admin',
        school: createdSchools[0]._id,
        isActive: true
      },
      // Teacher for KMSS
      {
        name: 'Mathematics Teacher',
        email: 'math.teacher@kmss.edu.np',
        password: await bcrypt.hash('password', 12),
        role: 'teacher',
        school: createdSchools[0]._id,
        isActive: true,
        profile: {
          subjects: ['mathematics'],
          qualifications: [
            { degree: 'M.Ed Mathematics', institution: 'Tribhuvan University', year: 2020 }
          ]
        }
      },
      // Science Teacher for KMSS
      {
        name: 'Science Teacher',
        email: 'science.teacher@kmss.edu.np',
        password: await bcrypt.hash('password', 12),
        role: 'teacher',
        school: createdSchools[0]._id,
        isActive: true,
        profile: {
          subjects: ['science'],
          qualifications: [
            { degree: 'M.Sc Physics', institution: 'Kathmandu University', year: 2019 }
          ]
        }
      },
      // Approved Student for KMSS
      {
        name: 'Approved Student',
        email: 'student.approved@kmss.edu.np',
        password: await bcrypt.hash('password', 12),
        role: 'student',
        school: createdSchools[0]._id,
        status: 'approved',
        isActive: true,
        profile: { grade: '10' }
      },
      // Pending Student for KMSS
      {
        name: 'Pending Student',
        email: 'student.pending@kmss.edu.np',
        password: await bcrypt.hash('password', 12),
        role: 'student',
        school: createdSchools[0]._id,
        status: 'pending',
        isActive: false,
        profile: { grade: '10' }
      }
    ];

    const createdUsers = {};
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      createdUsers[user.role] = user;
      
      // Update school with admin/teacher/student references
      if (user.school) {
        const school = await School.findById(user.school);
        if (user.role === 'school_admin') {
          school.admin = user._id;
        } else if (user.role === 'teacher') {
          school.teachers.push(user._id);
        } else if (user.role === 'student') {
          school.students.push(user._id);
        }
        await school.save();
      }
      
      console.log(`✅ Created user: ${user.email} (${user.role}) - School: ${user.school ? 'Yes' : 'No'}`);
    }

    // Create sample videos for Phase 2 testing
    console.log('🎥 Creating sample videos for Phase 2...');
    
    const sampleVideos = [
      {
        title: 'Introduction to Algebra',
        description: 'Basic concepts of algebraic expressions and equations',
        filename: 'algebra-intro.mp4',
        fileUrl: 'https://storage.googleapis.com/openskillnepal-videos/sample-algebra.mp4',
        teacher: createdUsers.teacher._id,
        subjects: ['mathematics'],
        gradeLevel: '9',
        scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        status: 'scheduled',
        assignedSchools: [createdSchools[0]._id],
        duration: 1800, // 30 minutes
        fileSize: 157286400 // 150MB
      },
      {
        title: 'Physics: Laws of Motion',
        description: 'Understanding Newton\'s laws with practical examples',
        filename: 'physics-motion.mp4',
        fileUrl: 'https://storage.googleapis.com/openskillnepal-videos/sample-physics.mp4',
        teacher: createdUsers.teacher._id,
        subjects: ['science'],
        gradeLevel: '10',
        scheduledFor: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago (should be live)
        status: 'live',
        assignedSchools: [createdSchools[0]._id],
        duration: 2700, // 45 minutes
        fileSize: 209715200 // 200MB
      },
      {
        title: 'Mathematics: Geometry Basics',
        description: 'Fundamental concepts of geometry and shapes',
        filename: 'geometry-basics.mp4',
        fileUrl: 'https://storage.googleapis.com/openskillnepal-videos/sample-geometry.mp4',
        teacher: createdUsers.teacher._id,
        subjects: ['mathematics'],
        gradeLevel: '8',
        scheduledFor: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago (should be completed)
        status: 'completed',
        assignedSchools: [createdSchools[0]._id],
        duration: 2400, // 40 minutes
        fileSize: 188743680 // 180MB
      }
    ];

    for (const videoData of sampleVideos) {
      const video = new Video(videoData);
      await video.save();
      console.log(`✅ Created video: ${video.title} (${video.status})`);
    }

    console.log('🎉 Phase 2 sample data initialization completed!');
    
    // Initialize cron jobs after sample data creation
    initializeCronJobs();

    console.log('\n📧 Phase 2 Test Credentials:');
    console.log('   👑 Super Admin: superadmin@example.com / password');
    console.log('   ⚡ Admin: admin@example.com / password');
    console.log('   🏫 School Admin: schooladmin@kmss.edu.np / password');
    console.log('   👨‍🏫 Teacher: math.teacher@kmss.edu.np / password');
    console.log('   👨‍🏫 Science Teacher: science.teacher@kmss.edu.np / password');
    console.log('   ✅ Approved Student: student.approved@kmss.edu.np / password');
    console.log('   ⏳ Pending Student: student.pending@kmss.edu.np / password');
    
    console.log('\n🎥 Sample Videos Created:');
    console.log('   📹 Introduction to Algebra (Scheduled)');
    console.log('   📹 Physics: Laws of Motion (Live)');
    console.log('   📹 Mathematics: Geometry Basics (Completed)');
    
  } catch (error) {
    console.error('❌ Phase 2 sample data creation failed:', error.message);
  }
}

// Connect to database
connectDB();

// =======================
// ROUTE IMPORTS - PHASE 2 COMPLETE
// =======================
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const studentRoutes = require('./routes/studentRoutes');
const videoRoutes = require('./routes/videoRoutes');
const schoolRoutes = require('./routes/schoolRoutes');

// =======================
// ROUTE MOUNTING - PHASE 2 COMPLETE
// =======================
console.log('🛣️  Mounting Phase 2 routes...');

// Authentication routes
app.use('/api/auth', authRoutes);
console.log('   ✅ Auth routes mounted at /api/auth');

// Dashboard routes (role-based dashboards)
app.use('/api/dashboard', dashboardRoutes);
console.log('   ✅ Dashboard routes mounted at /api/dashboard');

// Student management routes (verification workflow)
app.use('/api/students', studentRoutes);
console.log('   ✅ Student routes mounted at /api/students');

// Video and live class routes
app.use('/api/videos', videoRoutes);
console.log('   ✅ Video routes mounted at /api/videos');

// School management routes
app.use('/api/schools', schoolRoutes);
console.log('   ✅ School routes mounted at /api/schools');

console.log('🎯 All Phase 2 routes mounted successfully!');

// =======================
// ENHANCED HEALTH & DEBUG ROUTES FOR PHASE 2
// =======================
app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  }[dbStatus] || 'unknown';
  
  // Check cron job status
  const cron = require('node-cron');
  const cronStatus = cron.getTasks().size > 0 ? 'active' : 'inactive';
  
  res.json({ 
    status: dbStatus === 1 ? 'healthy' : 'unhealthy',
    database: dbStatusText,
    cronJobs: cronStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    phase: 2,
    features: {
      studentVerification: true,
      liveClasses: true,
      roleDashboards: true,
      schoolManagement: true,
      videoUpload: true,
      cronJobs: true
    }
  });
});

// Enhanced debug endpoint for Phase 2
app.get('/api/debug/phase2', async (req, res) => {
  try {
    const User = require('./models/User');
    const School = require('./models/School');
    const Video = require('./models/Video');
    
    const [userCount, schoolCount, videoCount] = await Promise.all([
      User.countDocuments(),
      School.countDocuments(),
      Video.countDocuments()
    ]);
    
    const userStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    const studentStats = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const videoStats = await Video.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Check cron jobs
    const cron = require('node-cron');
    const cronTasks = Array.from(cron.getTasks()).map(([pattern, task]) => ({
      pattern,
      running: task.getStatus() === 'scheduled'
    }));
    
    res.json({
      phase: 2,
      database: {
        totalUsers: userCount,
        totalSchools: schoolCount,
        totalVideos: videoCount,
        usersByRole: userStats,
        studentsByStatus: studentStats,
        videosByStatus: videoStats
      },
      cronJobs: {
        active: cron.getTasks().size > 0,
        tasks: cronTasks
      },
      routes: {
        auth: '/api/auth/*',
        dashboard: '/api/dashboard/*',
        students: '/api/students/*',
        videos: '/api/videos/*',
        schools: '/api/schools/*'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced MongoDB Debug Endpoint for Phase 2
app.get('/api/debug/mongodb', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    const dbStatusText = {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    }[dbStatus] || 'unknown';
    
    let debugInfo = {
      mongooseState: dbStatusText,
      mongooseReadyState: dbStatus,
      connectionHost: mongoose.connection.host,
      connectionName: mongoose.connection.name,
      mongoURIPresent: !!process.env.MONGO_URI,
      timestamp: new Date().toISOString(),
      phase: 2,
      features: {
        videoSupport: true,
        studentVerification: true,
        liveClasses: true
      }
    };
    
    if (dbStatus === 1) {
      try {
        const adminDb = mongoose.connection.db.admin();
        const pingResult = await adminDb.ping();
        debugInfo.ping = pingResult;
        
        // Test collections
        const User = require('./models/User');
        const School = require('./models/School');
        const Video = require('./models/Video');
        
        debugInfo.collections = {
          users: await User.countDocuments(),
          schools: await School.countDocuments(),
          videos: await Video.countDocuments()
        };

        // Get video status distribution
        debugInfo.videoStatus = await Video.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

      } catch (dbError) {
        debugInfo.dbError = dbError.message;
      }
    }
    
    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =======================
// ERROR HANDLING MIDDLEWARE - ENHANCED FOR PHASE 2
// =======================
app.use('/api/*', (req, res) => {
  console.log(`❌ 404 - API route not found: ${req.originalUrl}`);
  res.status(404).json({ 
    message: 'API route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    phase: 2
  });
});

app.use((err, req, res, next) => {
  console.error('💥 Error stack:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message,
    timestamp: new Date().toISOString(),
    phase: 2
  });
});

// =======================
// SERVER STARTUP - PHASE 2 COMPLETE
// =======================
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📚 Open Skill Nepal Backend - Phase 2 Complete!`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔍 Phase 2 Features Enabled:`);
  console.log(`   ✅ Student Verification Workflow`);
  console.log(`   ✅ Role-based Dashboards`);
  console.log(`   ✅ Video Upload & Live Classes`);
  console.log(`   ✅ School Management`);
  console.log(`   ✅ Cron Jobs for Video Status`);
  console.log(`   ✅ Sample Data with Videos`);
  console.log(`📊 Debug endpoints:`);
  console.log(`   - /api/health - System health`);
  console.log(`   - /api/debug/phase2 - Phase 2 status`);
  console.log(`   - /api/debug/mongodb - Database info`);
  console.log(`\n🎯 Phase 2 Backend Ready! Frontend can now integrate with:`);
  console.log(`   📹 Video upload endpoints`);
  console.log(`   👥 Student verification flows`);
  console.log(`   🎓 Role-based dashboard APIs`);
  console.log(`   ⏰ Live class simulation system`);
});
