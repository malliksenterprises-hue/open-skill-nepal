const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ============ VIDEO SCHEDULER INITIALIZATION ============
// Add this at the VERY TOP, right after imports
if (process.env.NODE_ENV !== 'test') {
  try {
    require('./cron/videoScheduler');
    console.log('⏰ Video scheduler initialized');
  } catch (error) {
    console.warn('⚠️ Video scheduler could not be initialized:', error.message);
    console.log('📝 Video status updates will not work automatically');
  }
}

// ============ SECURITY MIDDLEWARE ============
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'", "https://storage.googleapis.com"] // ADD THIS for video streaming
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: [
    'https://openskillnepal.com',
    'https://www.openskillnepal.com',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Upload-Content-Type', 'X-Upload-Content-Length']
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
app.use(express.json({ limit: '50mb' })); // INCREASED for video uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============ HEALTH CHECKS ============
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🚀 Open Skill Nepal Backend API - PHASE 2 VIDEO SYSTEM',
    version: '2.1.0',
    status: 'operational',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    features: {
      videoUpload: true,
      videoScheduling: true,
      liveClasses: true,
      studentVerification: true
    }
  });
});

app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    features: {
      videoScheduler: true,
      googleCloudStorage: !!process.env.GOOGLE_APPLICATION_CREDENTIALS
    }
  };
  res.status(200).json(healthCheck);
});

app.get('/_ah/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ============ IMPORT ROUTES ============
// We'll use actual route files now instead of hardcoded responses
console.log('📁 Loading route modules...');

try {
  // Import route modules
  const authRoutes = require('./routes/authRoutes');
  const studentRoutes = require('./routes/studentRoutes');
  const schoolRoutes = require('./routes/schoolRoutes');
  const dashboardRoutes = require('./routes/dashboardRoutes');
  const videoRoutes = require('./routes/videoRoutes'); // NEW
  
  // Use route modules
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/videos', videoRoutes); // NEW
  
  console.log('✅ All route modules loaded successfully');
} catch (error) {
  console.error('❌ Failed to load route modules:', error.message);
  console.log('📝 Using fallback routes instead');
  
  // Fallback routes if module loading fails
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'API health check',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/videos', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Videos endpoint - Module loading failed, using fallback',
      data: {
        videos: [],
        total: 0
      },
      timestamp: new Date().toISOString()
    });
  });
}

// ============ FALLBACK ROUTES (For backward compatibility) ============
// These will only work if the module routes fail

app.get('/api/students/fallback', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Students endpoint - GET all students (fallback)',
    data: {
      students: [
        { id: 1, name: 'Student One', grade: '10', school: 'School A' },
        { id: 2, name: 'Student Two', grade: '11', school: 'School B' }
      ],
      total: 2,
      page: 1,
      limit: 10
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/schools/fallback', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Schools endpoint - GET all schools (fallback)',
    data: {
      schools: [
        {
          id: 1,
          name: 'Kathmandu Model School',
          address: 'Kathmandu, Nepal',
          students: 500,
          teachers: 25
        },
        {
          id: 2,
          name: 'Pokhara High School', 
          address: 'Pokhara, Nepal',
          students: 350,
          teachers: 18
        }
      ],
      total: 2
    },
    timestamp: new Date().toISOString()
  });
});

// ============ TEST ENDPOINT FOR VIDEO SYSTEM ============
app.get('/api/test-video-system', (req, res) => {
  res.status(200).json({
    message: '✅ VIDEO SYSTEM TEST',
    timestamp: new Date().toISOString(),
    status: 'testing',
    videoSystem: {
      scheduler: 'active',
      storage: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'configured' : 'not configured',
      bucket: 'open-skill-nepal-videos',
      endpoints: [
        'POST /api/videos/upload',
        'GET /api/videos/live-now',
        'GET /api/videos/upcoming',
        'GET /api/videos/recorded',
        'GET /api/videos/my-videos',
        'GET /api/videos/school-videos',
        'GET /api/videos/student-videos'
      ]
    }
  });
});

// ============ ERROR HANDLING ============
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/health',
      'GET /api/test-video-system',
      'POST /api/videos/upload',
      'GET /api/videos/live-now',
      'GET /api/videos/upcoming',
      'GET /api/videos/recorded',
      'GET /api/students/fallback',
      'GET /api/schools/fallback'
    ]
  });
});

app.use((error, req, res, next) => {
  console.error('🚨 Server Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// ============ SERVER STARTUP ============
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('🚀 OPEN SKILL NEPAL - PHASE 2 VIDEO SYSTEM');
  console.log('='.repeat(60));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕒 Started: ${new Date().toISOString()}`);
  console.log(`⏰ Video Scheduler: ${process.env.NODE_ENV !== 'test' ? 'ACTIVE' : 'DISABLED'}`);
  console.log(`☁️  Google Cloud Storage: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log('='.repeat(60));
  console.log('🎯 PHASE 2 VIDEO ENDPOINTS:');
  console.log(`   POST http://localhost:${PORT}/api/videos/upload`);
  console.log(`   GET  http://localhost:${PORT}/api/videos/live-now`);
  console.log(`   GET  http://localhost:${PORT}/api/videos/upcoming`);
  console.log(`   GET  http://localhost:${PORT}/api/videos/recorded`);
  console.log(`   GET  http://localhost:${PORT}/api/test-video-system`);
  console.log('='.repeat(60));
});

// ============ GRACEFUL SHUTDOWN ============
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 ${signal} received, starting graceful shutdown...`);
  server.close(() => {
    console.log('✅ HTTP server closed');
    // Stop video scheduler if needed
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
