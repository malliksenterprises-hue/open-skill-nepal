# API Endpoints Documentation

## Authentication
- `POST /api/auth/login` - User login

## Schedule Management
- `GET /api/schedules` - Get all classes (Admin/Teacher)
- `POST /api/schedules` - Create new class (Admin only)

## Class Management
- `POST /api/classes/:classId/start` - Start live class (Teacher)
- `POST /api/classes/:classId/end` - End live class (Teacher)

## Recordings
- `GET /api/recordings` - Get available recordings

## WebSocket Events

### Authentication
- `authenticate` - Authenticate connection with JWT
- `authenticated` - Authentication success response

### Room Management
- `join-room` - Join a live class room
- `leave-room` - Leave current room
- `joined-room` - Successfully joined room

### WebRTC Signaling
- `offer` - WebRTC offer
- `answer` - WebRTC answer  
- `ice-candidate` - ICE candidate exchange

### Classroom Features
- `start-screen-share` - Start screen sharing
- `stop-screen-share` - Stop screen sharing
- `raise-hand` - Student raise hand notification
- `allow-speak` - Teacher allow student to speak
