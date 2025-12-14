/**
 * Routes Index
 * 
 * Centralized route configuration and management for Open Skill Nepal backend.
 * Exports all route modules and provides route utilities.
 * 
 * @module routes/index
 */

const express = require('express');
const logger = require('../utils/logger');
const { validateRole } = require('../middleware/validationMiddleware');
const { asyncHandler } = require('../utils/errorHandler');

// Import route modules
const authRoutes = require('./authRoutes');
const schoolRoutes = require('./schoolRoutes');
const teacherRoutes = require('./teacherRoutes');
const classLoginRoutes = require('./classLoginRoutes');
const deviceRoutes = require('./deviceRoutes');
const liveRoutes = require('./liveRoutes');
const adminRoutes = require('./adminRoutes');
const contentRoutes = require('./contentRoutes');

/**
 * Route configuration object mapping
 */
const ROUTE_CONFIG = {
    // Public routes (no authentication required)
    public: [
        {
            path: '/auth',
            module: authRoutes,
            description: 'Authentication endpoints'
        },
        {
            path: '/health',
            handler: (req, res) => res.json({ status: 'ok' }),
            description: 'Health check endpoint'
        }
    ],
    
    // Protected routes (require authentication)
    protected: [
        {
            path: '/schools',
            module: schoolRoutes,
            description: 'School management endpoints',
            requiredRoles: ['superAdmin', 'admin', 'schoolAdmin']
        },
        {
            path: '/teachers',
            module: teacherRoutes,
            description: 'Teacher management endpoints',
            requiredRoles: ['superAdmin', 'admin', 'schoolAdmin']
        },
        {
            path: '/class-logins',
            module: classLoginRoutes,
            description: 'Class login management endpoints',
            requiredRoles: ['superAdmin', 'admin', 'schoolAdmin', 'teacher']
        },
        {
            path: '/devices',
            module: deviceRoutes,
            description: 'Device management endpoints',
            requiredRoles: ['superAdmin', 'admin', 'schoolAdmin', 'teacher', 'classLogin']
        },
        {
            path: '/live',
            module: liveRoutes,
            description: 'Live class endpoints',
            requiredRoles: ['superAdmin', 'admin', 'teacher', 'classLogin']
        },
        {
            path: '/content',
            module: contentRoutes,
            description: 'Content management endpoints',
            requiredRoles: ['superAdmin', 'admin', 'teacher', 'student']
        },
        {
            path: '/admin',
            module: adminRoutes,
            description: 'Administrative endpoints',
            requiredRoles: ['superAdmin', 'admin']
        }
    ]
};

/**
 * Creates and configures Express router with all routes
 * 
 * @param {Object} app - Express application
 * @returns {express.Router} Configured router
 */
function configureRoutes(app) {
    const router = express.Router();
    
    logger.info('Configuring application routes...');
    
    // Configure public routes
    ROUTE_CONFIG.public.forEach(route => {
        if (route.module) {
            router.use(route.path, route.module);
            logger.debug(`Public route configured: ${route.path}`, {
                description: route.description
            });
        } else if (route.handler) {
            router.get(route.path, route.handler);
            logger.debug(`Public handler configured: ${route.path}`);
        }
    });
    
    // Configure protected routes
    ROUTE_CONFIG.protected.forEach(route => {
        if (route.module) {
            // Apply role-based authentication middleware
            const middleware = [
                validateRole(route.requiredRoles),
                route.module
            ];
            
            router.use(route.path, ...middleware);
            
            logger.debug(`Protected route configured: ${route.path}`, {
                description: route.description,
                requiredRoles: route.requiredRoles
            });
        }
    });
    
    // Add route information endpoint (for debugging and documentation)
    router.get('/routes', validateRole(['superAdmin', 'admin']), (req, res) => {
        const routes = getRouteInfo();
        res.json({
            success: true,
            data: routes,
            timestamp: new Date().toISOString()
        });
    });
    
    // Add route statistics endpoint
    router.get('/routes/stats', validateRole(['superAdmin', 'admin']), asyncHandler(async (req, res) => {
        const stats = await getRouteStatistics();
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    }));
    
    logger.info('Route configuration complete', {
        publicRoutes: ROUTE_CONFIG.public.length,
        protectedRoutes: ROUTE_CONFIG.protected.length,
        totalRoutes: ROUTE_CONFIG.public.length + ROUTE_CONFIG.protected.length
    });
    
    return router;
}

/**
 * Gets information about all configured routes
 * 
 * @returns {Object} Route information
 */
function getRouteInfo() {
    const routes = {
        public: [],
        protected: []
    };
    
    // Process public routes
    ROUTE_CONFIG.public.forEach(route => {
        routes.public.push({
            path: route.path,
            description: route.description,
            type: 'public',
            methods: getRouteMethods(route.module)
        });
    });
    
    // Process protected routes
    ROUTE_CONFIG.protected.forEach(route => {
        routes.protected.push({
            path: route.path,
            description: route.description,
            type: 'protected',
            requiredRoles: route.requiredRoles,
            methods: getRouteMethods(route.module)
        });
    });
    
    return routes;
}

/**
 * Extracts HTTP methods from a route module
 * 
 * @param {express.Router} routeModule - Express router
 * @returns {Array} Array of HTTP methods
 */
function getRouteMethods(routeModule) {
    if (!routeModule || !routeModule.stack) {
        return ['GET']; // Default for simple handlers
    }
    
    const methods = new Set();
    
    // Recursively traverse route stack
    function traverseLayer(layer) {
        if (layer.route) {
            // This is a route layer
            const routeMethods = Object.keys(layer.route.methods)
                .filter(method => layer.route.methods[method])
                .map(method => method.toUpperCase());
            
            routeMethods.forEach(method => methods.add(method));
        } else if (layer.name === 'router' && layer.handle.stack) {
            // This is a router layer, traverse its stack
            layer.handle.stack.forEach(traverseLayer);
        }
    }
    
    routeModule.stack.forEach(traverseLayer);
    
    return Array.from(methods);
}

/**
 * Gets route usage statistics
 * 
 * @returns {Promise<Object>} Route statistics
 */
async function getRouteStatistics() {
    // In a production system, this would query analytics or monitoring data
    // For now, return basic statistics
    
    const stats = {
        totalRequests: 0,
        requestsByRoute: {},
        requestsByMethod: {
            GET: 0,
            POST: 0,
            PUT: 0,
            DELETE: 0,
            PATCH: 0
        },
        requestsByRole: {},
        errorRate: 0,
        mostPopularRoutes: [],
        leastPopularRoutes: []
    };
    
    // This would be populated from monitoring data
    // For now, return placeholder structure
    
    return stats;
}

/**
 * Middleware to log route access (for analytics)
 * 
 * @returns {Function} Express middleware
 */
function createRouteAccessLogger() {
    return asyncHandler(async (req, res, next) => {
        const startTime = Date.now();
        const requestId = req.id || req.headers['x-request-id'];
        
        // Store original end method to capture response time
        const originalEnd = res.end;
        
        res.end = function(chunk, encoding) {
            const duration = Date.now() - startTime;
            
            // Log route access (async, don't block response)
            logRouteAccess(req, res, duration, requestId).catch(error => {
                logger.error('Failed to log route access:', error);
            });
            
            // Call original end method
            originalEnd.call(this, chunk, encoding);
        };
        
        next();
    });
}

/**
 * Logs route access for analytics
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {number} duration - Request duration in milliseconds
 * @param {string} requestId - Request ID
 */
async function logRouteAccess(req, res, duration, requestId) {
    try {
        const routeInfo = {
            requestId,
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            originalUrl: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('user-agent'),
            ip: req.ip,
            userId: req.user?._id,
            userRole: req.user?.role,
            schoolId: req.user?.schoolId,
            classLoginId: req.user?.classLoginId
        };
        
        // Log to monitoring system (in production, this would go to analytics DB)
        logger.debug('Route access logged', routeInfo);
        
    } catch (error) {
        // Don't let analytics logging break the request
        logger.error('Error in route access logging:', error);
    }
}

/**
 * Validates route parameters against schema
 * 
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
function validateRouteParams(schema) {
    return asyncHandler(async (req, res, next) => {
        try {
            // Combine params, query, and body for validation
            const data = {
                params: req.params,
                query: req.query,
                body: req.body
            };
            
            // Validate against schema
            await schema.validateAsync(data, {
                abortEarly: false,
                stripUnknown: true
            });
            
            next();
        } catch (error) {
            // Format validation errors
            const validationErrors = error.details?.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            })) || [{ message: error.message }];
            
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }
    });
}

/**
 * Rate limiting configuration per route
 */
const ROUTE_RATE_LIMITS = {
    // Authentication routes
    '/auth/login': 'authLimiter',
    '/auth/register': 'authLimiter',
    '/auth/reset-password': 'authLimiter',
    
    // Device registration
    '/devices/register': 'deviceRegistrationLimiter',
    
    // Live class routes
    '/live/join': 'liveClassLimiter',
    '/live/control': 'liveClassLimiter',
    
    // File uploads
    '/content/upload': 'uploadLimiter',
    
    // Admin operations
    '/admin/*': 'adminLimiter'
};

/**
 * Gets rate limiter for a specific route
 * 
 * @param {string} routePath - Route path
 * @returns {string} Rate limiter name
 */
function getRateLimiterForRoute(routePath) {
    for (const [pattern, limiter] of Object.entries(ROUTE_RATE_LIMITS)) {
        if (pattern.endsWith('*')) {
            const basePattern = pattern.slice(0, -1); // Remove *
            if (routePath.startsWith(basePattern)) {
                return limiter;
            }
        } else if (routePath === pattern) {
            return limiter;
        }
    }
    
    return 'apiLimiter'; // Default limiter
}

/**
 * Creates route documentation in OpenAPI/Swagger format
 * 
 * @returns {Object} OpenAPI documentation
 */
function createOpenAPIDocumentation() {
    const documentation = {
        openapi: '3.0.0',
        info: {
            title: 'Open Skill Nepal API',
            description: 'Backend API for Open Skill Nepal platform',
            version: '1.0.0',
            contact: {
                name: 'Open Skill Nepal Team',
                email: 'support@openskillnepal.com'
            }
        },
        servers: [
            {
                url: process.env.API_BASE_URL || 'http://localhost:3001/api',
                description: 'Development server'
            }
        ],
        tags: [
            {
                name: 'Authentication',
                description: 'User authentication and authorization'
            },
            {
                name: 'Schools',
                description: 'School management operations'
            },
            {
                name: 'Teachers',
                description: 'Teacher management operations'
            },
            {
                name: 'Class Logins',
                description: 'Class login management for live classes'
            },
            {
                name: 'Devices',
                description: 'Device management and limiting'
            },
            {
                name: 'Live Classes',
                description: 'Live class streaming and interaction'
            },
            {
                name: 'Content',
                description: 'Study materials and content management'
            },
            {
                name: 'Admin',
                description: 'Administrative operations'
            }
        ],
        paths: {},
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                // Common schemas would be defined here
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string' },
                        errors: { type: 'array', items: { type: 'object' } },
                        timestamp: { type: 'string', format: 'date-time' }
                    }
                }
            }
        }
    };
    
    // Add security requirement
    documentation.security = [{ bearerAuth: [] }];
    
    return documentation;
}

/**
 * Route health check utility
 * 
 * @returns {Promise<Object>} Route health status
 */
async function checkRouteHealth() {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        routes: []
    };
    
    // Check each route module
    for (const route of [...ROUTE_CONFIG.public, ...ROUTE_CONFIG.protected]) {
        if (route.module && typeof route.module.healthCheck === 'function') {
            try {
                const routeHealth = await route.module.healthCheck();
                health.routes.push({
                    path: route.path,
                    status: routeHealth.status || 'healthy',
                    message: routeHealth.message
                });
                
                if (routeHealth.status === 'unhealthy') {
                    health.status = 'degraded';
                }
            } catch (error) {
                health.routes.push({
                    path: route.path,
                    status: 'unhealthy',
                    message: error.message
                });
                health.status = 'unhealthy';
            }
        }
    }
    
    return health;
}

/**
 * Exports all route modules for external use
 */
module.exports = {
    // Route modules
    authRoutes,
    schoolRoutes,
    teacherRoutes,
    classLoginRoutes,
    deviceRoutes,
    liveRoutes,
    adminRoutes,
    contentRoutes,
    
    // Route configuration
    ROUTE_CONFIG,
    configureRoutes,
    
    // Route utilities
    getRouteInfo,
    getRouteStatistics,
    createRouteAccessLogger,
    validateRouteParams,
    getRateLimiterForRoute,
    createOpenAPIDocumentation,
    checkRouteHealth,
    
    // Route middleware
    routeAccessLogger: createRouteAccessLogger()
};
