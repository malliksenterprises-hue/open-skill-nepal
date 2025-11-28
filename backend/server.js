const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(express.json());

// ✅ ROOT ENDPOINT - Critical for Cloud Run
app.get('/', (req, res) => {
  console.log('✅ Root endpoint hit');
  res.json({
    message: '🚀 Open Skill Nepal Backend - DEPLOYED & WORKING',
    status: 'operational',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ✅ HEALTH CHECK - Critical for Cloud Run
app.get('/health', (req, res) => {
  console.log('✅ Health check hit');
  res.status(200).json({
    status: 'healthy',
    service: 'Open Skill Nepal Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT
  });
});

// ✅ GOOGLE CLOUD RUN HEALTH CHECK
app.get('/_ah/health', (req, res) => {
  console.log('✅ Google health check hit');
  res.status(200).json({ status: 'healthy' });
});

// ✅ API HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'API',
    timestamp: new Date().toISOString()
  });
});

// ✅ DEBUG ENDPOINT
app.get('/api/debug/phase2', (req, res) => {
  res.json({
    phase: 2,
    status: 'operational',
    deployment: 'successful',
    message: 'Backend deployed to Cloud Run!',
    timestamp: new Date().toISOString()
  });
});

// ✅ 404 HANDLER
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    availableRoutes: [
      'GET /',
      'GET /health',
      'GET /_ah/health',
      'GET /api/health',
      'GET /api/debug/phase2'
    ],
    timestamp: new Date().toISOString()
  });
});

// ✅ START SERVER WITH VERBOSE LOGGING
console.log('='.repeat(50));
console.log('🚀 STARTING OPEN SKILL NEPAL BACKEND');
console.log('='.repeat(50));
console.log('📍 Port:', PORT);
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
console.log('⏰ Starting at:', new Date().toISOString());

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('✅ SERVER SUCCESSFULLY STARTED!');
  console.log('✅ Ready for Cloud Run deployment');
  console.log('📍 Local test: http://localhost:' + PORT + '/health');
  console.log('='.repeat(50));
});

// ✅ GRACEFUL SHUTDOWN
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received - Shutting down gracefully');
  server.close(() => {
    console.log('✅ Server terminated');
    process.exit(0);
  });
});
