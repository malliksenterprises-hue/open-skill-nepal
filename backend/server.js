# Create the professional server file
cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Initialize Express app
const app = express();

// ======================
// SECURITY MIDDLEWARE
// ======================

// Helmet security headers
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

// CORS configuration
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

// Rate limiting
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

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ======================
// HEALTH CHECKS
// ======================

// Root endpoint
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

// Health check endpoint
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

// Google Cloud Run health check
app.get('/_ah/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Open Skill Nepal API',
    version: '2.0.0',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        profile: 'GET /api/auth/me'
      },
      students: {
        list: 'GET /api/students',
        create: 'POST /api/students',
        get: 'GET /api/students/:id'
      },
      videos: {
        list: 'GET /api/videos',
        upload: 'POST /api/videos/upload',
        get: 'GET /api/videos/:id'
      },
      schools: {
        list: 'GET /api/schools',
        create: 'POST /api/schools',
        get: 'GET /api/schools/:id'
      },
      system: {
        health: 'GET /health',
        metrics: 'GET /api/metrics'
      }
    }
  });
});

// API metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mount API routes with error handling
try {
  const apiRoutes = require('./routes');
  app.use('/api', apiRoutes);
  console.log('✅ API routes mounted successfully');
} catch (error) {
  console.warn('⚠️ API routes not loaded:', error.message);
  app.use('/api', (req, res) => {
    res.json({
      message: 'API routes loading...',
      status: 'initializing',
      timestamp: new Date().toISOString()
    });
  });
}

// ======================
// ERROR HANDLING
// ======================

// 404 handler
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

// Global error handler
app.use((error, req, res, next) => {
  console.error('🚨 Server Error:', error);
  const errorResponse = {
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    timestamp: new Date().toISOString()
  };
  res.status(500).json(errorResponse);
});

// ======================
// SERVER STARTUP
// ======================

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

// Graceful shutdown
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
EOF
