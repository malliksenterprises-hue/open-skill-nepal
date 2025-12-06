const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true
    },
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['scheduled', 'active', 'ended', 'cancelled'],
        default: 'scheduled'
    },
    startedAt: {
        type: Date
    },
    endedAt: {
        type: Date
    },
    recordingUrl: {
        type: String
    },
    maxParticipants: {
        type: Number,
        default: 50
    },
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        userRole: {
            type: String,
            enum: ['teacher', 'school_admin']
        },
        deviceFingerprint: String,
        joinedAt: {
            type: Date,
            default: Date.now
        },
        leftAt: Date,
        isMuted: {
            type: Boolean,
            default: false
        },
        handRaised: {
            type: Boolean,
            default: false
        },
        handRaisedAt: Date
    }],
    chatMessages: [{
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        senderRole: {
            type: String,
            enum: ['teacher', 'school_admin']
        },
        senderName: String,
        message: String,
        messageType: {
            type: String,
            enum: ['text', 'file', 'system'],
            default: 'text'
        },
        fileUrl: String,
        fileName: String,
        fileSize: Number,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    polls: [{
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        question: String,
        options: [{
            text: String,
            votes: {
                type: Number,
                default: 0
            }
        }],
        isActive: {
            type: Boolean,
            default: true
        },
        expiresAt: Date,
        responses: [{
            participantId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            selectedOption: Number,
            respondedAt: {
                type: Date,
                default: Date.now
            }
        }]
    }]
}, {
    timestamps: true
});

// Indexes for performance
liveSessionSchema.index({ schoolId: 1, status: 1 });
liveSessionSchema.index({ teacherId: 1, status: 1 });
liveSessionSchema.index({ roomId: 1 }, { unique: true });
liveSessionSchema.index({ sessionId: 1 }, { unique: true });
liveSessionSchema.index({ 'participants.userId': 1 });

module.exports = mongoose.model('LiveSession', liveSessionSchema);
