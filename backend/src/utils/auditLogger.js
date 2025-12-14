/**
 * Audit Logger Utility
 * 
 * Comprehensive audit logging system for Open Skill Nepal platform.
 * Tracks security-relevant events, user actions, and system changes
 * for compliance, debugging, and security monitoring.
 * 
 * @module utils/auditLogger
 */

const mongoose = require('mongoose');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');

// Audit event types and categories
const AUDIT_EVENT_TYPES = {
    // Authentication events
    AUTH_LOGIN: 'AUTH_LOGIN',
    AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
    AUTH_LOGOUT: 'AUTH_LOGOUT',
    AUTH_TOKEN_REFRESH: 'AUTH_TOKEN_REFRESH',
    AUTH_PASSWORD_CHANGE: 'AUTH_PASSWORD_CHANGE',
    AUTH_PASSWORD_RESET_REQUEST: 'AUTH_PASSWORD_RESET_REQUEST',
    AUTH_PASSWORD_RESET_COMPLETE: 'AUTH_PASSWORD_RESET_COMPLETE',
    
    // User management events
    USER_CREATED: 'USER_CREATED',
    USER_UPDATED: 'USER_UPDATED',
    USER_DELETED: 'USER_DELETED',
    USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
    USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
    
    // Class management events
    CLASS_LOGIN_CREATED: 'CLASS_LOGIN_CREATED',
    CLASS_LOGIN_UPDATED: 'CLASS_LOGIN_UPDATED',
    CLASS_LOGIN_DELETED: 'CLASS_LOGIN_DELETED',
    CLASS_LOGIN_CREDENTIALS_VIEWED: 'CLASS_LOGIN_CREDENTIALS_VIEWED',
    CLASS_LOGIN_DEVICE_LIMIT_CHANGED: 'CLASS_LOGIN_DEVICE_LIMIT_CHANGED',
    
    // School management events
    SCHOOL_CREATED: 'SCHOOL_CREATED',
    SCHOOL_UPDATED: 'SCHOOL_UPDATED',
    SCHOOL_DELETED: 'SCHOOL_DELETED',
    SCHOOL_TEACHER_ASSIGNED: 'SCHOOL_TEACHER_ASSIGNED',
    SCHOOL_TEACHER_REMOVED: 'SCHOOL_TEACHER_REMOVED',
    
    // Device management events
    DEVICE_REGISTERED: 'DEVICE_REGISTERED',
    DEVICE_DEREGISTERED: 'DEVICE_DEREGISTERED',
    DEVICE_LIMIT_EXCEEDED: 'DEVICE_LIMIT_EXCEEDED',
    DEVICE_SESSION_CREATED: 'DEVICE_SESSION_CREATED',
    DEVICE_SESSION_ENDED: 'DEVICE_SESSION_ENDED',
    
    // Live class events
    LIVE_CLASS_STARTED: 'LIVE_CLASS_STARTED',
    LIVE_CLASS_ENDED: 'LIVE_CLASS_ENDED',
    LIVE_CLASS_JOINED: 'LIVE_CLASS_JOINED',
    LIVE_CLASS_LEFT: 'LIVE_CLASS_LEFT',
    LIVE_CLASS_RECORDING_STARTED: 'LIVE_CLASS_RECORDING_STARTED',
    LIVE_CLASS_RECORDING_ENDED: 'LIVE_CLASS_RECORDING_ENDED',
    
    // Content management events
    CONTENT_UPLOADED: 'CONTENT_UPLOADED',
    CONTENT_DELETED: 'CONTENT_DELETED',
    CONTENT_SHARED: 'CONTENT_SHARED',
    CONTENT_ACCESSED: 'CONTENT_ACCESSED',
    
    // Administrative events
    ADMIN_ACTION: 'ADMIN_ACTION',
    SETTINGS_CHANGED: 'SETTINGS_CHANGED',
    CONFIGURATION_UPDATED: 'CONFIGURATION_UPDATED',
    
    // Security events
    SECURITY_ALERT: 'SECURITY_ALERT',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    RATE_LIMIT_TRIGGERED: 'RATE_LIMIT_TRIGGERED',
    IP_BLOCKED: 'IP_BLOCKED',
    
    // System events
    SYSTEM_STARTUP: 'SYSTEM_STARTUP',
    SYSTEM_SHUTDOWN: 'SYSTEM_SHUTDOWN',
    BACKUP_CREATED: 'BACKUP_CREATED',
    BACKUP_RESTORED: 'BACKUP_RESTORED'
};

// Audit event categories
const AUDIT_CATEGORIES = {
    AUTHENTICATION: 'AUTHENTICATION',
    AUTHORIZATION: 'AUTHORIZATION',
    DATA_ACCESS: 'DATA_ACCESS',
    DATA_MODIFICATION: 'DATA_MODIFICATION',
    CONFIGURATION: 'CONFIGURATION',
    SECURITY: 'SECURITY',
    SYSTEM: 'SYSTEM'
};

// Event type to category mapping
const EVENT_CATEGORY_MAPPING = {
    // Authentication events
    [AUDIT_EVENT_TYPES.AUTH_LOGIN]: AUDIT_CATEGORIES.AUTHENTICATION,
    [AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILED]: AUDIT_CATEGORIES.AUTHENTICATION,
    [AUDIT_EVENT_TYPES.AUTH_LOGOUT]: AUDIT_CATEGORIES.AUTHENTICATION,
    [AUDIT_EVENT_TYPES.AUTH_TOKEN_REFRESH]: AUDIT_CATEGORIES.AUTHENTICATION,
    [AUDIT_EVENT_TYPES.AUTH_PASSWORD_CHANGE]: AUDIT_CATEGORIES.AUTHENTICATION,
    [AUDIT_EVENT_TYPES.AUTH_PASSWORD_RESET_REQUEST]: AUDIT_CATEGORIES.AUTHENTICATION,
    [AUDIT_EVENT_TYPES.AUTH_PASSWORD_RESET_COMPLETE]: AUDIT_CATEGORIES.AUTHENTICATION,
    
    // User management events
    [AUDIT_EVENT_TYPES.USER_CREATED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.USER_UPDATED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.USER_DELETED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.USER_ROLE_CHANGED]: AUDIT_CATEGORIES.AUTHORIZATION,
    [AUDIT_EVENT_TYPES.USER_STATUS_CHANGED]: AUDIT_CATEGORIES.AUTHORIZATION,
    
    // Class management events
    [AUDIT_EVENT_TYPES.CLASS_LOGIN_CREATED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.CLASS_LOGIN_UPDATED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.CLASS_LOGIN_DELETED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.CLASS_LOGIN_CREDENTIALS_VIEWED]: AUDIT_CATEGORIES.DATA_ACCESS,
    [AUDIT_EVENT_TYPES.CLASS_LOGIN_DEVICE_LIMIT_CHANGED]: AUDIT_CATEGORIES.CONFIGURATION,
    
    // School management events
    [AUDIT_EVENT_TYPES.SCHOOL_CREATED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.SCHOOL_UPDATED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.SCHOOL_DELETED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.SCHOOL_TEACHER_ASSIGNED]: AUDIT_CATEGORIES.AUTHORIZATION,
    [AUDIT_EVENT_TYPES.SCHOOL_TEACHER_REMOVED]: AUDIT_CATEGORIES.AUTHORIZATION,
    
    // Device management events
    [AUDIT_EVENT_TYPES.DEVICE_REGISTERED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.DEVICE_DEREGISTERED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.DEVICE_LIMIT_EXCEEDED]: AUDIT_CATEGORIES.SECURITY,
    [AUDIT_EVENT_TYPES.DEVICE_SESSION_CREATED]: AUDIT_CATEGORIES.AUTHENTICATION,
    [AUDIT_EVENT_TYPES.DEVICE_SESSION_ENDED]: AUDIT_CATEGORIES.AUTHENTICATION,
    
    // Live class events
    [AUDIT_EVENT_TYPES.LIVE_CLASS_STARTED]: AUDIT_CATEGORIES.DATA_ACCESS,
    [AUDIT_EVENT_TYPES.LIVE_CLASS_ENDED]: AUDIT_CATEGORIES.DATA_ACCESS,
    [AUDIT_EVENT_TYPES.LIVE_CLASS_JOINED]: AUDIT_CATEGORIES.DATA_ACCESS,
    [AUDIT_EVENT_TYPES.LIVE_CLASS_LEFT]: AUDIT_CATEGORIES.DATA_ACCESS,
    [AUDIT_EVENT_TYPES.LIVE_CLASS_RECORDING_STARTED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.LIVE_CLASS_RECORDING_ENDED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    
    // Content management events
    [AUDIT_EVENT_TYPES.CONTENT_UPLOADED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.CONTENT_DELETED]: AUDIT_CATEGORIES.DATA_MODIFICATION,
    [AUDIT_EVENT_TYPES.CONTENT_SHARED]: AUDIT_CATEGORIES.DATA_ACCESS,
    [AUDIT_EVENT_TYPES.CONTENT_ACCESSED]: AUDIT_CATEGORIES.DATA_ACCESS,
    
    // Administrative events
    [AUDIT_EVENT_TYPES.ADMIN_ACTION]: AUDIT_CATEGORIES.AUTHORIZATION,
    [AUDIT_EVENT_TYPES.SETTINGS_CHANGED]: AUDIT_CATEGORIES.CONFIGURATION,
    [AUDIT_EVENT_TYPES.CONFIGURATION_UPDATED]: AUDIT_CATEGORIES.CONFIGURATION,
    
    // Security events
    [AUDIT_EVENT_TYPES.SECURITY_ALERT]: AUDIT_CATEGORIES.SECURITY,
    [AUDIT_EVENT_TYPES.SUSPICIOUS_ACTIVITY]: AUDIT_CATEGORIES.SECURITY,
    [AUDIT_EVENT_TYPES.RATE_LIMIT_TRIGGERED]: AUDIT_CATEGORIES.SECURITY,
    [AUDIT_EVENT_TYPES.IP_BLOCKED]: AUDIT_CATEGORIES.SECURITY,
    
    // System events
    [AUDIT_EVENT_TYPES.SYSTEM_STARTUP]: AUDIT_CATEGORIES.SYSTEM,
    [AUDIT_EVENT_TYPES.SYSTEM_SHUTDOWN]: AUDIT_CATEGORIES.SYSTEM,
    [AUDIT_EVENT_TYPES.BACKUP_CREATED]: AUDIT_CATEGORIES.SYSTEM,
    [AUDIT_EVENT_TYPES.BACKUP_RESTORED]: AUDIT_CATEGORIES.SYSTEM
};

// Audit log schema (for MongoDB storage)
const auditLogSchema = new mongoose.Schema({
    // Core fields
    eventId: {
        type: String,
        required: true,
        default: () => uuidv4(),
        index: true
    },
    eventType: {
        type: String,
        required: true,
        enum: Object.values(AUDIT_EVENT_TYPES),
        index: true
    },
    eventCategory: {
        type: String,
        required: true,
        enum: Object.values(AUDIT_CATEGORIES),
        index: true
    },
    timestamp: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    
    // User/actor information
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    actorType: {
        type: String,
        enum: ['superAdmin', 'admin', 'teacher', 'schoolAdmin', 'classLogin', 'student', 'system'],
        required: true,
        index: true
    },
    actorIp: {
        type: String,
        required: false,
        index: true
    },
    actorUserAgent: {
        type: String,
        required: false
    },
    
    // Target/resource information
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        index: true
    },
    targetType: {
        type: String,
        required: false,
        index: true
    },
    targetName: {
        type: String,
        required: false
    },
    
    // School/class context
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: false,
        index: true
    },
    classLoginId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClassLogin',
        required: false,
        index: true
    },
    
    // Event details
    description: {
        type: String,
        required: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    },
    changes: {
        type: mongoose.Schema.Types.Mixed,
        required: false
    },
    
    // Outcome
    status: {
        type: String,
        enum: ['success', 'failure', 'warning'],
        required: true,
        index: true
    },
    errorCode: {
        type: String,
        required: false
    },
    errorMessage: {
        type: String,
        required: false
    },
    
    // Request context
    requestId: {
        type: String,
        required: false,
        index: true
    },
    requestPath: {
        type: String,
        required: false,
        index: true
    },
    requestMethod: {
        type: String,
        required: false
    },
    
    // Metadata
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low',
        index: true
    },
    tags: [{
        type: String,
        index: true
    }],
    
    // Timestamps (Mongoose will handle these automatically)
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 90 * 24 * 60 * 60 // Auto-expire after 90 days (configurable)
    }
}, {
    timestamps: true,
    collection: 'audit_logs'
});

// Create indexes for common queries
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ schoolId: 1, timestamp: -1 });
auditLogSchema.index({ classLoginId: 1, timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ status: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

// Create model
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

/**
 * Logs an audit event
 * 
 * @param {Object} params - Audit log parameters
 * @returns {Promise<Object>} Created audit log entry
 */
async function logAuditEvent(params) {
    const {
        eventType,
        actorId,
        actorType,
        actorIp,
        actorUserAgent,
        targetId,
        targetType,
        targetName,
        schoolId,
        classLoginId,
        description,
        details,
        changes,
        status = 'success',
        errorCode,
        errorMessage,
        requestId,
        requestPath,
        requestMethod,
        severity = 'low',
        tags = []
    } = params;
    
    try {
        // Validate event type
        if (!AUDIT_EVENT_TYPES[eventType]) {
            throw new Error(`Invalid audit event type: ${eventType}`);
        }
        
        // Determine category
        const eventCategory = EVENT_CATEGORY_MAPPING[eventType] || AUDIT_CATEGORIES.SYSTEM;
        
        // Determine severity if not provided
        let finalSeverity = severity;
        if (!severity) {
            if (eventCategory === AUDIT_CATEGORIES.SECURITY) {
                finalSeverity = 'high';
            } else if (eventCategory === AUDIT_CATEGORIES.AUTHORIZATION) {
                finalSeverity = 'medium';
            } else {
                finalSeverity = 'low';
            }
        }
        
        // Create audit log entry
        const auditLog = new AuditLog({
            eventType,
            eventCategory,
            actorId,
            actorType,
            actorIp,
            actorUserAgent,
            targetId,
            targetType,
            targetName,
            schoolId,
            classLoginId,
            description,
            details,
            changes,
            status,
            errorCode,
            errorMessage,
            requestId,
            requestPath,
            requestMethod,
            severity: finalSeverity,
            tags: Array.isArray(tags) ? tags : [tags]
        });
        
        // Save to database
        await auditLog.save();
        
        // Also log to system logger for immediate visibility
        const logMessage = `AUDIT: ${eventType} - ${description}`;
        const logContext = {
            eventId: auditLog.eventId,
            actorId,
            actorType,
            targetId,
            status,
            severity: finalSeverity
        };
        
        switch (finalSeverity) {
            case 'critical':
            case 'high':
                logger.error(logMessage, logContext);
                break;
            case 'medium':
                logger.warn(logMessage, logContext);
                break;
            default:
                logger.info(logMessage, logContext);
        }
        
        return auditLog;
        
    } catch (error) {
        // Log audit failure but don't throw (to not break application flow)
        logger.error('Failed to log audit event:', {
            error: error.message,
            eventType,
            actorId,
            description: description?.substring(0, 100)
        });
        
        // Return a stub to indicate logging was attempted but failed
        return {
            eventId: uuidv4(),
            eventType,
            timestamp: new Date(),
            status: 'failure',
            error: 'Audit logging failed'
        };
    }
}

/**
 * Logs authentication event
 * 
 * @param {Object} params - Authentication event parameters
 * @returns {Promise<Object>} Audit log entry
 */
async function logAuthEvent(params) {
    const {
        eventType,
        userId,
        userRole,
        ipAddress,
        userAgent,
        status,
        errorMessage,
        requestId
    } = params;
    
    const validAuthEvents = [
        AUDIT_EVENT_TYPES.AUTH_LOGIN,
        AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILED,
        AUDIT_EVENT_TYPES.AUTH_LOGOUT,
        AUDIT_EVENT_TYPES.AUTH_TOKEN_REFRESH
    ];
    
    if (!validAuthEvents.includes(eventType)) {
        throw new Error(`Invalid authentication event type: ${eventType}`);
    }
    
    let description = '';
    switch (eventType) {
        case AUDIT_EVENT_TYPES.AUTH_LOGIN:
            description = `User ${userId} logged in successfully`;
            break;
        case AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILED:
            description = `Failed login attempt for user ${userId}`;
            break;
        case AUDIT_EVENT_TYPES.AUTH_LOGOUT:
            description = `User ${userId} logged out`;
            break;
        case AUDIT_EVENT_TYPES.AUTH_TOKEN_REFRESH:
            description = `User ${userId} refreshed authentication token`;
            break;
    }
    
    return logAuditEvent({
        eventType,
        actorId: userId,
        actorType: userRole,
        actorIp: ipAddress,
        actorUserAgent: userAgent,
        description,
        status: status || (eventType === AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILED ? 'failure' : 'success'),
        errorMessage,
        requestId,
        severity: eventType === AUDIT_EVENT_TYPES.AUTH_LOGIN_FAILED ? 'medium' : 'low'
    });
}

/**
 * Logs user management event
 * 
 * @param {Object} params - User management event parameters
 * @returns {Promise<Object>} Audit log entry
 */
async function logUserManagementEvent(params) {
    const {
        eventType,
        actorId,
        actorType,
        targetUserId,
        targetUserType,
        targetUserName,
        changes,
        ipAddress,
        userAgent
    } = params;
    
    const validUserEvents = [
        AUDIT_EVENT_TYPES.USER_CREATED,
        AUDIT_EVENT_TYPES.USER_UPDATED,
        AUDIT_EVENT_TYPES.USER_DELETED,
        AUDIT_EVENT_TYPES.USER_ROLE_CHANGED,
        AUDIT_EVENT_TYPES.USER_STATUS_CHANGED
    ];
    
    if (!validUserEvents.includes(eventType)) {
        throw new Error(`Invalid user management event type: ${eventType}`);
    }
    
    let description = '';
    switch (eventType) {
        case AUDIT_EVENT_TYPES.USER_CREATED:
            description = `User ${targetUserName} (${targetUserId}) created by ${actorType} ${actorId}`;
            break;
        case AUDIT_EVENT_TYPES.USER_UPDATED:
            description = `User ${targetUserName} (${targetUserId}) updated by ${actorType} ${actorId}`;
            break;
        case AUDIT_EVENT_TYPES.USER_DELETED:
            description = `User ${targetUserName} (${targetUserId}) deleted by ${actorType} ${actorId}`;
            break;
        case AUDIT_EVENT_TYPES.USER_ROLE_CHANGED:
            description = `User ${targetUserName} (${targetUserId}) role changed by ${actorType} ${actorId}`;
            break;
        case AUDIT_EVENT_TYPES.USER_STATUS_CHANGED:
            description = `User ${targetUserName} (${targetUserId}) status changed by ${actorType} ${actorId}`;
            break;
    }
    
    return logAuditEvent({
        eventType,
        actorId,
        actorType,
        actorIp: ipAddress,
        actorUserAgent: userAgent,
        targetId: targetUserId,
        targetType: 'User',
        targetName: targetUserName,
        description,
        changes,
        severity: 'medium'
    });
}

/**
 * Logs class login management event
 * 
 * @param {Object} params - Class login event parameters
 * @returns {Promise<Object>} Audit log entry
 */
async function logClassLoginEvent(params) {
    const {
        eventType,
        actorId,
        actorType,
        classLoginId,
        className,
        schoolId,
        changes,
        ipAddress,
        userAgent
    } = params;
    
    const validClassEvents = [
        AUDIT_EVENT_TYPES.CLASS_LOGIN_CREATED,
        AUDIT_EVENT_TYPES.CLASS_LOGIN_UPDATED,
        AUDIT_EVENT_TYPES.CLASS_LOGIN_DELETED,
        AUDIT_EVENT_TYPES.CLASS_LOGIN_CREDENTIALS_VIEWED,
        AUDIT_EVENT_TYPES.CLASS_LOGIN_DEVICE_LIMIT_CHANGED
    ];
    
    if (!validClassEvents.includes(eventType)) {
        throw new Error(`Invalid class login event type: ${eventType}`);
    }
    
    let description = '';
    switch (eventType) {
        case AUDIT_EVENT_TYPES.CLASS_LOGIN_CREATED:
            description = `Class login ${className} (${classLoginId}) created by ${actorType} ${actorId}`;
            break;
        case AUDIT_EVENT_TYPES.CLASS_LOGIN_UPDATED:
            description = `Class login ${className} (${classLoginId}) updated by ${actorType} ${actorId}`;
            break;
        case AUDIT_EVENT_TYPES.CLASS_LOGIN_DELETED:
            description = `Class login ${className} (${classLoginId}) deleted by ${actorType} ${actorId}`;
            break;
        case AUDIT_EVENT_TYPES.CLASS_LOGIN_CREDENTIALS_VIEWED:
            description = `Class login ${className} (${classLoginId}) credentials viewed by ${actorType} ${actorId}`;
            break;
        case AUDIT_EVENT_TYPES.CLASS_LOGIN_DEVICE_LIMIT_CHANGED:
            description = `Class login ${className} (${classLoginId}) device limit changed by ${actorType} ${actorId}`;
            break;
    }
    
    return logAuditEvent({
        eventType,
        actorId,
        actorType,
        actorIp: ipAddress,
        actorUserAgent: userAgent,
        targetId: classLoginId,
        targetType: 'ClassLogin',
        targetName: className,
        schoolId,
        classLoginId,
        description,
        changes,
        severity: 'medium'
    });
}

/**
 * Logs device management event
 * 
 * @param {Object} params - Device event parameters
 * @returns {Promise<Object>} Audit log entry
 */
async function logDeviceEvent(params) {
    const {
        eventType,
        classLoginId,
        className,
        deviceId,
        schoolId,
        details,
        ipAddress
    } = params;
    
    const validDeviceEvents = [
        AUDIT_EVENT_TYPES.DEVICE_REGISTERED,
        AUDIT_EVENT_TYPES.DEVICE_DEREGISTERED,
        AUDIT_EVENT_TYPES.DEVICE_LIMIT_EXCEEDED,
        AUDIT_EVENT_TYPES.DEVICE_SESSION_CREATED,
        AUDIT_EVENT_TYPES.DEVICE_SESSION_ENDED
    ];
    
    if (!validDeviceEvents.includes(eventType)) {
        throw new Error(`Invalid device event type: ${eventType}`);
    }
    
    let description = '';
    let severity = 'low';
    
    switch (eventType) {
        case AUDIT_EVENT_TYPES.DEVICE_REGISTERED:
            description = `Device ${deviceId} registered for class ${className}`;
            break;
        case AUDIT_EVENT_TYPES.DEVICE_DEREGISTERED:
            description = `Device ${deviceId} deregistered from class ${className}`;
            break;
        case AUDIT_EVENT_TYPES.DEVICE_LIMIT_EXCEEDED:
            description = `Device limit exceeded for class ${className}`;
            severity = 'high';
            break;
        case AUDIT_EVENT_TYPES.DEVICE_SESSION_CREATED:
            description = `Device session created for class ${className}`;
            break;
        case AUDIT_EVENT_TYPES.DEVICE_SESSION_ENDED:
            description = `Device session ended for class ${className}`;
            break;
    }
    
    return logAuditEvent({
        eventType,
        actorId: classLoginId,
        actorType: 'classLogin',
        actorIp: ipAddress,
        targetId: deviceId,
        targetType: 'Device',
        targetName: `Device ${deviceId}`,
        schoolId,
        classLoginId,
        description,
        details,
        severity,
        tags: ['device', 'live-class']
    });
}

/**
 * Logs live class event
 * 
 * @param {Object} params - Live class event parameters
 * @returns {Promise<Object>} Audit log entry
 */
async function logLiveClassEvent(params) {
    const {
        eventType,
        classId,
        className,
        teacherId,
        teacherName,
        participantId,
        participantType,
        schoolId,
        details
    } = params;
    
    const validLiveClassEvents = [
        AUDIT_EVENT_TYPES.LIVE_CLASS_STARTED,
        AUDIT_EVENT_TYPES.LIVE_CLASS_ENDED,
        AUDIT_EVENT_TYPES.LIVE_CLASS_JOINED,
        AUDIT_EVENT_TYPES.LIVE_CLASS_LEFT,
        AUDIT_EVENT_TYPES.LIVE_CLASS_RECORDING_STARTED,
        AUDIT_EVENT_TYPES.LIVE_CLASS_RECORDING_ENDED
    ];
    
    if (!validLiveClassEvents.includes(eventType)) {
        throw new Error(`Invalid live class event type: ${eventType}`);
    }
    
    let description = '';
    let actorId = teacherId;
    let actorType = 'teacher';
    
    switch (eventType) {
        case AUDIT_EVENT_TYPES.LIVE_CLASS_STARTED:
            description = `Live class ${className} started by teacher ${teacherName}`;
            break;
        case AUDIT_EVENT_TYPES.LIVE_CLASS_ENDED:
            description = `Live class ${className} ended by teacher ${teacherName}`;
            break;
        case AUDIT_EVENT_TYPES.LIVE_CLASS_JOINED:
            description = `${participantType} ${participantId} joined live class ${className}`;
            actorId = participantId;
            actorType = participantType;
            break;
        case AUDIT_EVENT_TYPES.LIVE_CLASS_LEFT:
            description = `${participantType} ${participantId} left live class ${className}`;
            actorId = participantId;
            actorType = participantType;
            break;
        case AUDIT_EVENT_TYPES.LIVE_CLASS_RECORDING_STARTED:
            description = `Recording started for live class ${className}`;
            break;
        case AUDIT_EVENT_TYPES.LIVE_CLASS_RECORDING_ENDED:
            description = `Recording ended for live class ${className}`;
            break;
    }
    
    return logAuditEvent({
        eventType,
        actorId,
        actorType,
        targetId: classId,
        targetType: 'LiveClass',
        targetName: className,
        schoolId,
        description,
        details,
        severity: 'low',
        tags: ['live-class', 'video']
    });
}

/**
 * Logs security event
 * 
 * @param {Object} params - Security event parameters
 * @returns {Promise<Object>} Audit log entry
 */
async function logSecurityEvent(params) {
    const {
        eventType,
        description,
        details,
        ipAddress,
        userAgent,
        severity = 'high',
        tags = []
    } = params;
    
    const validSecurityEvents = [
        AUDIT_EVENT_TYPES.SECURITY_ALERT,
        AUDIT_EVENT_TYPES.SUSPICIOUS_ACTIVITY,
        AUDIT_EVENT_TYPES.RATE_LIMIT_TRIGGERED,
        AUDIT_EVENT_TYPES.IP_BLOCKED
    ];
    
    if (!validSecurityEvents.includes(eventType)) {
        throw new Error(`Invalid security event type: ${eventType}`);
    }
    
    return logAuditEvent({
        eventType,
        actorType: 'system',
        actorIp: ipAddress,
        actorUserAgent: userAgent,
        description,
        details,
        status: 'warning',
        severity,
        tags: ['security', ...tags]
    });
}

/**
 * Retrieves audit logs with filtering and pagination
 * 
 * @param {Object} filters - Filter criteria
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Paginated audit logs
 */
async function getAuditLogs(filters = {}, options = {}) {
    const {
        page = 1,
        limit = 50,
        sortBy = 'timestamp',
        sortOrder = 'desc'
    } = options;
    
    // Build query
    const query = {};
    
    // Apply filters
    if (filters.eventType) {
        query.eventType = filters.eventType;
    }
    
    if (filters.eventCategory) {
        query.eventCategory = filters.eventCategory;
    }
    
    if (filters.actorId) {
        query.actorId = filters.actorId;
    }
    
    if (filters.actorType) {
        query.actorType = filters.actorType;
    }
    
    if (filters.schoolId) {
        query.schoolId = filters.schoolId;
    }
    
    if (filters.classLoginId) {
        query.classLoginId = filters.classLoginId;
    }
    
    if (filters.status) {
        query.status = filters.status;
    }
    
    if (filters.severity) {
        query.severity = filters.severity;
    }
    
    if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) {
            query.timestamp.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
            query.timestamp.$lte = new Date(filters.endDate);
        }
    }
    
    if (filters.search) {
        query.$or = [
            { description: { $regex: filters.search, $options: 'i' } },
            { targetName: { $regex: filters.search, $options: 'i' } }
        ];
    }
    
    if (filters.tags && filters.tags.length > 0) {
        query.tags = { $all: filters.tags };
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Execute query
    const [logs, total] = await Promise.all([
        AuditLog.find(query)
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        AuditLog.countDocuments(query)
    ]);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    
    return {
        logs,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
}

/**
 * Gets audit statistics for a time period
 * 
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} groupBy - Grouping field (day, hour, eventType, etc.)
 * @returns {Promise<Object>} Audit statistics
 */
async function getAuditStatistics(startDate, endDate, groupBy = 'day') {
    try {
        const matchStage = {
            timestamp: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        };
        
        let groupStage = {};
        let sortStage = {};
        
        switch (groupBy) {
            case 'hour':
                groupStage = {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' },
                        hour: { $hour: '$timestamp' }
                    }
                };
                sortStage = {
                    '_id.year': 1,
                    '_id.month': 1,
                    '_id.day': 1,
                    '_id.hour': 1
                };
                break;
                
            case 'day':
                groupStage = {
                    _id: {
                        year: { $year: '$timestamp' },
                        month: { $month: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' }
                    }
                };
                sortStage = {
                    '_id.year': 1,
                    '_id.month': 1,
                    '_id.day': 1
                };
                break;
                
            case 'eventType':
                groupStage = { _id: '$eventType' };
                sortStage = { _id: 1 };
                break;
                
            case 'eventCategory':
                groupStage = { _id: '$eventCategory' };
                sortStage = { _id: 1 };
                break;
                
            case 'actorType':
                groupStage = { _id: '$actorType' };
                sortStage = { _id: 1 };
                break;
                
            case 'status':
                groupStage = { _id: '$status' };
                sortStage = { _id: 1 };
                break;
                
            case 'severity':
                groupStage = { _id: '$severity' };
                sortStage = { _id: 1 };
                break;
                
            default:
                throw new Error(`Invalid groupBy parameter: ${groupBy}`);
        }
        
        const pipeline = [
            { $match: matchStage },
            {
                $group: {
                    ...groupStage,
                    count: { $sum: 1 },
                    successes: {
                        $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
                    },
                    failures: {
                        $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] }
                    },
                    warnings: {
                        $sum: { $cond: [{ $eq: ['$status', 'warning'] }, 1, 0] }
                    }
                }
            },
            { $sort: sortStage }
        ];
        
        const results = await AuditLog.aggregate(pipeline);
        
        // Format results based on grouping
        const formattedResults = results.map(result => {
            let label;
            
            switch (groupBy) {
                case 'hour':
                    label = `${result._id.year}-${result._id.month.toString().padStart(2, '0')}-${result._id.day.toString().padStart(2, '0')} ${result._id.hour.toString().padStart(2, '0')}:00`;
                    break;
                case 'day':
                    label = `${result._id.year}-${result._id.month.toString().padStart(2, '0')}-${result._id.day.toString().padStart(2, '0')}`;
                    break;
                default:
                    label = result._id;
            }
            
            return {
                label,
                count: result.count,
                successes: result.successes,
                failures: result.failures,
                warnings: result.warnings
            };
        });
        
        return {
            period: {
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            },
            groupBy,
            total: formattedResults.reduce((sum, item) => sum + item.count, 0),
            results: formattedResults
        };
        
    } catch (error) {
        logger.error('Failed to get audit statistics:', error);
        throw error;
    }
}

/**
 * Creates Express middleware for automatic request auditing
 * 
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware
 */
function createAuditMiddleware(options = {}) {
    const {
        excludePaths = ['/health', '/api/health', '/metrics'],
        excludeMethods = ['OPTIONS', 'HEAD'],
        logSuccess = true,
        logErrors = true,
        sensitiveFields = ['password', 'token', 'secret']
    } = options;
    
    return async function auditMiddleware(req, res, next) {
        // Skip excluded paths and methods
        if (excludePaths.some(path => req.path.startsWith(path)) ||
            excludeMethods.includes(req.method)) {
            return next();
        }
        
        const startTime = Date.now();
        const requestId = req.id || req.headers['x-request-id'];
        
        // Store original response methods
        const originalSend = res.send;
        const originalJson = res.json;
        const originalEnd = res.end;
        
        let responseBody = null;
        
        // Override response methods to capture response
        res.send = function(body) {
            responseBody = body;
            return originalSend.apply(this, arguments);
        };
        
        res.json = function(body) {
            responseBody = body;
            return originalJson.apply(this, arguments);
        };
        
        res.end = function(chunk, encoding) {
            if (chunk) {
                responseBody = chunk;
            }
            return originalEnd.apply(this, arguments);
        };
        
        // Handle response finish
        res.on('finish', async () => {
            const duration = Date.now() - startTime;
            
            try {
                // Determine if we should log this request
                const shouldLog = 
                    (logSuccess && res.statusCode < 400) ||
                    (logErrors && res.statusCode >= 400);
                
                if (!shouldLog) {
                    return;
                }
                
                // Determine event type based on request
                let eventType = 'ADMIN_ACTION';
                if (req.path.includes('/auth/')) {
                    eventType = res.statusCode < 400 ? 'AUTH_LOGIN' : 'AUTH_LOGIN_FAILED';
                } else if (req.path.includes('/class-login/')) {
                    if (req.method === 'POST') eventType = 'CLASS_LOGIN_CREATED';
                    else if (req.method === 'PUT' || req.method === 'PATCH') eventType = 'CLASS_LOGIN_UPDATED';
                    else if (req.method === 'DELETE') eventType = 'CLASS_LOGIN_DELETED';
                } else if (req.path.includes('/device/')) {
                    if (req.method === 'POST') eventType = 'DEVICE_REGISTERED';
                    else if (req.method === 'DELETE') eventType = 'DEVICE_DEREGISTERED';
                } else if (req.path.includes('/live/')) {
                    eventType = 'LIVE_CLASS_JOINED';
                }
                
                // Sanitize request body for sensitive data
                let sanitizedBody = null;
                if (req.body && Object.keys(req.body).length > 0) {
                    sanitizedBody = { ...req.body };
                    sensitiveFields.forEach(field => {
                        if (sanitizedBody[field]) {
                            sanitizedBody[field] = '[REDACTED]';
                        }
                    });
                }
                
                // Prepare audit log
                await logAuditEvent({
                    eventType: AUDIT_EVENT_TYPES[eventType] || AUDIT_EVENT_TYPES.ADMIN_ACTION,
                    actorId: req.user?._id,
                    actorType: req.user?.role || 'anonymous',
                    actorIp: req.ip,
                    actorUserAgent: req.get('user-agent'),
                    requestId,
                    requestPath: req.path,
                    requestMethod: req.method,
                    description: `${req.method} ${req.path} - ${res.statusCode}`,
                    details: {
                        duration: `${duration}ms`,
                        statusCode: res.statusCode,
                        requestBody: sanitizedBody,
                        responseBody: typeof responseBody === 'string' ? 
                            responseBody.substring(0, 500) : // Limit response size
                            responseBody
                    },
                    status: res.statusCode < 400 ? 'success' : 'failure',
                    severity: res.statusCode >= 500 ? 'high' : 
                             res.statusCode >= 400 ? 'medium' : 'low',
                    tags: ['http', 'request']
                });
                
            } catch (error) {
                // Don't let audit logging break the request
                logger.error('Audit middleware failed:', error);
            }
        });
        
        next();
    };
}

/**
 * Cleans up old audit logs (for maintenance)
 * 
 * @param {number} daysToKeep - Number of days to keep logs
 * @returns {Promise<Object>} Cleanup result
 */
async function cleanupOldAuditLogs(daysToKeep = 90) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const result = await AuditLog.deleteMany({
            timestamp: { $lt: cutoffDate }
        });
        
        logger.info('Old audit logs cleaned up', {
            deletedCount: result.deletedCount,
            cutoffDate: cutoffDate.toISOString(),
            daysToKeep
        });
        
        return {
            success: true,
            deletedCount: result.deletedCount,
            cutoffDate: cutoffDate.toISOString()
        };
        
    } catch (error) {
        logger.error('Failed to clean up audit logs:', error);
        throw error;
    }
}

module.exports = {
    // Core functions
    logAuditEvent,
    getAuditLogs,
    getAuditStatistics,
    cleanupOldAuditLogs,
    
    // Specialized logging functions
    logAuthEvent,
    logUserManagementEvent,
    logClassLoginEvent,
    logDeviceEvent,
    logLiveClassEvent,
    logSecurityEvent,
    
    // Middleware
    createAuditMiddleware,
    
    // Models
    AuditLog,
    
    // Constants
    AUDIT_EVENT_TYPES,
    AUDIT_CATEGORIES,
    EVENT_CATEGORY_MAPPING
};
