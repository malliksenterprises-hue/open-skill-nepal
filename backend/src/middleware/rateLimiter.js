/**
 * Rate Limiter Middleware
 * 
 * Implements rate limiting for API endpoints to prevent abuse and ensure
 * fair resource usage. Different limits are applied based on:
 * - User role (higher roles = higher limits)
 * - Endpoint criticality
 * - Authentication status
 * 
 * @module middleware/rateLimiter
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Redis configuration for distributed rate limiting (Cloud Run compatible)
const REDIS_URL = process.env.REDIS_URL || process.env.REDISHOST || 'redis://localhost:6379';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Redis client for production, use memory store for development
let redisClient = null;
let store = null;

if (NODE_ENV === 'production' && REDIS_URL) {
    try {
        redisClient = new Redis(REDIS_URL, {
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            connectTimeout: 10000
        });

        redisClient.on('error', (err) => {
            logger.error('Redis connection error in rate limiter:', err);
        });

        redisClient.on('connect', () => {
            logger.info('Redis connected for rate limiting');
        });

        store = new RedisStore({
            client: redisClient,
            prefix: 'ratelimit:',
            // Expire keys after 1 day (cleanup)
            expiry: 24 * 60 * 60
        });
    } catch (error) {
        logger.error('Failed to initialize Redis for rate limiting:', error);
        store = null;
    }
}

/**
 * Base rate limiter configuration
 */
const baseLimiterConfig = {
    store: store, // Use Redis in production, memory in development
    windowMs: 15 * 60 * 1000, // 15 minutes
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    headers: true,
    legacyHeaders: false,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    message: {
        success: false,
        message: 'Too many requests, please try again later.',
        retryAfter: null
    },
    handler: (req, res, next, options) => {
        const retryAfter = Math.ceil(options.windowMs / 1000);
        options.message.retryAfter = retryAfter;
        
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            userId: req.user?._id,
            role: req.user?.role,
            retryAfter
        });
        
        return res.status(429).json(options.message);
    },
    keyGenerator: (req) => {
        // Generate key based on IP + userId + endpoint for better tracking
        const ip = req.ip || req.connection.remoteAddress;
        const userId = req.user?._id || 'anonymous';
        const path = req.path;
        return `${ip}:${userId}:${path}`;
    },
    skip: (req) => {
        // Skip rate limiting for super admins in development
        if (NODE_ENV === 'development' && req.user?.role === 'superAdmin') {
            return true;
        }
        // Skip health checks
        if (req.path === '/health' || req.path === '/api/health') {
            return true;
        }
        return false;
    }
};

/**
 * Rate limiters for different user roles and endpoints
 */

/**
 * Strict limiter for authentication endpoints (login, registration)
 * Prevents brute force attacks
 */
const authLimiter = rateLimit({
    ...baseLimiterConfig,
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: (req) => {
        // Stricter limits for unauthenticated requests
        return 10; // 10 attempts per 5 minutes
    },
    message: {
        ...baseLimiterConfig.message,
        message: 'Too many authentication attempts. Please try again later.'
    }
});

/**
 * Standard API limiter for most endpoints
 */
const apiLimiter = rateLimit({
    ...baseLimiterConfig,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
        // Different limits based on user role
        if (!req.user) return 50; // Unauthenticated
        
        switch (req.user.role) {
            case 'superAdmin':
                return 1000; // Highest limit
            case 'admin':
                return 500;
            case 'teacher':
                return 300;
            case 'schoolAdmin':
                return 200;
            case 'classLogin':
                return 100; // Class login specific limit
            case 'student':
                return 100;
            default:
                return 50;
        }
    }
});

/**
 * Live class endpoints limiter
 * Higher limits for real-time interaction
 */
const liveClassLimiter = rateLimit({
    ...baseLimiterConfig,
    windowMs: 1 * 60 * 1000, // 1 minute (shorter window for real-time)
    max: (req) => {
        if (!req.user) return 20;
        
        switch (req.user.role) {
            case 'teacher':
                return 200; // Teachers need higher limits for control
            case 'classLogin':
                return 100; // Class login for student interactions
            default:
                return 30;
        }
    },
    message: {
        ...baseLimiterConfig.message,
        message: 'Too many live class requests. Please slow down.'
    }
});

/**
 * File upload limiter
 * Prevents storage abuse
 */
const uploadLimiter = rateLimit({
    ...baseLimiterConfig,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: (req) => {
        if (!req.user) return 5;
        
        switch (req.user.role) {
            case 'teacher':
                return 50; // Teachers upload more content
            case 'admin':
            case 'superAdmin':
                return 100;
            default:
                return 10;
        }
    },
    message: {
        ...baseLimiterConfig.message,
        message: 'Too many file uploads. Please try again later.'
    }
});

/**
 * Device registration limiter
 * Prevents abuse of device registration system
 */
const deviceRegistrationLimiter = rateLimit({
    ...baseLimiterConfig,
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: (req) => {
        // Very strict for device registration to prevent spam
        return 5; // 5 registrations per 10 minutes per IP/user
    },
    message: {
        ...baseLimiterConfig.message,
        message: 'Too many device registration attempts.'
    }
});

/**
 * Admin operations limiter
 * Higher limits for administrative tasks
 */
const adminLimiter = rateLimit({
    ...baseLimiterConfig,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
        // Only apply to admin roles
        if (!req.user || !['superAdmin', 'admin'].includes(req.user.role)) {
            return 0; // Non-admins get 0 limit (effectively blocked)
        }
        
        return req.user.role === 'superAdmin' ? 500 : 300;
    },
    skip: (req) => {
        // Skip if not an admin endpoint
        const adminPaths = ['/api/admin/', '/api/schools/', '/api/teachers/'];
        const isAdminPath = adminPaths.some(path => req.path.startsWith(path));
        return !isAdminPath;
    }
});

/**
 * Dynamic rate limiter that adapts based on request characteristics
 * 
 * @param {Object} options - Custom options for the limiter
 * @returns {Function} Rate limiter middleware
 */
function createDynamicLimiter(options = {}) {
    return rateLimit({
        ...baseLimiterConfig,
        windowMs: options.windowMs || 15 * 60 * 1000,
        max: (req) => {
            // Base limit
            let limit = options.max || 100;
            
            // Adjust based on authentication
            if (req.user) {
                if (req.user.role === 'superAdmin') limit *= 5;
                else if (req.user.role === 'admin') limit *= 3;
                else if (req.user.role === 'teacher') limit *= 2;
            }
            
            // Adjust for specific endpoints
            if (req.path.includes('/api/live/')) {
                limit = Math.min(limit, 200); // Cap for live endpoints
            }
            
            return limit;
        },
        ...options
    });
}

/**
 * Gets rate limit status for monitoring
 * 
 * @param {string} key - Rate limit key
 * @returns {Promise<Object|null>} Rate limit status or null
 */
async function getRateLimitStatus(key) {
    if (!store || !store.increment) {
        return null;
    }
    
    try {
        // This is implementation-specific for rate-limit-redis
        // In practice, you might need to query Redis directly
        const redisKey = `ratelimit:${key}`;
        const current = await redisClient.get(redisKey);
        
        return {
            current: current ? parseInt(current) : 0,
            key: redisKey,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error getting rate limit status:', error);
        return null;
    }
}

/**
 * Resets rate limit for a specific key (admin function)
 * 
 * @param {string} key - Rate limit key to reset
 * @returns {Promise<boolean>} Success status
 */
async function resetRateLimit(key) {
    if (!store || !redisClient) {
        return false;
    }
    
    try {
        const redisKey = `ratelimit:${key}`;
        await redisClient.del(redisKey);
        
        logger.info('Rate limit reset', { key: redisKey });
        return true;
    } catch (error) {
        logger.error('Error resetting rate limit:', error);
        return false;
    }
}

/**
 * Middleware to add rate limit headers to response
 * Useful for client-side rate limit awareness
 */
function rateLimitHeaders(req, res, next) {
    // These headers will be added by express-rate-limit when standardHeaders: true
    // This middleware adds additional custom headers
    
    res.setHeader('X-RateLimit-Policy', 'dynamic-role-based');
    res.setHeader('X-RateLimit-Version', '1.0');
    
    if (req.user) {
        res.setHeader('X-RateLimit-Role', req.user.role);
    }
    
    next();
}

/**
 * Emergency rate limiter for high-traffic situations
 * Can be enabled during DDoS attacks or traffic spikes
 */
const emergencyLimiter = rateLimit({
    ...baseLimiterConfig,
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Very strict limit
    message: {
        ...baseLimiterConfig.message,
        message: 'Service experiencing high traffic. Please try again shortly.'
    },
    skip: (req) => {
        // Never skip emergency limiter unless health check
        return req.path === '/health' || req.path === '/api/health';
    }
});

/**
 * Configures which rate limiter to use based on route
 * 
 * @param {string} path - Request path
 * @returns {Function} Appropriate rate limiter middleware
 */
function getLimiterForPath(path) {
    if (path.startsWith('/api/auth/')) {
        return authLimiter;
    } else if (path.startsWith('/api/live/')) {
        return liveClassLimiter;
    } else if (path.startsWith('/api/upload/') || path.includes('/upload')) {
        return uploadLimiter;
    } else if (path.startsWith('/api/device/') || path.includes('/device-register')) {
        return deviceRegistrationLimiter;
    } else if (path.startsWith('/api/admin/')) {
        return adminLimiter;
    } else {
        return apiLimiter;
    }
}

/**
 * Global rate limit configuration export
 */
module.exports = {
    // Rate limiters
    authLimiter,
    apiLimiter,
    liveClassLimiter,
    uploadLimiter,
    deviceRegistrationLimiter,
    adminLimiter,
    emergencyLimiter,
    
    // Functions
    createDynamicLimiter,
    getLimiterForPath,
    getRateLimitStatus,
    resetRateLimit,
    rateLimitHeaders,
    
    // Configuration
    baseLimiterConfig,
    
    // Redis client for external use (if needed)
    redisClient: redisClient,
    
    // Helper to check if Redis is available
    isRedisAvailable: () => {
        return redisClient && redisClient.status === 'ready';
    }
};
