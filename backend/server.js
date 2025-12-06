const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// ============ PHASE 3: WEBRTC & WEBSOCKET IMPORTS ============
const http = require('http');
const { Server } = require('socket.io');
const MediasoupService = require('./services/MediasoupService');
const LiveSessionService = require('./services/LiveSessionService');
const DeviceService = require('./services/DeviceService');
const auth = require('./middleware/auth');

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
      connectSrc: ["'self'", "ws:", "wss:", "https://storage.googleapis.com"], // ADDED WebSocket
      mediaSrc: ["'self'", "https://storage.googleapis.com", "blob:"] // ADDED blob: for WebRTC
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: [
    'https://openskillnepal.com',
    'https://www.openskillnepal.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3000'
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

// ============ CREATE HTTP SERVER FOR WEBSOCKET ============
const server = http.createServer(app);

// ============ INITIALIZE SOCKET.IO ============
const io = new Server(server, {
  cors: {
    origin: [
      'https://openskillnepal.com',
      'https://www.openskillnepal.com',
      'http://localhost:3000',
      'http://localhost:3001'
    ],
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8 // 100MB for file sharing
});

console.log('🔌 WebSocket server initialized');

// ============ INITIALIZE MEDIASOUP (PHASE 3) ============
if (process.env.MEDIASOUP_ENABLED !== 'false') {
  MediasoupService.initialize().then(() => {
    console.log('✅ Mediasoup WebRTC server initialized');
    console.log(`📡 WebRTC ports: ${process.env.MEDIASOUP_MIN_PORT || 40000}-${process.env.MEDIASOUP_MAX_PORT || 40100}`);
  }).catch(err => {
    console.error('❌ Failed to initialize mediasoup:', err);
    console.log('⚠️ Live video streaming will be limited');
  });
}

// ============ SOCKET.IO AUTHENTICATION MIDDLEWARE ============
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = await auth.verifyToken(token);
    socket.user = decoded;
    
    // Verify device fingerprint for school admins (Phase 2 integration)
    if (decoded.role === 'school_admin') {
      const deviceFingerprint = socket.handshake.auth.deviceFingerprint;
      if (!deviceFingerprint) {
        return next(new Error('Device fingerprint required for school admin'));
      }
      
      // Verify device limit (from Phase 2 logic)
      const canProceed = await DeviceService.verifyDeviceAccess(
        decoded.userId,
        deviceFingerprint,
        socket.id
      );
      
      if (!canProceed) {
        return next(new Error('Device limit exceeded'));
      }
    }
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
});

// ============ SOCKET.IO EVENT HANDLERS ============
io.on('connection', (socket) => {
  console.log(`🔗 Socket connected: ${socket.id} - User: ${socket.user.userId} (${socket.user.role})`);
  
  // Handle live class room joining
  socket.on('join-room', async (data, callback) => {
    try {
      const { roomId, sessionId } = data;
      const { userId, role, schoolId } = socket.user;

      // Check if user can access this session
      const canAccess = await LiveSessionService.canAccessSession(sessionId, userId, role, schoolId);
      if (!canAccess) {
        return callback({ 
          success: false, 
          error: 'Access denied to this session',
          code: 'ACCESS_DENIED'
        });
      }

      // Get or create mediasoup room
      let room = MediasoupService.getRoom(roomId);
      if (!room) {
        room = await MediasoupService.createRoom(roomId, sessionId, {
          recording: true
        });
      }

      // Check if room is full (except for teachers)
      if (role !== 'teacher' && room.peers && room.peers.size >= 50) {
        return callback({ 
          success: false, 
          error: 'Room is full',
          code: 'ROOM_FULL'
        });
      }

      // Add peer to room
      const peer = {
        id: userId,
        socketId: socket.id,
        role,
        joinedAt: new Date()
      };
      
      if (!room.peers) room.peers = new Map();
      room.peers.set(userId, peer);

      // Join socket room
      await socket.join(roomId);
      socket.roomId = roomId;
      socket.sessionId = sessionId;

      // Add to session participants in database
      await LiveSessionService.addParticipant(
        sessionId,
        userId,
        role,
        socket.handshake.auth.deviceFingerprint || 'unknown'
      );

      // Notify others in room
      socket.to(roomId).emit('peer-joined', {
        peerId: userId,
        role,
        timestamp: new Date()
      });

      // Get existing producers
      const producers = room.producers ? Array.from(room.producers.keys()) : [];

      // Get other peers
      const peers = Array.from(room.peers.values())
        .filter(p => p.id !== userId)
        .map(p => ({
          id: p.id,
          role: p.role
        }));

      callback({
        success: true,
        data: {
          roomId,
          peers,
          producers,
          routerRtpCapabilities: room.router.rtpCapabilities
        }
      });

      console.log(`👤 User ${userId} (${role}) joined room ${roomId}`);

    } catch (error) {
      console.error('Error joining room:', error);
      callback({ 
        success: false, 
        error: error.message,
        code: 'JOIN_ERROR'
      });
    }
  });

  // Handle WebRTC transport creation
  socket.on('create-transport', async (data, callback) => {
    try {
      const { roomId, direction } = data;
      const transport = await MediasoupService.createWebRtcTransport(roomId, direction);
      callback({ success: true, transport });
    } catch (error) {
      console.error('Error creating transport:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Handle chat messages
  socket.on('send-message', async (data) => {
    try {
      const { sessionId, message, messageType = 'text' } = data;
      const { userId, role, name } = socket.user;

      const chatMessage = await LiveSessionService.addChatMessage(
        sessionId,
        userId,
        role,
        name,
        message,
        messageType
      );

      // Broadcast to room
      io.to(socket.roomId).emit('new-message', chatMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message-error', {
        message: 'Failed to send message',
        error: error.message
      });
    }
  });

  // Handle raise hand
  socket.on('raise-hand', async (data) => {
    try {
      const { sessionId } = data;
      const { userId, role } = socket.user;

      if (role !== 'school_admin') {
        socket.emit('error', { 
          message: 'Only school admins can raise hand',
          code: 'PERMISSION_DENIED'
        });
        return;
      }

      await LiveSessionService.raiseHand(sessionId, userId);

      // Notify teacher in the room
      const room = io.sockets.adapter.rooms.get(socket.roomId);
      if (room) {
        for (const socketId of room) {
          const peerSocket = io.sockets.sockets.get(socketId);
          if (peerSocket?.user?.role === 'teacher') {
            peerSocket.emit('hand-raised', {
              userId,
              timestamp: new Date()
            });
          }
        }
      }

      // Broadcast to room
      io.to(socket.roomId).emit('hand-status-changed', {
        userId,
        handRaised: true,
        timestamp: new Date()
      });

      console.log(`✋ Hand raised by user ${userId} in room ${socket.roomId}`);

    } catch (error) {
      console.error('Error raising hand:', error);
      socket.emit('error', {
        message: 'Failed to raise hand',
        error: error.message
      });
    }
  });

  // Handle toggle mute (teacher only)
  socket.on('toggle-mute', async (data) => {
    try {
      const { targetUserId, mute } = data;
      const { userId, role } = socket.user;

      if (role !== 'teacher') {
        socket.emit('error', { 
          message: 'Only teachers can mute participants',
          code: 'PERMISSION_DENIED'
        });
        return;
      }

      await LiveSessionService.toggleMuteParticipant(
        socket.sessionId,
        targetUserId,
        mute
      );

      // Notify target user
      const targetSocket = findSocketByUserId(targetUserId);
      if (targetSocket) {
        targetSocket.emit('mute-status-changed', {
          muted: mute,
          byTeacher: userId,
          timestamp: new Date()
        });
      }

      // Broadcast to room
      io.to(socket.roomId).emit('participant-muted', {
        userId: targetUserId,
        muted: mute,
        byTeacher: userId,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error toggling mute:', error);
      socket.emit('error', {
        message: 'Failed to toggle mute',
        error: error.message
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      const { roomId, sessionId } = socket;
      const { userId } = socket.user;

      if (roomId && sessionId && userId) {
        // Remove from session participants
        await LiveSessionService.leaveSession(sessionId, userId);

        // Remove from mediasoup room
        const room = MediasoupService.getRoom(roomId);
        if (room && room.peers) {
          room.peers.delete(userId);
        }

        // Notify others
        socket.to(roomId).emit('peer-left', {
          peerId: userId,
          timestamp: new Date()
        });

        console.log(`👋 User ${userId} left room ${roomId}`);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });

  // Handle ping/pong for connection monitoring
  socket.on('ping', (data, callback) => {
    if (callback) callback({ timestamp: Date.now() });
  });

  // Error handling
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Helper function to find socket by user ID
function findSocketByUserId(userId) {
  const sockets = io.sockets.sockets;
  for (const socket of sockets.values()) {
    if (socket.user?.userId === userId) {
      return socket;
    }
  }
  return null;
}

// ============ HEALTH CHECKS ============
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🚀 Open Skill Nepal Backend API - PHASE 3 LIVE CLASSES',
    version: '3.0.0',
    status: 'operational',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    features: {
      videoUpload: true,
      videoScheduling: true,
      liveClasses: true,
      studentVerification: true,
      webRTC: true,
      webSocket: true
    },
    connections: {
      webSocket: io.engine.clientsCount,
      mediasoup: MediasoupService.workers ? MediasoupService.workers.length : 0
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
      googleCloudStorage: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      webRTC: !!process.env.MEDIASOUP_ENABLED,
      webSocket: true
    },
    connections: {
      webSocket: io.engine.clientsCount,
      mediasoupWorkers: MediasoupService.workers ? MediasoupService.workers.length : 0
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
console.log('📁 Loading route modules...');

try {
  // Import route modules
  const authRoutes = require('./routes/authRoutes');
  const studentRoutes = require('./routes/studentRoutes');
  const schoolRoutes = require('./routes/schoolRoutes');
  const dashboardRoutes = require('./routes/dashboardRoutes');
  const videoRoutes = require('./routes/videoRoutes');
  const liveSessionRoutes = require('./routes/liveSessionRoutes'); // PHASE 3
  
  // Use route modules
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/videos', videoRoutes);
  app.use('/api/live-sessions', liveSessionRoutes); // PHASE 3
  
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

// ============ TEST ENDPOINT FOR LIVE CLASS SYSTEM ============
app.get('/api/test-live-class-system', (req, res) => {
  res.status(200).json({
    message: '✅ LIVE CLASS SYSTEM TEST',
    timestamp: new Date().toISOString(),
    status: 'testing',
    liveClassSystem: {
      webSocket: 'active',
      mediasoup: MediasoupService.workers ? 'active' : 'inactive',
      storage: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'configured' : 'not configured',
      endpoints: [
        'POST /api/live-sessions',
        'GET /api/live-sessions/school/active',
        'POST /api/live-sessions/:id/start',
        'POST /api/live-sessions/:id/end',
        'GET /api/live-sessions/:id/check-access'
      ],
      webSocketEvents: [
        'join-room',
        'create-transport',
        'send-message',
        'raise-hand',
        'toggle-mute'
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
      'GET /api/test-live-class-system',
      'POST /api/videos/upload',
      'GET /api/videos/live-now',
      'GET /api/videos/upcoming',
      'GET /api/videos/recorded',
      'POST /api/live-sessions',
      'GET /api/live-sessions/school/active',
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
server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(70));
  console.log('🚀 OPEN SKILL NEPAL - PHASE 3 LIVE CLASSES');
  console.log('='.repeat(70));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕒 Started: ${new Date().toISOString()}`);
  console.log(`⏰ Video Scheduler: ${process.env.NODE_ENV !== 'test' ? 'ACTIVE' : 'DISABLED'}`);
  console.log(`🔌 WebSocket Server: ACTIVE (${io.engine.clientsCount} connections)`);
  console.log(`📡 WebRTC Server: ${MediasoupService.workers ? 'ACTIVE' : 'INACTIVE'}`);
  console.log(`☁️  Google Cloud Storage: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log('='.repeat(70));
  console.log('🎯 PHASE 3 LIVE CLASS ENDPOINTS:');
  console.log(`   POST http://localhost:${PORT}/api/live-sessions`);
  console.log(`   GET  http://localhost:${PORT}/api/live-sessions/school/active`);
  console.log(`   POST http://localhost:${PORT}/api/live-sessions/:id/start`);
  console.log(`   POST http://localhost:${PORT}/api/live-sessions/:id/end`);
  console.log(`   GET  http://localhost:${PORT}/api/live-sessions/:id/check-access`);
  console.log('='.repeat(70));
  console.log('🎯 PHASE 2 VIDEO ENDPOINTS:');
  console.log(`   POST http://localhost:${PORT}/api/videos/upload`);
  console.log(`   GET  http://localhost:${PORT}/api/videos/live-now`);
  console.log(`   GET  http://localhost:${PORT}/api/videos/upcoming`);
  console.log(`   GET  http://localhost:${PORT}/api/videos/recorded`);
  console.log(`   GET  http://localhost:${PORT}/api/test-video-system`);
  console.log('='.repeat(70));
  console.log('🔌 WEBSOCKET CONNECTION:');
  console.log(`   ws://localhost:${PORT}`);
  console.log(`   Events: join-room, create-transport, send-message, raise-hand`);
  console.log('='.repeat(70));
});

// ============ GRACEFUL SHUTDOWN ============
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 ${signal} received, starting graceful shutdown...`);
  
  // Close all WebSocket connections
  io.close(() => {
    console.log('✅ WebSocket server closed');
  });
  
  // Close HTTP server
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

module.exports = { app, server, io };
