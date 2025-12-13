const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Configurations
const envConfig = require('./src/config/env');
const logger = require('./src/utils/logger');

// Import routes
const classLoginRoutes = require('./src/routes/classLogin.routes');
const deviceRoutes = require('./src/routes/device.routes');
const authRoutes = require('./src/routes/auth.routes');
const liveClassRoutes = require('./src/routes/liveClass.routes');
const schoolRoutes = require('./src/routes/school.routes');
const teacherRoutes = require('./src/routes/teacher.routes');
const studentRoutes = require('./src/routes/student.routes');
const videoRoutes = require('./src/routes/video.routes');
const adminRoutes = require('./src/routes/admin.routes');

// Initialize Express app
const app = express();
const PORT = envConfig.PORT;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://storage.googleapis.com", "https://lh3.googleusercontent.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://apis.google.com"],
      connectSrc: [
        "'self'", 
        "https://api.openskillnepal.com", 
        "wss://*.openskillnepal.com",
        "https://www.googleapis.com"
      ],
      frameSrc: ["'self'", "https://accounts.google.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin && envConfig.IS_DEVELOPMENT) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (envConfig.CORS_ORIGIN.includes('*')) {
      callback(null, true);
    } else if (envConfig.CORS_ORIGIN.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Powered-By'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: envConfig.RATE_LIMIT_WINDOW_MS,
  max: envConfig.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization
app.use(mongoSanitize()); // Against NoSQL injection
app.use(xss()); // Against XSS attacks
app.use(hpp()); // Against parameter pollution

// Compression
app.use(compression());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'anonymous'
    });
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Open Skill Nepal Backend',
    environment: envConfig.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    features: {
      liveClasses: envConfig.FEATURES.LIVE_CLASS_ENABLED,
      deviceLimits: envConfig.FEATURES.DEVICE_LIMIT_ENABLED,
      googleOAuth: envConfig.FEATURES.GOOGLE_OAUTH_ENABLED,
      videoUpload: envConfig.FEATURES.VIDEO_UPLOAD_ENABLED,
      recordedClasses: envConfig.FEATURES.RECORDED_CLASSES_ENABLED
    }
  };
  
  // Check database connection
  if (mongoose.connection.readyState !== 1) {
    healthStatus.status = 'unhealthy';
    healthStatus.database = 'disconnected';
  }
  
  res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/class-login', classLoginRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/live-class', liveClassRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/admin', adminRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Open Skill Nepal API',
    version: '1.0.0',
    documentation: 'https://docs.openskillnepal.com',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
    documentation: 'https://docs.openskillnepal.com/api-reference'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(el => el.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate field value: ${field}. Please use another value.`
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please log in again.'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Your token has expired. Please log in again.'
    });
  }
  
  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message,
    error: envConfig.IS_PRODUCTION ? undefined : err.stack
  });
});

// Database connection
async function connectDatabase() {
  try {
    await mongoose.connect(envConfig.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10
    });
    
    logger.info('MongoDB connected successfully');
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    
    // Start listening
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running in ${envConfig.NODE_ENV} mode on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🌐 Frontend URL: ${envConfig.FRONTEND_URL}`);
      logger.info(`🔗 Backend URL: ${envConfig.BACKEND_URL}`);
      logger.info(`🛡️ CORS allowed origins: ${envConfig.CORS_ORIGIN.join(', ')}`);
      logger.info(`👥 Roles enabled: Super Admin, Admin, Teacher, School Admin, Class Login, Student`);
      logger.info(`📹 Features: ${Object.entries(envConfig.FEATURES).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    });
    
    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Received shutdown signal, closing server...');
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
        
        process.exit(0);
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = app; // For testing
