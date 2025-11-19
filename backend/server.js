const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware - FIXED CORS
app.use(cors({
  origin: [
    'https://open-skill-nepal-4zc9-git-main-dinesh-mc.vercel.app', // Your actual Vercel URL
    'https://open-skill-nepal-4zc9-aej0wknbi-dinesh-1.vercel.app', // Your other Vercel URL
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

// Database connection with better logging and timeout settings
console.log('🔗 Attempting MongoDB connection...');
console.log('MongoDB URI present:', process.env.MONGO_URI ? '✅ Yes' : '❌ No');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/open-skill-nepal', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000, // 10 second timeout instead of 30
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log('📊 Database name:', mongoose.connection.db.databaseName);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  console.error('🔍 Error name:', err.name);
  console.error('🔍 Error message:', err.message);
  console.error('🔍 Error code:', err.code);
});

// Add MongoDB connection event listeners
mongoose.connection.on('error', err => {
  console.error('❌ MongoDB connection error event:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected event fired');
});

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

// Basic route for health check
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
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    message: 'API route not found',
    path: req.originalUrl 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Error stack:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 Open Skill Nepal Backend Ready!`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
