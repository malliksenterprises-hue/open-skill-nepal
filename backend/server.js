const express = require('express');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: [
    'https://open-skill-nepal-4zc9-git-main-dinesh-mc.vercel.app',
    'https://open-skill-nepal-4zc9-aej0wknbi-dinesh-1.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Enhanced MongoDB connection with direct testing
console.log('🔧 Initializing MongoDB connection...');

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
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  w: 'majority',
  ssl: true,
  sslValidate: true
};

// Connection events
mongoose.connection.on('connecting', () => {
  console.log('🔄 MongoDB Connecting...');
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB Connected successfully');
  console.log('📊 Database:', mongoose.connection.db?.databaseName);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Connection Error:', err.message);
});

// Connect function with enhanced error handling
async function connectDB() {
  try {
    console.log('🚀 Attempting MongoDB connection...');
    
    // Test connection with mongoose
    await mongoose.connect(process.env.MONGO_URI, mongooseOptions);
    console.log('🎉 MongoDB connection established successfully');
    
  } catch (error) {
    console.error('💥 MongoDB connection failed:', error.message);
    console.log('\n🔧 DIAGNOSIS:');
    console.log('📝 Username mismatch detected!');
    console.log('💡 Solution: Check MongoDB Atlas → Database Access');
    console.log('Expected: malliksenterprises_db_user');
    console.log('Actual: Check what is shown in Atlas');
  }
}

// Connect to database
connectDB();

// Routes
app.use('/api/auth', require('./routes/authRoutes'));

// Enhanced health check
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusText = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbStatus] || 'unknown';
  
  res.json({
    status: dbStatus === 1 ? 'healthy' : 'unhealthy',
    database: statusText,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Direct MongoDB test endpoint
app.get('/api/debug/mongodb-test', async (req, res) => {
  try {
    console.log('🔍 Testing MongoDB connection directly...');
    
    // Test with native MongoDB driver
    const client = new MongoClient(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      ssl: true
    });
    
    await client.connect();
    const pingResult = await client.db('admin').command({ ping: 1 });
    await client.close();
    
    res.json({
      status: 'success',
      message: 'MongoDB connection successful with native driver',
      ping: pingResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Direct MongoDB test failed:', error.message);
    res.status(500).json({
      status: 'error',
      message: error.message,
      suggestion: 'Check username and password in MongoDB Atlas',
      timestamp: new Date().toISOString()
    });
  }
});

// Database info endpoint
app.get('/api/debug/db-info', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusText = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbStatus] || 'unknown';
  
  res.json({
    mongooseState: statusText,
    readyState: dbStatus,
    mongoURIPresent: !!process.env.MONGO_URI,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔍 Debug endpoints:`);
  console.log(`   - /api/health`);
  console.log(`   - /api/debug/mongodb-test`);
  console.log(`   - /api/debug/db-info`);
});
