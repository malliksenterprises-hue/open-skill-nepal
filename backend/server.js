const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware - FIXED CORS - UPDATED DOMAINS
app.use(cors({
  origin: [
    'https://open-skill-nepal.vercel.app', // ← ADDED - your current domain
    'https://open-skill-nepal-qsq3idytx-dinesh-malliks-projects.vercel.app', // ← ADDED
    'https://open-skill-nepal-4zc9-git-main-dinesh-mc.vercel.app',
    'https://open-skill-nepal-4zc9-aej0wknbi-dinesh-1.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Enhanced MongoDB connection with better logging
console.log('🔧 Initializing MongoDB connection...');
console.log('📝 MongoDB URI present:', process.env.MONGO_URI ? '✅ Yes' : '❌ No');

if (!process.env.MONGO_URI) {
  console.error('💥 CRITICAL: MONGO_URI environment variable is missing!');
} else {
  // Log safe connection info
  const safeURI = process.env.MONGO_URI.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://$1:********@');
  console.log('🔗 Connection URI:', safeURI);
}

// MongoDB connection options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
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

// Auto-create sample users when connection opens
mongoose.connection.once('open', async () => {
  console.log('🔓 MongoDB connection open - checking for sample data...');
  
  try {
    const User = require('./models/User');
    
    // Check if any users exist
    const userCount = await User.countDocuments();
    console.log(`👥 Found ${userCount} existing users in database`);
    
    if (userCount === 0) {
      console.log('📝 No users found, initializing sample data...');
      
      try {
        const initData = require('./scripts/initData');
        await initData();
        console.log('🎉 Sample data initialization completed!');
      } catch (initError) {
        console.log('⚠️ Init script failed, creating users manually...');
        await createSampleUsersManually();
      }
    } else {
      console.log('✅ Database already has users, skipping initialization');
      
      // Log existing users for reference
      const users = await User.find({}, 'email role name');
      console.log('📋 Existing users:');
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.role}) - ${user.name}`);
      });
    }
  } catch (error) {
    console.log('💥 Error during sample data check:', error.message);
  }
});

// Manual user creation fallback
async function createSampleUsersManually() {
  try {
    const User = require('./models/User');
    
    const sampleUsers = [
      {
        name: 'Super Admin',
        email: 'superadmin@example.com',
        password: 'password',
        role: 'super_admin',
        isActive: true
      },
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password',
        role: 'admin',
        isActive: true
      },
      {
        name: 'Teacher User',
        email: 'teacher@example.com',
        password: 'password',
        role: 'teacher',
        isActive: true
      },
      {
        name: 'School Admin',
        email: 'school@example.com',
        password: 'password',
        role: 'school_admin',
        isActive: true
      },
      {
        name: 'Student User',
        email: 'student@example.com',
        password: 'password',
        role: 'student',
        isActive: true
      }
    ];

    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`✅ Created user: ${user.email} (${user.role})`);
    }

    console.log('🎉 Manual user creation completed!');
    console.log('\n📧 Login credentials:');
    sampleUsers.forEach(user => {
      console.log(`   👤 ${user.email} / password (Role: ${user.role})`);
    });
    
  } catch (error) {
    console.error('❌ Manual user creation failed:', error.message);
  }
}

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

// Connect to database
connectDB();

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));

// Health check with DB status
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  }[dbStatus] || 'unknown';
  
  res.json({ 
    status: dbStatus === 1 ? 'healthy' : 'unhealthy',
    database: dbStatusText,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// MongoDB Debug Endpoint
app.get('/api/debug/mongodb', async (req, res) => {
  try {
    console.log('🔍 Testing MongoDB connection directly...');
    
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
      timestamp: new Date().toISOString()
    };
    
    // Only test database operations if connected
    if (dbStatus === 1) {
      try {
        const adminDb = mongoose.connection.db.admin();
        const pingResult = await adminDb.ping();
        debugInfo.ping = pingResult;
        
        // Test if we can access users collection
        const User = require('./models/User');
        const userCount = await User.countDocuments();
        debugInfo.userCount = userCount;
      } catch (dbError) {
        debugInfo.dbError = dbError.message;
      }
    }
    
    res.json({
      status: dbStatus === 1 ? 'success' : 'error',
      ...debugInfo
    });
    
  } catch (error) {
    console.error('❌ MongoDB Debug Error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      mongooseState: mongoose.connection.readyState,
      timestamp: new Date().toISOString()
    });
  }
});

// Database status endpoint
app.get('/api/debug/db-status', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    mongooseState: states[mongoose.connection.readyState],
    mongooseReadyState: mongoose.connection.readyState,
    mongooseHost: mongoose.connection.host,
    mongooseName: mongoose.connection.name,
    mongoURIPresent: !!process.env.MONGO_URI,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify server is responding
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is responding correctly!',
    timestamp: new Date().toISOString(),
    server: 'Open Skill Nepal Backend',
    status: 'active'
  });
});

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.originalUrl}`);
  res.status(404).json({ 
    message: 'API route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Error stack:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 Open Skill Nepal Backend Ready!`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔍 Debug endpoints available:`);
  console.log(`   - /api/health - Health check`);
  console.log(`   - /api/debug/mongodb - MongoDB connection test`);
  console.log(`   - /api/debug/db-status - Database status`);
  console.log(`   - /api/test - Basic server test`);
  console.log(`\n📊 Auto-initialization: Will create sample users if database is empty`);
});
