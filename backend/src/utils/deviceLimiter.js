/**
 * Device Limiter Utility
 * 
 * Enforces device limits for Class Logins during live class access.
 * Tracks active devices, prevents session hijacking, and ensures
 * compliance with admin-configured device limits.
 * 
 * @module utils/deviceLimiter
 */

const Device = require('../models/Device');
const ClassLogin = require('../models/ClassLogin');
const logger = require('./logger');

/**
 * @typedef {Object} DeviceCheckResult
 * @property {boolean} allowed - Whether device access is permitted
 * @property {string} reason - Reason for denial (if not allowed)
 * @property {Device|null} existingDevice - Existing device record if found
 */

/**
 * @typedef {Object} DeviceInfo
 * @property {string} userAgent - Browser/user agent string
 * @property {string} ipAddress - Client IP address
 * @property {string} [deviceId] - Unique device identifier from client
 * @property {string} [fingerprint] - Browser fingerprint
 */

/**
 * Validates if a device can access a live class based on Class Login device limits
 * 
 * @param {string} classLoginId - MongoDB ObjectId of the Class Login
 * @param {DeviceInfo} deviceInfo - Device information from the request
 * @param {string} sessionId - Current session ID
 * @returns {Promise<DeviceCheckResult>} Result of device validation
 */
async function checkDeviceAccess(classLoginId, deviceInfo, sessionId) {
    try {
        // Validate input parameters
        if (!classLoginId || !deviceInfo || !sessionId) {
            logger.warn('Device limiter: Missing required parameters', {
                classLoginId: !!classLoginId,
                deviceInfo: !!deviceInfo,
                sessionId: !!sessionId
            });
            return {
                allowed: false,
                reason: 'Missing required authentication data',
                existingDevice: null
            };
        }

        // Find the Class Login and its device limit
        const classLogin = await ClassLogin.findById(classLoginId)
            .select('deviceLimit isActive')
            .lean();

        if (!classLogin) {
            return {
                allowed: false,
                reason: 'Class login not found',
                existingDevice: null
            };
        }

        if (!classLogin.isActive) {
            return {
                allowed: false,
                reason: 'Class login is deactivated',
                existingDevice: null
            };
        }

        const deviceLimit = classLogin.deviceLimit || 1; // Default to 1 if not set

        // Generate device fingerprint if not provided
        const fingerprint = deviceInfo.fingerprint || 
                           generateDeviceFingerprint(deviceInfo);

        // Check for existing active device sessions
        const existingDevices = await Device.find({
            classLogin: classLoginId,
            isActive: true,
            expiresAt: { $gt: new Date() }
        }).sort({ lastActive: -1 });

        // Check if this specific device already has an active session
        const existingDevice = existingDevices.find(device => 
            device.fingerprint === fingerprint || 
            (deviceInfo.deviceId && device.deviceId === deviceInfo.deviceId)
        );

        if (existingDevice) {
            // Update existing device session
            existingDevice.lastActive = new Date();
            existingDevice.sessionId = sessionId;
            existingDevice.userAgent = deviceInfo.userAgent;
            existingDevice.ipAddress = deviceInfo.ipAddress;
            await existingDevice.save();

            return {
                allowed: true,
                reason: 'Existing device session renewed',
                existingDevice: existingDevice
            };
        }

        // Check if device limit has been reached
        if (existingDevices.length >= deviceLimit) {
            // Invalidate oldest session to make room for new one (FIFO)
            const oldestDevice = existingDevices[existingDevices.length - 1];
            oldestDevice.isActive = false;
            oldestDevice.endedAt = new Date();
            oldestDevice.endReason = 'device_limit_exceeded';
            await oldestDevice.save();

            logger.info('Device limit exceeded, invalidated oldest session', {
                classLoginId,
                deviceLimit,
                invalidatedDeviceId: oldestDevice._id
            });
        }

        // Create new device session
        const newDevice = new Device({
            classLogin: classLoginId,
            sessionId: sessionId,
            userAgent: deviceInfo.userAgent,
            ipAddress: deviceInfo.ipAddress,
            deviceId: deviceInfo.deviceId,
            fingerprint: fingerprint,
            isActive: true,
            lastActive: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });

        await newDevice.save();

        return {
            allowed: true,
            reason: 'New device session created',
            existingDevice: newDevice
        };

    } catch (error) {
        logger.error('Error in device access check:', {
            error: error.message,
            stack: error.stack,
            classLoginId
        });
        
        // Fail open for production stability, but log extensively
        // In production, you might want to fail closed based on security requirements
        return {
            allowed: true, // Fail open to prevent service disruption
            reason: 'System error, access granted for stability',
            existingDevice: null
        };
    }
}

/**
 * Ends a device session (logout, manual disconnect, or timeout)
 * 
 * @param {string} deviceId - Device record ID or session ID
 * @param {string} [endReason='manual'] - Reason for ending session
 * @returns {Promise<boolean>} Success status
 */
async function endDeviceSession(deviceId, endReason = 'manual') {
    try {
        const device = await Device.findOne({
            $or: [
                { _id: deviceId },
                { sessionId: deviceId }
            ],
            isActive: true
        });

        if (!device) {
            logger.warn('Device session not found for termination', { deviceId });
            return false;
        }

        device.isActive = false;
        device.endedAt = new Date();
        device.endReason = endReason;
        await device.save();

        logger.info('Device session ended', {
            deviceId: device._id,
            classLoginId: device.classLogin,
            endReason,
            duration: device.endedAt - device.createdAt
        });

        return true;
    } catch (error) {
        logger.error('Error ending device session:', {
            error: error.message,
            deviceId
        });
        return false;
    }
}

/**
 * Cleans up expired device sessions (cron job)
 * 
 * @returns {Promise<{cleaned: number}>} Number of cleaned sessions
 */
async function cleanupExpiredSessions() {
    try {
        const result = await Device.updateMany(
            {
                $or: [
                    { expiresAt: { $lt: new Date() } },
                    { isActive: false, endedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } // Cleanup inactive after 7 days
                ]
            },
            {
                $set: { isActive: false },
                $currentDate: { endedAt: true }
            }
        );

        logger.info('Cleaned up expired device sessions', {
            cleaned: result.modifiedCount,
            timestamp: new Date().toISOString()
        });

        return { cleaned: result.modifiedCount };
    } catch (error) {
        logger.error('Error cleaning up expired sessions:', error);
        return { cleaned: 0, error: error.message };
    }
}

/**
 * Gets active device count for a Class Login
 * 
 * @param {string} classLoginId - Class Login ID
 * @returns {Promise<number>} Number of active devices
 */
async function getActiveDeviceCount(classLoginId) {
    try {
        const count = await Device.countDocuments({
            classLogin: classLoginId,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });
        return count;
    } catch (error) {
        logger.error('Error getting active device count:', {
            error: error.message,
            classLoginId
        });
        return 0;
    }
}

/**
 * Generates a consistent device fingerprint from available information
 * 
 * @param {DeviceInfo} deviceInfo - Device information
 * @returns {string} Generated fingerprint hash
 */
function generateDeviceFingerprint(deviceInfo) {
    try {
        const components = [
            deviceInfo.userAgent || '',
            deviceInfo.ipAddress || '',
            deviceInfo.deviceId || ''
        ].join('|');

        // Simple hash for fingerprinting
        let hash = 0;
        for (let i = 0; i < components.length; i++) {
            const char = components.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        return `fp_${Math.abs(hash).toString(16)}`;
    } catch (error) {
        // Fallback to random fingerprint if generation fails
        return `fp_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Middleware for Express routes that require device limit enforcement
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function deviceLimitMiddleware(req, res, next) {
    // This middleware assumes req.user is set by auth middleware
    // and contains classLoginId for Class Login users
    
    if (!req.user || req.user.role !== 'classLogin') {
        return next(); // Skip device limiting for non-class-login users
    }

    const deviceInfo = {
        userAgent: req.headers['user-agent'] || '',
        ipAddress: req.ip || req.connection.remoteAddress,
        deviceId: req.headers['x-device-id'] || req.cookies?.deviceId
    };

    req.deviceInfo = deviceInfo;
    next();
}

module.exports = {
    checkDeviceAccess,
    endDeviceSession,
    cleanupExpiredSessions,
    getActiveDeviceCount,
    generateDeviceFingerprint,
    deviceLimitMiddleware
};
