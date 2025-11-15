const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// In-memory stores (replace with DB in production)
const users = {
  'school-admin-1': { id: 'school-admin-1', role: 'school_admin', schoolId: 'school-1', deviceLimit: 3 },
  'teacher-1': { id: 'teacher-1', role: 'teacher', schoolId: 'school-1' },
  'student-1': { id: 'student-1', role: 'student', schoolId: 'school-1' },
  'admin-1': { id: 'admin-1', role: 'admin' }
};

const classes = {
  'class-1': {
    id: 'class-1',
    teacherId: 'teacher-1',
    grade: '10',
    subject: 'Math',
    schedule: '2024-01-15T10:00:00Z',
    roomId: 'room-10-math'
  }
};

const activeRooms = new Map();
const JWT_SECRET = 'your-jwt-secret-dev';

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = users[decoded.userId];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based authorization
const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// ========== REST API ENDPOINTS ==========

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { userId, password } = req.body;
  const user = users[userId];
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, role: user.role, schoolId: user.schoolId } });
});

// Schedule management (Admin only)
app.get('/api/schedules', authenticate, requireRole(['admin', 'teacher']), (req, res) => {
  res.json(Object.values(classes));
});

app.post('/api/schedules', authenticate, requireRole(['admin']), (req, res) => {
  const { teacherId, grade, subject, schedule } = req.body;
  const classId = `class-${Date.now()}`;
  const roomId = `room-${grade}-${subject.toLowerCase()}`;
  
  classes[classId] = { id: classId, teacherId, grade, subject, schedule, roomId };
  res.status(201).json(classes[classId]);
});

// Teacher class management
app.post('/api/classes/:classId/start', authenticate, requireRole(['teacher']), (req, res) => {
  const { classId } = req.params;
  const classObj = classes[classId];
  
  if (!classObj) return res.status(404).json({ error: 'Class not found' });
  if (classObj.teacherId !== req.user.id) return res.status(403).json({ error: 'Not your class' });

  // Initialize room
  if (!activeRooms.has(classObj.roomId)) {
    activeRooms.set(classObj.roomId, {
      teacher: req.user.id,
      participants: new Map(),
      screenShareActive: false,
      recording: false
    });
  }

  res.json({ 
    roomId: classObj.roomId, 
    message: 'Class started successfully',
    recordingStarted: true
  });
});

app.post('/api/classes/:classId/end', authenticate, requireRole(['teacher']), (req, res) => {
  const { classId } = req.params;
  const classObj = classes[classId];
  
  if (classObj && activeRooms.has(classObj.roomId)) {
    const room = activeRooms.get(classObj.roomId);
    room.recording = false;
    // In production: trigger recording stop and storage
    activeRooms.delete(classObj.roomId);
  }
  
  res.json({ message: 'Class ended successfully' });
});

// Recording metadata
app.get('/api/recordings', authenticate, (req, res) => {
  // Mock recordings data
  const recordings = [
    {
      id: 'rec-1',
      classId: 'class-1',
      teacherId: 'teacher-1',
      subject: 'Math',
      grade: '10',
      recordingUrl: 'https://storage.googleapis.com/recordings/class-1.mp4',
      duration: '45:00',
      recordedAt: '2024-01-15T10:00:00Z'
    }
  ];
  
  res.json(recordings);
});

// ========== WEB SOCKET SIGNALING SERVER ==========

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  ws.user = null;
  ws.roomId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleWebSocketMessage(ws, message);
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    if (ws.roomId && ws.user) {
      handleLeaveRoom(ws.roomId, ws.user.id);
    }
  });
});

function handleWebSocketMessage(ws, message) {
  switch (message.type) {
    case 'authenticate':
      handleAuthentication(ws, message);
      break;
    case 'join-room':
      handleJoinRoom(ws, message);
      break;
    case 'leave-room':
      handleLeaveRoom(ws.roomId, ws.user?.id);
      break;
    case 'offer':
    case 'answer':
    case 'ice-candidate':
    case 'start-screen-share':
    case 'stop-screen-share':
    case 'raise-hand':
    case 'allow-speak':
      broadcastToRoom(ws.roomId, message, ws);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

function handleAuthentication(ws, message) {
  const { token } = message;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    ws.user = users[decoded.userId];
    ws.send(JSON.stringify({ type: 'authenticated', user: ws.user }));
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
  }
}

function handleJoinRoom(ws, message) {
  const { roomId } = message;
  
  if (!ws.user) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
    return;
  }

  // Check if student trying to join live class
  if (ws.user.role === 'student') {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'students cannot join live class' 
    }));
    return;
  }

  const room = activeRooms.get(roomId);
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not active' }));
    return;
  }

  // Device limit enforcement for school admins
  if (ws.user.role === 'school_admin') {
    const schoolConnections = Array.from(room.participants.values())
      .filter(p => p.role === 'school_admin' && p.schoolId === ws.user.schoolId)
      .length;

    if (schoolConnections >= ws.user.deviceLimit) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'device-limit exceeded' 
      }));
      return;
    }
  }

  // Join the room
  ws.roomId = roomId;
  room.participants.set(ws.user.id, {
    id: ws.user.id,
    role: ws.user.role,
    schoolId: ws.user.schoolId,
    ws: ws
  });

  ws.send(JSON.stringify({ type: 'joined-room', roomId }));
  
  // Notify others
  broadcastToRoom(roomId, {
    type: 'user-joined',
    user: { id: ws.user.id, role: ws.user.role }
  }, ws);
}

function handleLeaveRoom(roomId, userId) {
  const room = activeRooms.get(roomId);
  if (room && userId) {
    room.participants.delete(userId);
    
    broadcastToRoom(roomId, {
      type: 'user-left',
      userId: userId
    });
  }
}

function broadcastToRoom(roomId, message, excludeWs = null) {
  const room = activeRooms.get(roomId);
  if (!room) return;

  room.participants.forEach(participant => {
    if (participant.ws !== excludeWs && participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(JSON.stringify(message));
    }
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
