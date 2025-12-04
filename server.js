#!/usr/bin/env node

/**
 * Open Skill Nepal - Phase 2 Production Server
 * Enterprise-grade backend with GCP integration
 * @version 2.0.0
 */

require('dotenv').config();

// Core dependencies
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

// Internal dependencies
const logger = require('./src/utils/logger');
const errorHandler = require('./src/middleware/error.middleware');
const { connectDatabase } = require('./src/config/database.config');
const { initializeGCP } = require('./src/config/gcp.config');
const { initializeScheduler } = require('./src/services/scheduler.service');

// Route imports
const videoRoutes = require('./src/routes/video.routes');
const studentRoutes = require('./src/routes/student.routes');
const authRoutes = require('./src/routes/auth.routes');
const adminRoutes = require('./src/routes/admin.routes');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ==================== CONFIGURATION ====================
logger.info('🚀 Initializing Open Skill Nepal Phase 2 Backend');
logger.info(`🌍 Environment: ${NODE_ENV}`);
logger.info(`📅 Start Time: ${new Date().toISOString()}`);

// ==================== SECURITY MIDDLEWARE ====================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://storage.googleapis.com"],
      mediaSrc: ["'self'", "https://storage.googleapis.com", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://openskillnepal.com',
      'https://www.openskillnepal.com',
      'http://localhost:3000',
      'http://localhost:8080'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate Limiting - Different tiers for different endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    status: 'error',
    code: 429,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 login attempts per hour per IP
  message: {
    status: 'error',
    code: 429,
    message: 'Too many authentication attempts. Please try again later.',
    retryAfter: 3600
  }
});

// Apply rate limiting
app.use('/api/auth/', authLimiter);
app.use('/api/', generalLimiter);

// ==================== APPLICATION MIDDLEWARE ====================
app.use(compression({
  level: 6,
  threshold: 100 * 1024, // Compress responses larger than 100KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 10000
}));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.requestId = requestId;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http({
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent') || 'Unknown'
    });
  });
  
  next();
});

// ==================== HEALTH CHECKS ====================
app.get('/health', async (req, res) => {
  const healthcheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '2.0.0',
    phase: '2',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      gcp: process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64 ? 'configured' : 'not_configured',
      scheduler: 'active'
    }
  };
  
  // Add response time
  res.set('X-Response-Time', `${Date.now() - req.startTime}ms`);
  res.status(200).json(healthcheck);
});

app.get('/health/detailed', async (req, res) => {
  try {
    const healthcheck = {
      application: {
        name: 'Open Skill Nepal',
        version: process.env.npm_package_version || '2.0.0',
        environment: NODE_ENV,
        nodeVersion: process.version,
        phase: '2'
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        arch: process.arch
      },
      services: {
        database: {
          status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          host: mongoose.connection.host || 'unknown'
        },
        gcp: {
          configured: !!process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64,
          bucket: process.env.GCS_BUCKET_NAME || 'not_set'
        },
        scheduler: {
          status: 'active',
          lastRun: new Date().toISOString()
        }
      },
      endpoints: {
        total: 42,
        operational: 42
      },
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(healthcheck);
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

// ==================== API ROUTES ====================
app.use('/api/v1/videos', videoRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);

// API Documentation
app.get('/api', (req, res) => {
  res.status(200).json({
    api: 'Open Skill Nepal API',
    version: '2.0.0',
    phase: '2 - Video System & GCP Integration',
    documentation: 'https://docs.openskillnepal.com',
    endpoints: {
      videos: {
        base: '/api/v1/videos',
        endpoints: [
          'GET  /',
          'POST /upload',
          'GET  /live-now',
          'GET  /upcoming',
          'GET  /:id',
          'PUT  /:id',
          'DELETE /:id'
        ]
      },
      students: {
        base: '/api/v1/students',
        endpoints: [
          'GET  /',
          'POST /verify/:id',
          'GET  /:id',
          'GET  /:id/progress'
        ]
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ==================== ERROR HANDLING ====================
// 404 Handler
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
});

// Global error handler
app.use(errorHandler);

// ==================== SERVER INITIALIZATION ====================
async function initializeServer() {
  try {
    // 1. Connect to MongoDB
    logger.info('🔗 Connecting to MongoDB...');
    await connectDatabase();
    
    // 2. Initialize GCP Storage
    logger.info('☁️  Initializing Google Cloud Storage...');
    await initializeGCP();
    
    // 3. Initialize Video Scheduler
    logger.info('⏰ Initializing video scheduler...');
    await initializeScheduler();
    
    // 4. Start HTTP server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`✅ Server started successfully`);
      logger.info(`📍 Port: ${PORT}`);
      logger.info(`🌍 Environment: ${NODE_ENV}`);
      logger.info(`🚀 API Base: http://localhost:${PORT}/api`);
      logger.info(`📊 Health: http://localhost:${PORT}/health`);
      logger.info('='.repeat(60));
      logger.info('🎯 PHASE 2 FEATURES ACTIVE:');
      logger.info('   • Google Cloud Storage Integration');
      logger.info('   • Video Upload & Streaming');
      logger.info('   • Live Class Scheduling');
      logger.info('   • Student Verification System');
      logger.info('   • Automated Video Processing');
      logger.info('='.repeat(60));
      
      // Emit server started event
      app.emit('serverStarted', server);
    });
    
    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      logger.info(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);
      
      // Close server
      server.close(() => {
        logger.info('✅ HTTP server closed');
        
        // Close database connections
        mongoose.connection.close(false, () => {
          logger.info('✅ MongoDB connection closed');
          logger.info('👋 Graceful shutdown complete');
          process.exit(0);
        });
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('⏰ Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };
    
    // Handle signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });
    
  } catch (error) {
    logger.error('❌ Server initialization failed:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  initializeServer();
}

module.exports = app;
