const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Critical: Get port from environment (Cloud Run sets this)
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ CLOUD RUN HEALTH CHECK - This is what Google checks
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Open Skill Nepal Backend - DEPLOYED & WORKING',
    version: '2.0.0',
    phase: 2,
    timestamp: new Date().toISOString(),
    status: 'operational',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ✅ ENHANCED HEALTH CHECK for Cloud Run
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Open Skill Nepal Backend',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// ✅ GOOGLE CLOUD RUN SPECIFIC HEALTH CHECK
app.get('/_ah/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ✅ MOUNT API ROUTES WITH ERROR HANDLING
try {
  const apiRoutes = require('./routes');
  app.use('/api', apiRoutes);
  console.log('✅ API routes mounted successfully');
} catch (error) {
  console.error('❌ API routes loading failed:', error.message);
  // Don't crash - provide fallback
  app.use('/api', (req, res) => {
    res.json({ 
      message: 'API routes loading - check server logs',
      timestamp: new Date().toISOString()
    });
  });
}

// ✅ 404 HANDLER
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    availableEndpoints: [
      'GET /',
      'GET /health', 
      'GET /_ah/health',
      'GET /api/health',
      'GET /api/debug/phase2'
    ],
    timestamp: new Date().toISOString()
  });
});

// ✅ ERROR HANDLER
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// ✅ START SERVER - CRITICAL FOR CLOUD RUN
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('🚀 Open Skill Nepal Backend - CLOUD RUN DEPLOYMENT');
  console.log('='.repeat(50));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log(`💻 Health: http://0.0.0.0:${PORT}/health`);
  console.log(`🔧 API Base: http://0.0.0.0:${PORT}/api`);
  console.log('='.repeat(50));
  
  // Immediate health check log
  console.log('✅ Server started successfully - Ready for Cloud Run health checks');
});

// ✅ GRACEFUL SHUTDOWN for Cloud Run
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received - Shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated gracefully');
    process.exit(0);
  });
});

// ✅ HANDLE UNCAUGHT EXCEPTIONS
process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
