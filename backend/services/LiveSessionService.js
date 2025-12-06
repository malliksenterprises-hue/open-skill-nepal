const { v4: uuidv4 } = require('uuid');
const LiveSession = require('../models/LiveSession');
const logger = require('../utils/logger');

class LiveSessionService {
    async createSession(classId, teacherId, schoolId, data) {
        const sessionId = uuidv4();
        const roomId = `room_${sessionId}`;

        const session = new LiveSession({
            sessionId,
            roomId,
            classId,
            teacherId,
            schoolId,
            title: data.title || 'Live Class',
            description: data.description || '',
            maxParticipants: data.maxParticipants || 50,
            status: 'scheduled'
        });

        await session.save();
        logger.info(`Live session created: ${sessionId} for class ${classId}`);
        
        return session;
    }

    async startSession(sessionId, teacherId) {
        const session = await LiveSession.findOne({ 
            sessionId, 
            teacherId,
            status: 'scheduled'
        });

        if (!session) {
            throw new Error('Session not found or already started');
        }

        session.status = 'active';
        session.startedAt = new Date();
        await session.save();

        logger.info(`Live session started: ${sessionId}`);
        return session;
    }

    async endSession(sessionId, teacherId, recordingUrl = null) {
        const session = await LiveSession.findOne({ 
            sessionId, 
            teacherId,
            status: 'active'
        });

        if (!session) {
            throw new Error('Session not found or not active');
        }

        session.status = 'ended';
        session.endedAt = new Date();
        session.recordingUrl = recordingUrl;
        await session.save();

        logger.info(`Live session ended: ${sessionId}`);
        return session;
    }

    async addParticipant(sessionId, userId, userRole, deviceFingerprint) {
        const session = await LiveSession.findOne({ sessionId });
        
        if (!session) {
            throw new Error('Session not found');
        }

        // Check if already joined
        const existingParticipant = session.participants.find(
            p => p.userId.toString() === userId.toString() && !p.leftAt
        );

        if (existingParticipant) {
            // Update joined time
            existingParticipant.joinedAt = new Date();
            existingParticipant.leftAt = null;
            await session.save();
            return existingParticipant;
        }

        // Add new participant
        const participant = {
            userId,
            userRole,
            deviceFingerprint,
            joinedAt: new Date()
        };

        session.participants.push(participant);
        await session.save();

        logger.debug(`Participant ${userId} added to session ${sessionId}`);
        return participant;
    }

    async leaveSession(sessionId, userId) {
        const session = await LiveSession.findOne({ sessionId });
        
        if (!session) {
            throw new Error('Session not found');
        }

        const participant = session.participants.find(
            p => p.userId.toString() === userId.toString() && !p.leftAt
        );

        if (participant) {
            participant.leftAt = new Date();
            await session.save();
            logger.debug(`Participant ${userId} left session ${sessionId}`);
        }

        return participant;
    }

    async addChatMessage(sessionId, senderId, senderRole, senderName, message, messageType = 'text') {
        const session = await LiveSession.findOne({ sessionId });
        
        if (!session) {
            throw new Error('Session not found');
        }

        const chatMessage = {
            senderId,
            senderRole,
            senderName,
            message,
            messageType,
            timestamp: new Date()
        };

        session.chatMessages.push(chatMessage);
        await session.save();

        return chatMessage;
    }

    async getSessionParticipants(sessionId) {
        const session = await LiveSession.findOne({ sessionId })
            .populate('participants.userId', 'name email')
            .select('participants');
        
        if (!session) {
            throw new Error('Session not found');
        }

        return session.participants.filter(p => !p.leftAt);
    }

    async getChatHistory(sessionId, limit = 100) {
        const session = await LiveSession.findOne({ sessionId })
            .select('chatMessages')
            .slice('chatMessages', -limit);
        
        if (!session) {
            throw new Error('Session not found');
        }

        return session.chatMessages;
    }

    async toggleMuteParticipant(sessionId, userId, muted) {
        const session = await LiveSession.findOne({ sessionId });
        
        if (!session) {
            throw new Error('Session not found');
        }

        const participant = session.participants.find(
            p => p.userId.toString() === userId.toString() && !p.leftAt
        );

        if (participant) {
            participant.isMuted = muted;
            await session.save();
        }

        return participant;
    }

    async raiseHand(sessionId, userId) {
        const session = await LiveSession.findOne({ sessionId });
        
        if (!session) {
            throw new Error('Session not found');
        }

        const participant = session.participants.find(
            p => p.userId.toString() === userId.toString() && !p.leftAt
        );

        if (participant) {
            participant.handRaised = true;
            participant.handRaisedAt = new Date();
            await session.save();
        }

        return participant;
    }

    async lowerHand(sessionId, userId) {
        const session = await LiveSession.findOne({ sessionId });
        
        if (!session) {
            throw new Error('Session not found');
        }

        const participant = session.participants.find(
            p => p.userId.toString() === userId.toString() && !p.leftAt
        );

        if (participant) {
            participant.handRaised = false;
            await session.save();
        }

        return participant;
    }
}

module.exports = new LiveSessionService();
