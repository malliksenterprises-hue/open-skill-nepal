const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: [
    'https://openskillnepal.com',
    'https://www.openskillnepal.com',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health checks
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🚀 Open Skill Nepal Backend API',
    version: '2.0.0',
    status: 'operational',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    documentation: '/api/docs'
  });
});

app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  };
  res.status(200).json(healthCheck);
});

app.get('/_ah/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// API documentation
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Open Skill Nepal API - Professional Grade',
    version: '2.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      root: 'GET /',
      health: 'GET /health',
      api_health: 'GET /api/health',
      api_debug: 'GET /api/debug/phase2',
      api_students: 'GET /api/students',
      api_videos: 'GET /api/videos',
      api_schools: 'GET /api/schools',
      api_auth: 'GET /api/auth/status',
      api_dashboard: 'GET /api/dashboard'
    },
    features: [
      'Enterprise Security Headers',
      'Rate Limiting (100 req/15min)',
      'CORS Configuration',
      'GZIP Compression',
      'Structured Error Handling',
      'Comprehensive Health Checks',
      'Graceful Shutdown'
    ]
  });
});

app.get('/api/metrics', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mount API routes with better error handling
console.log('🔄 Loading API routes...');
try {
  const apiRoutes = require('./routes');
  app.use('/api', apiRoutes);
  console.log('✅ API routes mounted successfully');
  
  // Test if routes are actually working
  app.get('/api/test-routes', (req, res) => {
    res.json({
      message: 'API routes are working!',
      timestamp: new Date().toISOString(),
      routesLoaded: true
    });
  });
} catch (error) {
  console.error('❌ API routes loading failed:', error.message);
  console.error('Error stack:', error.stack);
  
  // Provide detailed fallback
  app.use('/api', (req, res) => {
    res.status(503).json({
      error: 'API routes initialization failed',
      message: error.message,
      timestamp: new Date().toISOString(),
      status: 'initializing'
    });
  });
}

// Error handling
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/docs',
      'GET /api/health'
    ]
  });
});

app.use((error, req, res, next) => {
  console.error('🚨 Server Error:', error);
  const errorResponse = {
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    timestamp: new Date().toISOString()
  };
  res.status(500).json(errorResponse);
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('🚀 OPEN SKILL NEPAL BACKEND - PROFESSIONAL GRADE');
  console.log('='.repeat(60));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕒 Started: ${new Date().toISOString()}`);
  console.log(`🔧 Node.js: ${process.version}`);
  console.log(`💻 Health: http://localhost:${PORT}/health`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
  console.log('='.repeat(60));
  console.log('✅ Server ready for production deployment');
});

const gracefulShutdown = (signal) => {
  console.log(`\n🔄 ${signal} received, starting graceful shutdown...`);
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('❌ Forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
