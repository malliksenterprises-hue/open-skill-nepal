/**
 * Error Handler Utility
 * 
 * Centralized error handling for the Open Skill Nepal backend.
 * Provides consistent error responses, logging, and error recovery.
 * 
 * @module utils/errorHandler
 */

const logger = require('./logger');
const { isCelebrateError } = require('celebrate');
const mongoose = require('mongoose');

/**
 * Custom error classes for different error types
 */
class AppError extends Error {
    constructor(message, statusCode, isOperational = true, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.code = code;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, errors = []) {
        super(message, 400, true, 'VALIDATION_ERROR');
        this.errors = errors;
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401, true, 'AUTH_ERROR');
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, true, 'AUTHORIZATION_ERROR');
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, true, 'NOT_FOUND');
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409, true, 'CONFLICT');
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 429, true, 'RATE_LIMIT');
    }
}

class DatabaseError extends AppError {
    constructor(message = 'Database operation failed') {
        super(message, 500, false, 'DATABASE_ERROR');
    }
}

class ExternalServiceError extends AppError {
    constructor(service, message = 'External service error') {
        super(`${service}: ${message}`, 502, true, 'EXTERNAL_SERVICE_ERROR');
        this.service = service;
    }
}

/**
 * Error codes mapping for common scenarios
 */
const ERROR_CODES = {
    // Authentication & Authorization
    INVALID_TOKEN: 'AUTH_001',
    EXPIRED_TOKEN: 'AUTH_002',
    INVALID_CREDENTIALS: 'AUTH_003',
    ACCOUNT_LOCKED: 'AUTH_004',
    INSUFFICIENT_PERMISSIONS: 'AUTH_005',
    
    // Validation
    MISSING_FIELD: 'VAL_001',
    INVALID_FORMAT: 'VAL_002',
    OUT_OF_RANGE: 'VAL_003',
    DUPLICATE_ENTRY: 'VAL_004',
    
    // Resources
    NOT_FOUND: 'RES_001',
    ALREADY_EXISTS: 'RES_002',
    CONFLICT: 'RES_003',
    
    // Device & Limits
    DEVICE_LIMIT_EXCEEDED: 'DEV_001',
    INVALID_DEVICE: 'DEV_002',
    SESSION_EXPIRED: 'DEV_003',
    
    // System
    DATABASE_ERROR: 'SYS_001',
    EXTERNAL_SERVICE: 'SYS_002',
    RATE_LIMIT: 'SYS_003',
    MAINTENANCE: 'SYS_004'
};

/**
 * Formats error response for API clients
 * 
 * @param {Error} error - Error object
 * @returns {Object} Formatted error response
 */
function formatErrorResponse(error) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const baseResponse = {
        success: false,
        message: error.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString()
    };
    
    // Add error code if available
    if (error.code) {
        baseResponse.code = error.code;
    } else if (error.name) {
        baseResponse.code = error.name;
    }
    
    // Add validation errors if present
    if (error.errors && Array.isArray(error.errors)) {
        baseResponse.errors = error.errors;
    }
    
    // Add stack trace in development
    if (!isProduction && error.stack) {
        baseResponse.stack = error.stack.split('\n');
    }
    
    // Add request ID if available
    if (global.requestId) {
        baseResponse.requestId = global.requestId;
    }
    
    // Handle specific error types
    if (error instanceof ValidationError) {
        baseResponse.type = 'validation';
        if (error.errors) {
            baseResponse.details = error.errors;
        }
    } else if (error instanceof AuthenticationError) {
        baseResponse.type = 'authentication';
        baseResponse.suggestion = 'Please check your credentials or login again';
    } else if (error instanceof AuthorizationError) {
        baseResponse.type = 'authorization';
        baseResponse.suggestion = 'Contact your administrator for access';
    } else if (error instanceof NotFoundError) {
        baseResponse.type = 'not_found';
    } else if (error instanceof RateLimitError) {
        baseResponse.type = 'rate_limit';
        if (error.retryAfter) {
            baseResponse.retryAfter = error.retryAfter;
        }
    }
    
    return baseResponse;
}

/**
 * Logs error with appropriate level and details
 * 
 * @param {Error} error - Error object
 * @param {Object} context - Additional context information
 */
function logError(error, context = {}) {
    const logData = {
        error: {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
        },
        context: {
            ...context,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV
        }
    };
    
    // Determine log level based on error type
    if (error.isOperational === false) {
        // Programming errors or unknown errors
        logger.error('Non-operational error occurred', logData);
    } else if (error.statusCode >= 500) {
        // Server errors
        logger.error('Server error occurred', logData);
    } else if (error.statusCode >= 400) {
        // Client errors
        logger.warn('Client error occurred', {
            ...logData,
            // Don't log full stack for client errors in production
            error: { ...logData.error, stack: undefined }
        });
    } else {
        logger.info('Operational error occurred', {
            ...logData,
            error: { ...logData.error, stack: undefined }
        });
    }
}

/**
 * Global error handling middleware for Express
 * 
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function globalErrorHandler(error, req, res, next) {
    // Set default status code
    error.statusCode = error.statusCode || 500;
    error.status = error.status || 'error';
    
    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
        error = new AuthenticationError('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
        error = new AuthenticationError('Token expired');
    }
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError' && error.errors) {
        const validationErrors = Object.values(error.errors).map(err => ({
            field: err.path,
            message: err.message,
            type: err.kind
        }));
        error = new ValidationError('Validation failed', validationErrors);
    }
    
    // Handle Mongoose duplicate key errors
    if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        error = new ConflictError(`${field} already exists`);
    }
    
    // Handle Celebrate (Joi) validation errors
    if (isCelebrateError(error)) {
        const validationErrors = [];
        error.details.forEach((detail) => {
            detail.details.forEach((err) => {
                validationErrors.push({
                    field: err.path.join('.'),
                    message: err.message,
                    type: err.type
                });
            });
        });
        error = new ValidationError('Request validation failed', validationErrors);
    }
    
    // Handle MongoDB connection errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
        error = new DatabaseError('Database connection failed');
    }
    
    // Handle CastError (invalid ObjectId)
    if (error.name === 'CastError') {
        error = new ValidationError(`Invalid ${error.path}: ${error.value}`);
    }
    
    // Log the error
    logError(error, {
        requestId: req.id || global.requestId,
        path: req.path,
        method: req.method,
        userId: req.user?._id,
        userRole: req.user?.role,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    
    // Send error response
    const errorResponse = formatErrorResponse(error);
    
    // Include retry-after header for rate limit errors
    if (error instanceof RateLimitError && error.retryAfter) {
        res.set('Retry-After', error.retryAfter.toString());
    }
    
    res.status(error.statusCode).json(errorResponse);
}

/**
 * Async error handler wrapper for Express routes
 * Catches async errors and passes them to globalErrorHandler
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function with error handling
 */
function asyncHandler(fn) {
    return function(req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Creates a 404 handler for undefined routes
 * 
 * @returns {Function} 404 error handler middleware
 */
function createNotFoundHandler() {
    return function(req, res, next) {
        const error = new NotFoundError(`Route ${req.method} ${req.path}`);
        next(error);
    };
}

/**
 * Graceful shutdown handler for Cloud Run
 * Handles SIGTERM and SIGINT signals
 */
function setupGracefulShutdown(server) {
    const shutdown = async (signal) => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        
        try {
            // Close server
            server.close(() => {
                logger.info('HTTP server closed');
            });
            
            // Close database connections
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.close();
                logger.info('MongoDB connection closed');
            }
            
            // Close Redis connections if exists
            if (global.redisClient) {
                await global.redisClient.quit();
                logger.info('Redis connection closed');
            }
            
            logger.info('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            logger.error('Error during graceful shutdown:', error);
            process.exit(1);
        }
    };
    
    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        logError(error, { type: 'uncaughtException' });
        // Don't exit immediately in production, let the process continue
        if (process.env.NODE_ENV === 'production') {
            logger.error('Uncaught exception, continuing...');
        } else {
            process.exit(1);
        }
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        logError(reason instanceof Error ? reason : new Error(String(reason)), {
            type: 'unhandledRejection',
            promise: promise.toString()
        });
    });
}

/**
 * Health check error handler
 * Returns detailed error information for health checks
 * 
 * @param {Error} error - Error object
 * @returns {Object} Health check error response
 */
function formatHealthCheckError(error) {
    return {
        status: 'error',
        timestamp: new Date().toISOString(),
        checks: {
            database: {
                status: 'error',
                error: error.message,
                code: error.code
            }
        }
    };
}

/**
 * Validation error formatter for consistent error messages
 * 
 * @param {Array} errors - Array of validation errors
 * @returns {Object} Formatted validation error
 */
function formatValidationErrors(errors) {
    return new ValidationError('Validation failed', errors.map(err => ({
        field: err.field || err.path,
        message: err.message,
        value: err.value,
        constraint: err.type
    })));
}

module.exports = {
    // Error Classes
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    DatabaseError,
    ExternalServiceError,
    
    // Error Codes
    ERROR_CODES,
    
    // Functions
    formatErrorResponse,
    logError,
    globalErrorHandler,
    asyncHandler,
    createNotFoundHandler,
    setupGracefulShutdown,
    formatHealthCheckError,
    formatValidationErrors,
    
    // Helper to check if error is operational
    isOperationalError: (error) => {
        return error.isOperational === true;
    }
};
