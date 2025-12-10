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
const jwt = require('jsonwebtoken');

const app = express();

// ============ VIDEO SCHEDULER INITIALIZATION ============
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
      connectSrc: ["'self'", "ws:", "wss:", "https://storage.googleapis.com"],
      mediaSrc: ["'self'", "https://storage.googleapis.com", "blob:"]
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Upload-Content-Type', 'X-Upload-Content-Length', 'X-Device-Fingerprint']
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
app.use(express.json({ limit: '50mb' }));
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
  maxHttpBufferSize: 1e8
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

// ============ ENHANCED SOCKET.IO AUTHENTICATION MIDDLEWARE WITH DEVICE VALIDATION ============
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                 socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = {
      userId: decoded.userId,
      schoolId: decoded.schoolId,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name
    };

    // Extract device fingerprint from handshake
    const deviceFingerprint = socket.handshake.auth.deviceFingerprint || 
                             socket.handshake.headers['x-device-fingerprint'] ||
                             `socket-${socket.id}`;

    socket.deviceFingerprint = deviceFingerprint;
    socket.connectedAt = new Date();

    // ============ DEVICE VALIDATION FOR ALL USERS (PHASE 3 ENHANCEMENT) ============
    console.log(`🔍 Validating device for user ${socket.user.userId} (${socket.user.role})...`);
    
    const deviceValid = await DeviceService.validateDeviceForSession(
      socket.user.userId,
      socket.user.schoolId,
      deviceFingerprint,
      'live-class'
    );

    if (!deviceValid.valid) {
      console.warn(`⚠️ Device limit exceeded for user ${socket.user.userId}: ${deviceValid.current}/${deviceValid.limit} devices`);
      
      // Send device limit warning before disconnecting
      socket.emit('device-limit-exceeded', {
        limit: deviceValid.limit,
        current: deviceValid.current,
        role: socket.user.role,
        message: `Device limit exceeded. You can only use ${deviceValid.limit} devices as a ${socket.user.role}.`,
        timestamp: new Date().toISOString()
      });

      // Disconnect after short delay to allow client to show message
      setTimeout(() => {
        socket.disconnect(true);
      }, 5000);

      return next(new Error('Device limit exceeded'));
    }

    // Update device session info
    await DeviceService.updateDeviceSessionInfo(
      socket.user.userId,
      socket.user.schoolId,
      deviceFingerprint,
      {
        sessionType: 'live-class',
        socketId: socket.id,
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        connectedAt: socket.connectedAt
      }
    );

    console.log(`✅ Device validated for user ${socket.user.userId}`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    
    if (error.message.includes('Device limit exceeded')) {
      next(error);
    } else {
      next(new Error('Authentication failed'));
    }
  }
});

// ============ ENHANCED SOCKET.IO EVENT HANDLERS WITH DEVICE MANAGEMENT ============
io.on('connection', (socket) => {
  console.log(`🔗 Socket connected: ${socket.id} - User: ${socket.user.userId} (${socket.user.role}) - Device: ${socket.deviceFingerprint}`);
  
  // Join user to their personal room for private messages
  socket.join(`user:${socket.user.userId}`);
  socket.join(`school:${socket.user.schoolId}`);

  // Send connection success with device info
  socket.emit('connected', {
    socketId: socket.id,
    userId: socket.user.userId,
    deviceFingerprint: socket.deviceFingerprint,
    message: 'Successfully connected to WebSocket server',
    timestamp: new Date().toISOString()
  });

  // ============ ENHANCED ROOM JOINING WITH DEVICE TRACKING ============
  socket.on('join-room', async (data, callback) => {
    try {
      const { roomId, sessionId } = data;
      const { userId, role, schoolId } = socket.user;

      console.log(`🎯 User ${userId} attempting to join room ${roomId}, session ${sessionId}`);

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

      // Add peer to room with device info
      const peer = {
        id: userId,
        socketId: socket.id,
        role,
        deviceFingerprint: socket.deviceFingerprint,
        joinedAt: new Date(),
        lastActive: new Date()
      };
      
      if (!room.peers) room.peers = new Map();
      room.peers.set(userId, peer);

      // Join socket room
      await socket.join(roomId);
      socket.roomId = roomId;
      socket.sessionId = sessionId;

      // Add to session participants in database with device info
      await LiveSessionService.addParticipant(
        sessionId,
        userId,
        role,
        socket.deviceFingerprint
      );

      // Update device session info
      await DeviceService.updateDeviceSessionInfo(
        userId,
        schoolId,
        socket.deviceFingerprint,
        {
          sessionType: 'live-class',
          sessionId: sessionId,
          roomId: roomId,
          joinedAt: new Date()
        }
      );

      // Notify others in room
      socket.to(roomId).emit('peer-joined', {
        peerId: userId,
        role,
        deviceFingerprint: socket.deviceFingerprint,
        timestamp: new Date()
      });

      // Get existing producers
      const producers = room.producers ? Array.from(room.producers.keys()) : [];

      // Get other peers
      const peers = Array.from(room.peers.values())
        .filter(p => p.id !== userId)
        .map(p => ({
          id: p.id,
          role: p.role,
          deviceFingerprint: p.deviceFingerprint
        }));

      callback({
        success: true,
        data: {
          roomId,
          peers,
          producers,
          routerRtpCapabilities: room.router.rtpCapabilities,
          deviceInfo: {
            fingerprint: socket.deviceFingerprint,
            validated: true
          }
        }
      });

      console.log(`👤 User ${userId} (${role}) joined room ${roomId} from device ${socket.deviceFingerprint}`);

    } catch (error) {
      console.error('Error joining room:', error);
      callback({ 
        success: false, 
        error: error.message,
        code: 'JOIN_ERROR'
      });
    }
  });

  // ============ WEBRTC TRANSPORT CREATION ============
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

  // ============ ENHANCED CHAT MESSAGES WITH DEVICE INFO ============
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
        messageType,
        socket.deviceFingerprint // Add device fingerprint to chat
      );

      // Broadcast to room with device info
      io.to(socket.roomId).emit('new-message', {
        ...chatMessage,
        deviceFingerprint: socket.deviceFingerprint
      });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message-error', {
        message: 'Failed to send message',
        error: error.message,
        deviceFingerprint: socket.deviceFingerprint
      });
    }
  });

  // ============ RAISE HAND ============
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
              deviceFingerprint: socket.deviceFingerprint,
              timestamp: new Date()
            });
          }
        }
      }

      // Broadcast to room
      io.to(socket.roomId).emit('hand-status-changed', {
        userId,
        handRaised: true,
        deviceFingerprint: socket.deviceFingerprint,
        timestamp: new Date()
      });

      console.log(`✋ Hand raised by user ${userId} (device: ${socket.deviceFingerprint}) in room ${socket.roomId}`);

    } catch (error) {
      console.error('Error raising hand:', error);
      socket.emit('error', {
        message: 'Failed to raise hand',
        error: error.message
      });
    }
  });

  // ============ TOGGLE MUTE (TEACHER ONLY) ============
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

      // Find target socket
      const targetSocket = findSocketByUserId(targetUserId);
      if (targetSocket) {
        targetSocket.emit('mute-status-changed', {
          muted: mute,
          byTeacher: userId,
          byTeacherDevice: socket.deviceFingerprint,
          timestamp: new Date()
        });
      }

      // Broadcast to room
      io.to(socket.roomId).emit('participant-muted', {
        userId: targetUserId,
        muted: mute,
        byTeacher: userId,
        byTeacherDevice: socket.deviceFingerprint,
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

  // ============ DEVICE MANAGEMENT EVENTS ============
  socket.on('get-active-devices', async (data, callback) => {
    try {
      const { userId, schoolId } = socket.user;
      const devices = await DeviceService.getUserActiveDevices(userId, schoolId);
      
      const devicesWithCurrent = devices.map(device => ({
        ...device,
        isCurrentDevice: device.deviceFingerprint === socket.deviceFingerprint
      }));
      
      if (callback) {
        callback({ success: true, devices: devicesWithCurrent });
      }
    } catch (error) {
      console.error('Error getting active devices:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });

  socket.on('logout-device', async (data, callback) => {
    try {
      const { deviceId } = data;
      const { userId, schoolId } = socket.user;
      
      const result = await DeviceService.logoutDevice(userId, schoolId, deviceId);
      
      // If the logged out device is the current one, disconnect
      if (result.deviceFingerprint === socket.deviceFingerprint) {
        socket.emit('device-logged-out', { 
          message: 'This device has been logged out',
          redirect: true 
        });
        setTimeout(() => socket.disconnect(true), 3000);
      }
      
      if (callback) {
        callback({ success: true, ...result });
      }
    } catch (error) {
      console.error('Error logging out device:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });

  // ============ HEARTBEAT FOR DEVICE ACTIVITY TRACKING ============
  socket.on('heartbeat', async (data, callback) => {
    try {
      const { userId, schoolId } = socket.user;
      
      // Update device last activity
      await DeviceService.updateDeviceActivity(
        userId,
        schoolId,
        socket.deviceFingerprint
      );
      
      // Update peer activity in room
      if (socket.roomId) {
        const room = MediasoupService.getRoom(socket.roomId);
        if (room && room.peers && room.peers.has(userId)) {
          const peer = room.peers.get(userId);
          peer.lastActive = new Date();
        }
      }
      
      if (callback) {
        callback({ success: true, timestamp: new Date().toISOString() });
      }
    } catch (error) {
      console.error('Error updating heartbeat:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });

  // ============ RECONNECTION HANDLING ============
  socket.on('reconnect', async (data, callback) => {
    try {
      console.log(`🔄 User ${socket.user.userId} reconnected on device ${socket.deviceFingerprint}`);
      
      // Revalidate device
      const deviceValid = await DeviceService.validateDeviceForSession(
        socket.user.userId,
        socket.user.schoolId,
        socket.deviceFingerprint,
        'live-class'
      );

      if (!deviceValid.valid) {
        socket.emit('device-limit-exceeded', {
          limit: deviceValid.limit,
          current: deviceValid.current,
          role: socket.user.role
        });
        socket.disconnect();
        return;
      }

      // Rejoin previous room if exists
      if (socket.roomId) {
        socket.join(socket.roomId);
        socket.to(socket.roomId).emit('peer-reconnected', {
          peerId: socket.user.userId,
          deviceFingerprint: socket.deviceFingerprint,
          timestamp: new Date()
        });
      }

      if (callback) {
        callback({ success: true, reconnected: true });
      }
    } catch (error) {
      console.error('Error handling reconnection:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });

  // ============ DISCONNECTION WITH DEVICE CLEANUP ============
  socket.on('disconnect', async (reason) => {
    try {
      const { roomId, sessionId } = socket;
      const { userId, schoolId } = socket.user;

      console.log(`🔌 Socket disconnected: ${socket.id} - Reason: ${reason} - Device: ${socket.deviceFingerprint}`);

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
          deviceFingerprint: socket.deviceFingerprint,
          reason: reason,
          timestamp: new Date()
        });

        console.log(`👋 User ${userId} left room ${roomId} from device ${socket.deviceFingerprint}`);
      }

      // Update device disconnect info
      await DeviceService.updateDeviceDisconnect(
        userId,
        schoolId,
        socket.deviceFingerprint,
        reason
      );

    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });

  // ============ PING/PONG FOR CONNECTION MONITORING ============
  socket.on('ping', (data, callback) => {
    if (callback) callback({ 
      timestamp: Date.now(),
      deviceFingerprint: socket.deviceFingerprint 
    });
  });

  // ============ ERROR HANDLING ============
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id} (device: ${socket.deviceFingerprint}):`, error);
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

// ============ IMPORT ROUTES ============
console.log('📁 Loading route modules...');

try {
  // Import route modules
  const authRoutes = require('./routes/authRoutes');
  const studentRoutes = require('./routes/studentRoutes');
  const schoolRoutes = require('./routes/schoolRoutes');
  const dashboardRoutes = require('./routes/dashboardRoutes');
  const videoRoutes = require('./routes/videoRoutes');
  const liveSessionRoutes = require('./routes/liveSessionRoutes');
  const deviceRoutes = require('./routes/deviceRoutes'); // NEW: Device routes

  // Use route modules
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/videos', videoRoutes);
  app.use('/api/live-sessions', liveSessionRoutes);
  app.use('/api/devices', deviceRoutes); // NEW: Device routes
  
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

// ============ HEALTH CHECKS ============
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🚀 Open Skill Nepal Backend API - PHASE 3 LIVE CLASSES WITH DEVICE LIMITS',
    version: '3.1.0',
    status: 'operational',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    features: {
      videoUpload: true,
      videoScheduling: true,
      liveClasses: true,
      studentVerification: true,
      webRTC: true,
      webSocket: true,
      deviceLimits: true
    },
    connections: {
      webSocket: io.engine.clientsCount,
      mediasoup: MediasoupService.workers ? MediasoupService.workers.length : 0,
      uniqueDevices: getUniqueDeviceCount()
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
      webSocket: true,
      deviceLimits: true
    },
    connections: {
      webSocket: io.engine.clientsCount,
      mediasoupWorkers: MediasoupService.workers ? MediasoupService.workers.length : 0,
      uniqueDevices: getUniqueDeviceCount()
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

// Helper function to get unique device count
function getUniqueDeviceCount() {
  const devices = new Set();
  const sockets = io.sockets.sockets;
  
  for (const socket of sockets.values()) {
    if (socket.deviceFingerprint) {
      devices.add(socket.deviceFingerprint);
    }
  }
  
  return devices.size;
}

// ============ TEST ENDPOINTS FOR DEVICE LIMIT SYSTEM ============
app.get('/api/test-device-limit-system', (req, res) => {
  res.status(200).json({
    message: '✅ DEVICE LIMIT SYSTEM TEST',
    timestamp: new Date().toISOString(),
    status: 'testing',
    deviceLimitSystem: {
      webSocketIntegration: 'active',
      validation: 'enabled',
      failOpen: true,
      endpoints: [
        'POST /api/devices/validate',
        'GET /api/devices/active',
        'POST /api/devices/:deviceId/logout',
        'GET /api/devices/stats'
      ],
      webSocketEvents: [
        'device-limit-exceeded',
        'get-active-devices',
        'logout-device',
        'heartbeat'
      ],
      defaultLimits: {
        admin: 3,
        teacher: 5,
        student: 2,
        parent: 2
      }
    }
  });
});

app.get('/api/test-live-class-system', (req, res) => {
  res.status(200).json({
    message: '✅ LIVE CLASS SYSTEM TEST',
    timestamp: new Date().toISOString(),
    status: 'testing',
    liveClassSystem: {
      webSocket: 'active',
      mediasoup: MediasoupService.workers ? 'active' : 'inactive',
      storage: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'configured' : 'not configured',
      deviceIntegration: 'active',
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
        'toggle-mute',
        'heartbeat'
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
      'GET /api/test-device-limit-system',
      'POST /api/videos/upload',
      'GET /api/videos/live-now',
      'GET /api/videos/upcoming',
      'GET /api/videos/recorded',
      'POST /api/live-sessions',
      'GET /api/live-sessions/school/active',
      'POST /api/devices/validate',
      'GET /api/devices/active',
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
  console.log('='.repeat(80));
  console.log('🚀 OPEN SKILL NEPAL - PHASE 3 LIVE CLASSES WITH DEVICE LIMITS');
  console.log('='.repeat(80));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🕒 Started: ${new Date().toISOString()}`);
  console.log(`⏰ Video Scheduler: ${process.env.NODE_ENV !== 'test' ? 'ACTIVE' : 'DISABLED'}`);
  console.log(`🔌 WebSocket Server: ACTIVE (${io.engine.clientsCount} connections)`);
  console.log(`📡 WebRTC Server: ${MediasoupService.workers ? 'ACTIVE' : 'INACTIVE'}`);
  console.log(`🔐 Device Limits: ACTIVE`);
  console.log(`☁️  Google Cloud Storage: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  console.log('='.repeat(80));
  console.log('🎯 PHASE 3 LIVE CLASS ENDPOINTS:');
  console.log(`   POST http://localhost:${PORT}/api/live-sessions`);
  console.log(`   GET  http://localhost:${PORT}/api/live-sessions/school/active`);
  console.log(`   POST http://localhost:${PORT}/api/live-sessions/:id/start`);
  console.log(`   POST http://localhost:${PORT}/api/live-sessions/:id/end`);
  console.log(`   GET  http://localhost:${PORT}/api/live-sessions/:id/check-access`);
  console.log('='.repeat(80));
  console.log('🎯 PHASE 3 DEVICE LIMIT ENDPOINTS:');
  console.log(`   POST http://localhost:${PORT}/api/devices/validate`);
  console.log(`   GET  http://localhost:${PORT}/api/devices/active`);
  console.log(`   POST http://localhost:${PORT}/api/devices/:id/logout`);
  console.log(`   GET  http://localhost:${PORT}/api/devices/stats`);
  console.log('='.repeat(80));
  console.log('🎯 PHASE 2 VIDEO ENDPOINTS:');
  console.log(`   POST http://localhost:${PORT}/api/videos/upload`);
  console.log(`   GET  http://localhost:${PORT}/api/videos/live-now`);
  console.log(`   GET  http://localhost:${PORT}/api/videos/upcoming`);
  console.log(`   GET  http://localhost:${PORT}/api/videos/recorded`);
  console.log(`   GET  http://localhost:${PORT}/api/test-video-system`);
  console.log('='.repeat(80));
  console.log('🔌 WEBSOCKET CONNECTION:');
  console.log(`   ws://localhost:${PORT}`);
  console.log(`   Required Headers: Authorization: Bearer <token>, X-Device-Fingerprint: <fingerprint>`);
  console.log(`   Events: join-room, create-transport, send-message, raise-hand, toggle-mute, heartbeat`);
  console.log(`   Device Events: device-limit-exceeded, get-active-devices, logout-device`);
  console.log('='.repeat(80));
});

// ============ GRACEFUL SHUTDOWN WITH DEVICE CLEANUP ============
const gracefulShutdown = (signal) => {
  console.log(`\n🔄 ${signal} received, starting graceful shutdown...`);
  
  // Notify all connected devices
  io.emit('server-shutdown', {
    message: 'Server is shutting down',
    timestamp: new Date().toISOString(),
    reconnectDelay: 5000
  });
  
  // Close all WebSocket connections
  io.close(() => {
    console.log('✅ WebSocket server closed');
  });
  
  // Cleanup mediasoup resources
  MediasoupService.cleanupAll();
  console.log('✅ Mediasoup resources cleaned up');
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP server closed');
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
