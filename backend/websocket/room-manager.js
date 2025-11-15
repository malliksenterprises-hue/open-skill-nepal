class RoomManager {
  constructor() {
    this.activeRooms = new Map();
  }

  createRoom(roomId, teacherId) {
    this.activeRooms.set(roomId, {
      teacher: teacherId,
      participants: new Map(), // userId -> { id, role, schoolId, ws }
      screenShareActive: false,
      recording: false,
      raisedHands: new Set(),
      createdAt: new Date()
    });
  }

  canJoinRoom(roomId, user) {
    const room = this.activeRooms.get(roomId);
    if (!room) return { allowed: false, reason: 'Room not active' };

    // Student restriction
    if (user.role === 'student') {
      return { allowed: false, reason: 'students cannot join live class' };
    }

    // Device limit check for school admins
    if (user.role === 'school_admin') {
      const schoolConnections = this.getSchoolConnections(roomId, user.schoolId);
      if (schoolConnections >= user.deviceLimit) {
        return { allowed: false, reason: 'device-limit exceeded' };
      }
    }

    return { allowed: true };
  }

  getSchoolConnections(roomId, schoolId) {
    const room = this.activeRooms.get(roomId);
    if (!room) return 0;

    return Array.from(room.participants.values())
      .filter(p => p.role === 'school_admin' && p.schoolId === schoolId)
      .length;
  }

  addParticipant(roomId, user, ws) {
    const room = this.activeRooms.get(roomId);
    if (room) {
      room.participants.set(user.id, { ...user, ws });
    }
  }

  removeParticipant(roomId, userId) {
    const room = this.activeRooms.get(roomId);
    if (room) {
      room.participants.delete(userId);
      room.raisedHands.delete(userId);
      
      // Clean up empty rooms
      if (room.participants.size === 0) {
        this.activeRooms.delete(roomId);
      }
    }
  }

  raiseHand(roomId, userId) {
    const room = this.activeRooms.get(roomId);
    if (room) {
      room.raisedHands.add(userId);
    }
  }

  allowSpeak(roomId, userId) {
    const room = this.activeRooms.get(roomId);
    if (room) {
      room.raisedHands.delete(userId);
    }
  }
}

module.exports = new RoomManager();
