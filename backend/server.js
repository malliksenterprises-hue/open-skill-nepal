const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware - FIXED CORS
app.use(cors({
  origin: [
    'https://open-skill-nepal-4zc9-git-main-dinesh-mc.vercel.app',
    'https://open-skill-nepal-4zc9-aej0wknbi-dinesh-1.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Enhanced MongoDB connection with better error handling
console.log('🔧 Initializing MongoDB connection...');
console.log('📝 MongoDB URI present:', process.env.MONGO_URI ? '✅ Yes' : '❌ No');

if (!process.env.MONGO_URI) {
  console.error('💥 CRITICAL: MONGO_URI environment variable is missing!');
}

// MongoDB connection options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  retryWrites: true,
  w: 'majority'
};

// Enhanced connection event listeners with better logging
mongoose.connection.on('connecting', () => {
  console.log('🔄 MongoDB Connecting...');
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB Connected successfully');
  console.log('📊 Database name:', mongoose.connection.db?.databaseName || 'Unknown');
  console.log('🏠 MongoDB Host:', mongoose.connection.host);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Connection Error:', err);
  console.error('🔍 Error name:', err.name);
  console.error('🔍 Error message:', err.message);
  if (err.name === 'MongoServerSelectionError') {
    console.log('🌐 Network Issue Detected - Possible Solutions:');
    console.log('1. Check IP whitelisting in MongoDB Atlas');
    console.log('2. Verify network connectivity from Cloud Run');
    console.log('3. Check if database cluster is running');
  }
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB Disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB Reconnected');
});

// Initialize database connection
async function connectDB() {
  try {
    console.log('🚀 Attempting MongoDB connection...');
    console.log('⏳ Connection timeout set to 10 seconds');
    
    await mongoose.connect(process.env.MONGO_URI, mongooseOptions);
    console.log('🎉 MongoDB connection established successfully');
    
    // Initialize sample data after successful connection
    await initializeSampleData();
    
  } catch (error) {
    console.error('💥 MongoDB connection failed:', error);
    console.log('🔍 Detailed Error Analysis:');
    console.log('- Error Name:', error.name);
    console.log('- Error Message:', error.message);
    console.log('- Error Code:', error.code);
    
    if (error.name === 'MongoServerSelectionError') {
      console.log('🔧 Network/Configuration Issues:');
      console.log('1. Check MongoDB Atlas IP whitelisting (allow 0.0.0.0/0 temporarily)');
      console.log('2. Verify database user permissions in MongoDB Atlas');
      console.log('3. Ensure cluster is not paused');
      console.log('4. Check if MongoDB URI is correct');
    }
    
    // In production, we don't want to exit immediately
    if (process.env.NODE_ENV === 'development') {
      process.exit(1);
    }
  }
}

// Initialize sample data
async function initializeSampleData() {
  try {
    const User = require('./models/User');
    
    // Check if any users exist
    const userCount = await User.countDocuments();
    console.log(`👥 Found ${userCount} existing users in database`);
    
    if (userCount === 0) {
      console.log('📝 No users found, checking for init script...');
      try {
        const initData = require('./scripts/initData');
        await initData();
        console.log('✅ Sample data initialized successfully');
      } catch (initError) {
        console.log('⚠️ Init script not available or failed:', initError.message);
      }
    }
  } catch (error) {
    console.log('ℹ️ Sample data initialization skipped:', error.message);
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

// Enhanced health check with DB status
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  }[dbStatus] || 'unknown';
  
  res.json({ 
    message: 'Open Skill Nepal Backend is running!',
    timestamp: new Date().toISOString(),
    database: dbStatusText,
    mongooseState: mongoose.connection.readyState,
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
      connectionPort: mongoose.connection.port,
      connectionName: mongoose.connection.name,
      mongoURIPresent: !!process.env.MONGO_URI
    };
    
    // Only test database operations if connected
    if (dbStatus === 1) {
      try {
        const adminDb = mongoose.connection.db.admin();
        const pingResult = await adminDb.ping();
        debugInfo.ping = pingResult;
        
        // Test if we can access users collection
        const userCount = await mongoose.connection.db.collection('users').countDocuments();
        debugInfo.userCount = userCount;
        debugInfo.collections = await mongoose.connection.db.listCollections().toArray();
      } catch (dbError) {
        debugInfo.dbError = dbError.message;
      }
    }
    
    res.json({
      status: dbStatus === 1 ? 'success' : 'error',
      ...debugInfo,
      timestamp: new Date().toISOString()
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
    mongoosePort: mongoose.connection.port,
    mongooseName: mongoose.connection.name,
    mongoURIPresent: !!process.env.MONGO_URI,
    environment: process.env.NODE_ENV || 'development'
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
});
