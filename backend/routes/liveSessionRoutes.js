const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const liveSessionController = require('../controllers/liveSessionController');

// All routes require authentication
router.use(auth.authenticate);

// Create a new live session (Teachers only)
router.post('/',
    auth.authorize('teacher'),
    liveSessionController.createSession
);

// Start a session
router.post('/:sessionId/start',
    auth.authorize('teacher'),
    liveSessionController.startSession
);

// End a session
router.post('/:sessionId/end',
    auth.authorize('teacher'),
    liveSessionController.endSession
);

// Join a session (Teachers and School Admins)
router.post('/:sessionId/join',
    auth.authorize('teacher', 'school_admin'),
    liveSessionController.joinSession
);

// Leave a session
router.post('/:sessionId/leave',
    auth.authorize('teacher', 'school_admin'),
    liveSessionController.leaveSession
);

// Get session details
router.get('/:sessionId',
    auth.authorize('teacher', 'school_admin'),
    liveSessionController.getSessionDetails
);

// Get session participants
router.get('/:sessionId/participants',
    auth.authorize('teacher', 'school_admin'),
    liveSessionController.getSessionParticipants
);

// Get chat history
router.get('/:sessionId/chat',
    auth.authorize('teacher', 'school_admin'),
    liveSessionController.getChatHistory
);

// Check if user can access session
router.get('/:sessionId/check-access',
    auth.authorize('teacher', 'school_admin', 'student'),
    liveSessionController.checkAccess
);

// Get active sessions for school
router.get('/school/active',
    auth.authorize('teacher', 'school_admin'),
    async (req, res) => {
        try {
            const { schoolId } = req.user;
            const LiveSession = require('../models/LiveSession');

            const sessions = await LiveSession.find({
                schoolId,
                status: 'active'
            })
            .populate('teacherId', 'name email')
            .populate('classId', 'name subject')
            .sort({ startedAt: -1 })
            .limit(20);

            res.json({
                success: true,
                data: sessions
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

module.exports = router;
