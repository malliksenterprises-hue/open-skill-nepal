const LiveSessionService = require('../services/LiveSessionService');
const DeviceService = require('../services/DeviceService');
const logger = require('../utils/logger');

exports.createSession = async (req, res) => {
    try {
        const { classId, title, description, maxParticipants } = req.body;
        const { userId, schoolId } = req.user;

        const session = await LiveSessionService.createSession(
            classId,
            userId,
            schoolId,
            { title, description, maxParticipants }
        );

        res.status(201).json({
            success: true,
            data: session
        });
    } catch (error) {
        logger.error('Error creating live session:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.startSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId } = req.user;

        const session = await LiveSessionService.startSession(sessionId, userId);

        res.json({
            success: true,
            data: session
        });
    } catch (error) {
        logger.error('Error starting live session:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.endSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId } = req.user;
        const { recordingUrl } = req.body;

        const session = await LiveSessionService.endSession(sessionId, userId, recordingUrl);

        res.json({
            success: true,
            data: session
        });
    } catch (error) {
        logger.error('Error ending live session:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.joinSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId, role, schoolId } = req.user;
        const { deviceFingerprint } = req.body;

        // Check device limit for school admins
        if (role === 'school_admin') {
            const canJoin = await DeviceService.verifyDeviceAccess(
                userId,
                deviceFingerprint,
                req.ip
            );
            
            if (!canJoin) {
                return res.status(403).json({
                    success: false,
                    error: 'Device limit exceeded'
                });
            }
        }

        const participant = await LiveSessionService.addParticipant(
            sessionId,
            userId,
            role,
            deviceFingerprint
        );

        res.json({
            success: true,
            data: participant
        });
    } catch (error) {
        logger.error('Error joining live session:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.leaveSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId } = req.user;

        const participant = await LiveSessionService.leaveSession(sessionId, userId);

        res.json({
            success: true,
            data: participant
        });
    } catch (error) {
        logger.error('Error leaving live session:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.getSessionDetails = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const LiveSession = require('../models/LiveSession');

        const session = await LiveSession.findOne({ sessionId })
            .populate('teacherId', 'name email')
            .populate('classId', 'name subject');

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        res.json({
            success: true,
            data: session
        });
    } catch (error) {
        logger.error('Error getting session details:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getSessionParticipants = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const participants = await LiveSessionService.getSessionParticipants(sessionId);

        res.json({
            success: true,
            data: participants
        });
    } catch (error) {
        logger.error('Error getting session participants:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getChatHistory = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { limit = 100 } = req.query;

        const messages = await LiveSessionService.getChatHistory(sessionId, parseInt(limit));

        res.json({
            success: true,
            data: messages
        });
    } catch (error) {
        logger.error('Error getting chat history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.checkAccess = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId, role, schoolId } = req.user;
        const LiveSession = require('../models/LiveSession');

        const session = await LiveSession.findOne({ sessionId });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        // Teachers can access their own sessions
        if (role === 'teacher' && session.teacherId.toString() === userId) {
            return res.json({ success: true, canAccess: true });
        }

        // School admins can access sessions from their school
        if (role === 'school_admin' && session.schoolId.toString() === schoolId) {
            return res.json({ success: true, canAccess: true });
        }

        // Students cannot access live sessions (Phase 2 constraint)
        if (role === 'student') {
            return res.json({ success: true, canAccess: false });
        }

        res.json({ success: true, canAccess: false });
    } catch (error) {
        logger.error('Error checking session access:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
