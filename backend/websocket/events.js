const WebSocketEvents = {
  // Authentication
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  
  // Room Management
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  JOINED_ROOM: 'joined-room',
  
  // WebRTC Signaling
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice-candidate',
  
  // Screen Sharing
  START_SCREEN_SHARE: 'start-screen-share',
  STOP_SCREEN_SHARE: 'stop-screen-share',
  
  // Classroom Interaction
  RAISE_HAND: 'raise-hand',
  ALLOW_SPEAK: 'allow-speak',
  
  // User Presence
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  
  // Errors
  ERROR: 'error'
};

module.exports = WebSocketEvents;
