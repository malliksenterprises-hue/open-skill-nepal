/**
 * Logger Utility
 * 
 * Centralized logging system for Open Skill Nepal backend.
 * Provides structured logging with different levels, request tracing,
 * and Cloud Run/GCP integration.
 * 
 * @module utils/logger
 */

const winston = require('winston');
const { LoggingWinston } = require('@google-cloud/logging-winston');
const path = require('path');

// Environment detection
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug');

// Service metadata for GCP logging
const SERVICE_NAME = process.env.SERVICE_NAME || 'open-skill-nepal-backend';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const DEPLOYMENT_ENV = process.env.DEPLOYMENT_ENV || NODE_ENV;

// Request ID tracking (for correlating logs across services)
let currentRequestId = null;

/**
 * Formats log entries with consistent structure
 */
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format((info) => {
        // Add service metadata
        info.service = SERVICE_NAME;
        info.version = SERVICE_VERSION;
        info.environment = DEPLOYMENT_ENV;
        
        // Add request ID if available
        if (currentRequestId) {
            info.requestId = currentRequestId;
        }
        
        // Add deployment metadata in production
        if (IS_PRODUCTION) {
            info.deployment = {
                region: process.env.GCP_REGION || 'unknown',
                project: process.env.GOOGLE_CLOUD_PROJECT || 'unknown'
            };
        }
        
        return info;
    })(),
    IS_PRODUCTION 
        ? winston.format.json() // JSON for production
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                let logMessage = `${timestamp} ${level}: ${message}`;
                
                // Add metadata if present
                if (Object.keys(meta).length > 0) {
                    // Remove internal fields from display
                    const { service, version, environment, deployment, ...displayMeta } = meta;
                    
                    if (Object.keys(displayMeta).length > 0) {
                        logMessage += ` ${JSON.stringify(displayMeta, null, 2)}`;
                    }
                }
                
                return logMessage;
            })
        )
);

/**
 * Creates transports based on environment
 */
function createTransports() {
    const transports = [];
    
    // Console transport for all environments
    transports.push(
        new winston.transports.Console({
            level: LOG_LEVEL,
            handleExceptions: true,
            handleRejections: true
        })
    );
    
    // File transport for production (in addition to console)
    if (IS_PRODUCTION) {
        // Error log file
        transports.push(
            new winston.transports.File({
                filename: path.join(process.cwd(), 'logs', 'error.log'),
                level: 'error',
                maxsize: 5242880, // 5MB
                maxFiles: 5,
                tailable: true
            })
        );
        
        // Combined log file
        transports.push(
            new winston.transports.File({
                filename: path.join(process.cwd(), 'logs', 'combined.log'),
                level: 'info',
                maxsize: 5242880, // 5MB
                maxFiles: 5,
                tailable: true
            })
        );
        
        // Google Cloud Logging for production
        try {
            const loggingWinston = new LoggingWinston({
                level: 'info',
                logName: `${SERVICE_NAME}-logs`,
                serviceContext: {
                    service: SERVICE_NAME,
                    version: SERVICE_VERSION
                },
                labels: {
                    environment: DEPLOYMENT_ENV
                }
            });
            
            transports.push(loggingWinston);
        } catch (error) {
            // Log but don't fail if GCP logging fails
            console.error('Failed to initialize Google Cloud Logging:', error.message);
        }
    }
    
    return transports;
}

/**
 * Create logger instance
 */
const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: logFormat,
    transports: createTransports(),
    exitOnError: false,
    defaultMeta: {
        service: SERVICE_NAME,
        environment: DEPLOYMENT_ENV
    }
});

/**
 * Sets the current request ID for log correlation
 * 
 * @param {string} requestId - Request ID to associate with logs
 */
function setRequestId(requestId) {
    currentRequestId = requestId;
}

/**
 * Gets the current request ID
 * 
 * @returns {string|null} Current request ID
 */
function getRequestId() {
    return currentRequestId;
}

/**
 * Generates a unique request ID
 * 
 * @returns {string} Unique request ID
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Structured logging methods with context support
 */

/**
 * Logs an error with context
 * 
 * @param {string} message - Error message
 * @param {Object} context - Additional context information
 * @param {Error} [error] - Error object (optional)
 */
function error(message, context = {}, error = null) {
    const logData = {
        ...context,
        message
    };
    
    if (error) {
        logData.error = {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code
        };
    }
    
    logger.error(logData);
}

/**
 * Logs a warning with context
 * 
 * @param {string} message - Warning message
 * @param {Object} context - Additional context information
 */
function warn(message, context = {}) {
    logger.warn({ ...context, message });
}

/**
 * Logs an informational message with context
 * 
 * @param {string} message - Info message
 * @param {Object} context - Additional context information
 */
function info(message, context = {}) {
    logger.info({ ...context, message });
}

/**
 * Logs a debug message with context
 * 
 * @param {string} message - Debug message
 * @param {Object} context - Additional context information
 */
function debug(message, context = {}) {
    logger.debug({ ...context, message });
}

/**
 * Logs an HTTP request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} responseTime - Response time in milliseconds
 */
function logHttpRequest(req, res, responseTime) {
    const logContext = {
        httpRequest: {
            requestMethod: req.method,
            requestUrl: req.originalUrl,
            requestSize: req.headers['content-length'] || '0',
            status: res.statusCode,
            responseSize: res.get('content-length') || '0',
            userAgent: req.get('user-agent'),
            remoteIp: req.ip,
            referer: req.get('referer') || '',
            latency: `${responseTime / 1000}s`,
            protocol: req.protocol
        },
        userId: req.user?._id,
        userRole: req.user?.role,
        schoolId: req.user?.schoolId,
        classLoginId: req.user?.classLoginId
    };
    
    // Filter sensitive headers
    const headers = { ...req.headers };
    delete headers.authorization;
    delete headers.cookie;
    delete headers['x-access-token'];
    
    logContext.headers = headers;
    
    // Determine log level based on status code
    if (res.statusCode >= 500) {
        logger.error('HTTP Request Error', logContext);
    } else if (res.statusCode >= 400) {
        logger.warn('HTTP Client Error', logContext);
    } else {
        logger.info('HTTP Request', logContext);
    }
}

/**
 * Logs database operation
 * 
 * @param {string} operation - Database operation (find, insert, update, delete)
 * @param {string} collection - Collection name
 * @param {Object} query - Query object
 * @param {number} duration - Operation duration in milliseconds
 * @param {Error} [error] - Error if operation failed
 */
function logDatabaseOperation(operation, collection, query, duration, error = null) {
    const logData = {
        operation,
        collection,
        duration: `${duration}ms`,
        query: sanitizeQuery(query)
    };
    
    if (error) {
        logData.error = error.message;
        logger.error('Database operation failed', logData);
    } else {
        logger.debug('Database operation', logData);
    }
}

/**
 * Logs authentication event
 * 
 * @param {string} event - Authentication event (login, logout, token_refresh, etc.)
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @param {boolean} success - Whether authentication was successful
 * @param {string} [reason] - Reason for failure if not successful
 * @param {string} [ip] - Client IP address
 */
function logAuthEvent(event, userId, userRole, success, reason = null, ip = null) {
    const logData = {
        event,
        userId,
        userRole,
        success,
        ip,
        timestamp: new Date().toISOString()
    };
    
    if (reason) {
        logData.reason = reason;
    }
    
    if (success) {
        logger.info('Authentication event', logData);
    } else {
        logger.warn('Authentication failed', logData);
    }
}

/**
 * Logs device management event
 * 
 * @param {string} event - Device event (register, disconnect, limit_exceeded, etc.)
 * @param {string} classLoginId - Class Login ID
 * @param {string} deviceId - Device ID
 * @param {Object} [metadata] - Additional metadata
 */
function logDeviceEvent(event, classLoginId, deviceId, metadata = {}) {
    const logData = {
        event,
        classLoginId,
        deviceId,
        ...metadata,
        timestamp: new Date().toISOString()
    };
    
    logger.info('Device event', logData);
}

/**
 * Logs live class event
 * 
 * @param {string} event - Live class event (start, end, join, leave, etc.)
 * @param {string} classId - Class ID
 * @param {string} teacherId - Teacher ID
 * @param {Object} [metadata] - Additional metadata
 */
function logLiveClassEvent(event, classId, teacherId, metadata = {}) {
    const logData = {
        event,
        classId,
        teacherId,
        ...metadata,
        timestamp: new Date().toISOString()
    };
    
    logger.info('Live class event', logData);
}

/**
 * Sanitizes query object for logging (removes sensitive data)
 * 
 * @param {Object} query - Query object to sanitize
 * @returns {Object} Sanitized query
 */
function sanitizeQuery(query) {
    if (!query || typeof query !== 'object') {
        return query;
    }
    
    const sanitized = { ...query };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'ssn'];
    
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });
    
    // Recursively sanitize nested objects
    Object.keys(sanitized).forEach(key => {
        if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeQuery(sanitized[key]);
        }
    });
    
    return sanitized;
}

/**
 * Creates a child logger with additional metadata
 * 
 * @param {Object} metadata - Additional metadata to include in all logs
 * @returns {Object} Child logger instance
 */
function createChildLogger(metadata) {
    const childLogger = {
        error: (message, context = {}, error = null) => 
            logger.error({ ...metadata, ...context, message }, error),
        warn: (message, context = {}) => 
            logger.warn({ ...metadata, ...context, message }),
        info: (message, context = {}) => 
            logger.info({ ...metadata, ...context, message }),
        debug: (message, context = {}) => 
            logger.debug({ ...metadata, ...context, message }),
        logHttpRequest: (req, res, responseTime) => 
            logHttpRequest(req, res, responseTime),
        logDatabaseOperation: (operation, collection, query, duration, error) =>
            logDatabaseOperation(operation, collection, query, duration, error),
        logAuthEvent: (event, userId, userRole, success, reason, ip) =>
            logAuthEvent(event, userId, userRole, success, reason, ip),
        logDeviceEvent: (event, classLoginId, deviceId, metadata) =>
            logDeviceEvent(event, classLoginId, deviceId, { ...metadata, ...metadata }),
        logLiveClassEvent: (event, classId, teacherId, metadata) =>
            logLiveClassEvent(event, classId, teacherId, { ...metadata, ...metadata })
    };
    
    return childLogger;
}

/**
 * Middleware to add request ID and log HTTP requests
 * 
 * @returns {Function} Express middleware
 */
function requestLoggerMiddleware() {
    return function(req, res, next) {
        const requestId = req.headers['x-request-id'] || generateRequestId();
        setRequestId(requestId);
        
        // Add request ID to response headers
        res.setHeader('X-Request-ID', requestId);
        
        // Store request start time
        const startTime = Date.now();
        
        // Log response when finished
        res.on('finish', () => {
            const responseTime = Date.now() - startTime;
            logHttpRequest(req, res, responseTime);
        });
        
        next();
    };
}

/**
 * Performance logging utility
 * 
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to measure
 * @param {Object} context - Context information
 * @returns {Promise<any>} Function result
 */
async function measurePerformance(operation, fn, context = {}) {
    const startTime = Date.now();
    
    try {
        const result = await fn();
        const duration = Date.now() - startTime;
        
        if (duration > 1000) { // Log slow operations (>1s)
            logger.warn('Slow operation detected', {
                operation,
                duration: `${duration}ms`,
                ...context
            });
        } else if (logger.isDebugEnabled()) {
            logger.debug('Operation completed', {
                operation,
                duration: `${duration}ms`,
                ...context
            });
        }
        
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Operation failed', {
            operation,
            duration: `${duration}ms`,
            error: error.message,
            ...context
        });
        throw error;
    }
}

module.exports = {
    // Winston logger instance
    logger,
    
    // Request ID management
    setRequestId,
    getRequestId,
    generateRequestId,
    
    // Structured logging methods
    error,
    warn,
    info,
    debug,
    
    // Specialized logging methods
    logHttpRequest,
    logDatabaseOperation,
    logAuthEvent,
    logDeviceEvent,
    logLiveClassEvent,
    
    // Utility methods
    createChildLogger,
    requestLoggerMiddleware,
    measurePerformance,
    sanitizeQuery,
    
    // Configuration
    LOG_LEVEL,
    IS_PRODUCTION,
    IS_TEST
};
