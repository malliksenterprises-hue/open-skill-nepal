const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Open Skill Nepal Backend - DEPLOYED & WORKING',
    status: 'operational',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Open Skill Nepal Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: PORT
  });
});

// Google Cloud Run health check
app.get('/_ah/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Simple API routes (no external dependencies)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'API',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/debug/phase2', (req, res) => {
  res.json({
    phase: 2,
    status: 'operational',
    deployment: 'successful',
    message: 'Backend deployed to Cloud Run!',
    timestamp: new Date().toISOString()
  });
});

// Start server
console.log('🚀 Starting Open Skill Nepal Backend...');
app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Server successfully started on port:', PORT);
  console.log('✅ Ready for Cloud Run!');
});
