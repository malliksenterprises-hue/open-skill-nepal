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

// Enhanced MongoDB connection with TLS fix
console.log('🔧 Initializing MongoDB connection...');
console.log('📝 MongoDB URI present:', process.env.MONGO_URI ? '✅ Yes' : '❌ No');

if (!process.env.MONGO_URI) {
  console.error('💥 CRITICAL: MONGO_URI environment variable is missing!');
}

// FIXED: MongoDB connection options with TLS handling
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  retryWrites: true,
  w: 'majority',
  // TLS/SSL fixes for MongoDB Atlas
  ssl: true,
  sslValidate: true,
  // Remove tlsAllowInvalidCertificates in production - only for testing
  // tlsAllowInvalidCertificates: false
};

// Enhanced connection event listeners
mongoose.connection.on('connecting', () => {
  console.log('🔄 MongoDB Connecting...');
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB Connected successfully');
  console.log('📊 Database name:', mongoose.connection.db?.databaseName || 'Unknown');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Connection Error:', err.message);
  if (err.name === 'MongoServerSelectionError') {
    console.log('🔧 TLS/SSL Issue Detected - Applying fixes...');
  }
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB Disconnected');
});

// Initialize database connection with retry logic
async function connectDB() {
  try {
    console.log('🚀 Attempting MongoDB connection with TLS fix...');
    
    // Test connection with enhanced options
    await mongoose.connect(process.env.MONGO_URI, mongooseOptions);
    console.log('🎉 MongoDB connection established successfully');
    
    // Initialize sample data
    await initializeSampleData();
    
  } catch (error) {
    console.error('💥 Primary connection failed:', error.message);
    
    // Try alternative connection method
    await tryAlternativeConnection();
  }
}

// Alternative connection method for TLS issues
async function tryAlternativeConnection() {
  try {
    console.log('🔄 Attempting alternative connection method...');
    
    const alternativeOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000,
      // Try different TLS approach
      tls: true,
      tlsAllowInvalidCertificates: false,
      retryWrites: true,
      w: 'majority'
    };
    
    await mongoose.connect(process.env.MONGO_URI, alternativeOptions);
    console.log('✅ Alternative connection successful!');
    
  } catch (secondError) {
    console.error('💥 Alternative connection also failed:', secondError.message);
    console.log('\n🔧 REQUIRED MANUAL STEPS:');
    console.log('1. Go to MongoDB Atlas → Network Access');
    console.log('2. Add IP Address: 0.0.0.0/0 (Allow access from anywhere)');
    console.log('3. Go to Database Access → Verify user has read/write permissions');
    console.log('4. Check if MongoDB cluster is paused');
  }
}

// Initialize sample data
async function initializeSampleData() {
  try {
    const User = require('./models/User');
    const userCount = await User.countDocuments();
    console.log(`👥 Found ${userCount} existing users`);
    
    if (userCount === 0) {
      console.log('📝 No users found, would initialize sample data...');
    }
  } catch (error) {
    console.log('ℹ️ Sample data check skipped:', error.message);
  }
}

// Connect to database
connectDB();

// Routes
app.use('/api/auth', require('./routes/authRoutes'));

// Health check
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
    environment: process.env.NODE_ENV || 'development'
  });
});

// Enhanced debug endpoint
app.get('/api/debug/mongodb', async (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  
  const debugInfo = {
    mongooseState: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbStatus] || 'unknown',
    readyState: dbStatus,
    mongoURIPresent: !!process.env.MONGO_URI,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };
  
  if (dbStatus === 1) {
    try {
      const adminDb = mongoose.connection.db.admin();
      debugInfo.ping = await adminDb.ping();
      debugInfo.userCount = await mongoose.connection.db.collection('users').countDocuments();
    } catch (dbError) {
      debugInfo.dbError = dbError.message;
    }
  }
  
  res.json(debugInfo);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔍 Debug endpoint: /api/debug/mongodb`);
});
