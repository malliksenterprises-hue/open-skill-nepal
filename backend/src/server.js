/**
 * Open Skill Nepal - Backend Server
 * 
 * Main Express.js server configuration and startup for Open Skill Nepal platform.
 * Integrates all middleware, routes, and utilities for production deployment.
 * 
 * @module server
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

// Core utilities
const logger = require('./utils/logger');
const errorHandler = require('./utils/errorHandler');
const healthCheck = require('./utils/healthCheck');
const auditLogger = require('./utils/auditLogger');
const securityMiddleware = require('./middleware/securityMiddleware');
const rateLimiter = require('./middleware/rateLimiter');
const database = require('./config/database');
const emailService = require('./utils/emailService');

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Create Express application
const app = express();

// Server state tracking
let server = null;
let isShuttingDown = false;

/**
 * Configure Express application middleware
 */
function configureMiddleware() {
    logger.info('Configuring middleware...');
    
    // Trust proxy (for Cloud Run, Vercel, etc.)
    app.set('trust proxy', 1);
    
    // Security middleware (comprehensive setup)
    securityMiddleware.setupSecurityMiddleware(app);
    
    // Request parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());
    
    // Compression (gzip)
    app.use(compression({
        level: 6,
        threshold: 1024, // Compress responses larger than 1KB
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression.filter(req, res);
        }
    }));
    
    // Request logging
    app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev', {
        stream: {
            write: (message) => logger.info(message.trim())
        },
        skip: (req) => req.path === '/health' || req.path === '/api/health'
    }));
    
    // Request ID and logging middleware
    app.use(logger.requestLoggerMiddleware());
    
    // Rate limiting headers
    app.use(rateLimiter.rateLimitHeaders);
    
    // Audit logging middleware (for security-relevant requests)
    app.use(auditLogger.createAuditMiddleware({
        excludePaths: ['/health', '/api/health', '/ready', '/live', '/metrics'],
        excludeMethods: ['OPTIONS', 'HEAD'],
        sensitiveFields: ['password', 'token', 'secret', 'refreshToken']
    }));
    
    // Database middleware (attaches db helpers to request)
    app.use(database.databaseMiddleware());
    
    logger.info('Middleware configuration complete');
}

/**
 * Configure application routes
 */
function configureRoutes() {
    logger.info('Configuring routes...');
    
    // Health check endpoints (no auth required)
    app.use('/health', healthCheck.createHealthCheckMiddleware());
    app.use('/ready', healthCheck.createReadinessProbe());
    app.use('/live', healthCheck.createLivenessProbe());
    
    // API routes (will be mounted by route modules)
    app.use('/api', (req, res, next) => {
        // API version header
        res.setHeader('X-API-Version', '1.0');
        res.setHeader('X-Service', 'open-skill-nepal-backend');
        next();
    });
    
    // Placeholder for API route modules
    // These will be added by route configuration files
    app.use('/api/auth', require('./routes/authRoutes'));
    app.use('/api/schools', require('./routes/schoolRoutes'));
    app.use('/api/teachers', require('./routes/teacherRoutes'));
    app.use('/api/class-logins', require('./routes/classLoginRoutes'));
    app.use('/api/devices', require('./routes/deviceRoutes'));
    app.use('/api/live', require('./routes/liveRoutes'));
    app.use('/api/admin', require('./routes/adminRoutes'));
    app.use('/api/content', require('./routes/contentRoutes'));
    
    // 404 handler for undefined routes
    app.use('*', errorHandler.createNotFoundHandler());
    
    // Global error handler (must be last)
    app.use(errorHandler.globalErrorHandler);
    
    logger.info('Route configuration complete');
}

/**
 * Initialize core services
 */
async function initializeServices() {
    logger.info('Initializing services...');
    
    try {
        // 1. Initialize database connection
        logger.info('Initializing database connection...');
        await database.connectDatabase();
        
        // 2. Create database indexes
        if (process.env.CREATE_INDEXES !== 'false') {
            await database.createDatabaseIndexes();
        }
        
        // 3. Initialize email service
        logger.info('Initializing email service...');
        await emailService.initializeEmailService();
        
        // 4. Log successful initialization
        logger.info('All services initialized successfully');
        
        // 5. Log system startup event
        await auditLogger.logAuditEvent({
            eventType: auditLogger.AUDIT_EVENT_TYPES.SYSTEM_STARTUP,
            actorType: 'system',
            description: 'Open Skill Nepal backend server started',
            details: {
                environment: NODE_ENV,
                port: PORT,
                host: HOST,
                nodeVersion: process.version,
                platform: process.platform
            },
            status: 'success',
            severity: 'low',
            tags: ['system', 'startup']
        });
        
    } catch (error) {
        logger.error('Failed to initialize services:', error);
        throw error;
    }
}

/**
 * Start the Express server
 */
async function startServer() {
    if (server) {
        logger.warn('Server already started');
        return server;
    }
    
    try {
        // Configure middleware and routes
        configureMiddleware();
        configureRoutes();
        
        // Initialize services
        await initializeServices();
        
        // Create HTTP server
        server = app.listen(PORT, HOST, () => {
            logger.info('Open Skill Nepal backend server started', {
                environment: NODE_ENV,
                port: PORT,
                host: HOST,
                pid: process.pid,
                nodeVersion: process.version,
                frontendUrl: FRONTEND_URL
            });
            
            // Log server information
            console.log('\n' + '='.repeat(60));
            console.log('Open Skill Nepal - Backend Server');
            console.log('='.repeat(60));
            console.log(`Environment: ${NODE_ENV}`);
            console.log(`Server: http://${HOST}:${PORT}`);
            console.log(`Frontend: ${FRONTEND_URL}`);
            console.log(`Health: http://${HOST}:${PORT}/health`);
            console.log(`Ready: http://${HOST}:${PORT}/ready`);
            console.log(`Live: http://${HOST}:${PORT}/live`);
            console.log('='.repeat(60) + '\n');
            
            // Emit custom event for testing/monitoring
            app.emit('server_started', {
                timestamp: new Date().toISOString(),
                port: PORT,
                host: HOST
            });
        });
        
        // Configure server timeouts
        server.keepAliveTimeout = 65000; // 65 seconds
        server.headersTimeout = 66000; // 66 seconds (slightly longer than keepAliveTimeout)
        
        // Handle server errors
        server.on('error', (error) => {
            logger.error('Server error:', {
                error: error.message,
                code: error.code,
                syscall: error.syscall,
                address: error.address,
                port: error.port
            });
            
            // In production, we might want to exit and let Cloud Run restart
            if (IS_PRODUCTION && error.code === 'EADDRINUSE') {
                logger.error('Port already in use. Exiting...');
                process.exit(1);
            }
        });
        
        // Handle graceful shutdown
        setupGracefulShutdown();
        
        return server;
        
    } catch (error) {
        logger.error('Failed to start server:', error);
        
        // Attempt graceful shutdown if partially started
        await shutdownServer();
        
        throw error;
    }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown() {
    if (!server) return;
    
    // SIGTERM is used by Cloud Run and Kubernetes
    process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM signal, starting graceful shutdown...');
        await shutdownServer();
    });
    
    // SIGINT is used by Ctrl+C in development
    process.on('SIGINT', async () => {
        logger.info('Received SIGINT signal, starting graceful shutdown...');
        await shutdownServer();
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
        logger.error('Uncaught exception:', {
            error: error.message,
            stack: error.stack,
            name: error.name
        });
        
        if (!isShuttingDown) {
            await shutdownServer(1);
        }
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled promise rejection:', {
            reason: reason?.message || reason,
            promise: promise.toString()
        });
    });
    
    logger.info('Graceful shutdown handlers configured');
}

/**
 * Shutdown the server gracefully
 * 
 * @param {number} exitCode - Process exit code
 */
async function shutdownServer(exitCode = 0) {
    if (isShuttingDown) {
        logger.info('Shutdown already in progress');
        return;
    }
    
    isShuttingDown = true;
    
    try {
        logger.info('Starting graceful shutdown sequence...');
        
        // 1. Log shutdown event
        await auditLogger.logAuditEvent({
            eventType: auditLogger.AUDIT_EVENT_TYPES.SYSTEM_SHUTDOWN,
            actorType: 'system',
            description: 'Open Skill Nepal backend server shutting down',
            details: {
                reason: exitCode === 0 ? 'normal' : 'error',
                exitCode,
                uptime: process.uptime()
            },
            status: 'success',
            severity: 'low',
            tags: ['system', 'shutdown']
        });
        
        // 2. Close HTTP server (stop accepting new connections)
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        logger.error('Error closing HTTP server:', error);
                        reject(error);
                    } else {
                        logger.info('HTTP server closed');
                        resolve();
                    }
                });
                
                // Force close after timeout
                setTimeout(() => {
                    logger.warn('Server close timeout, forcing shutdown');
                    resolve();
                }, 10000);
            });
        }
        
        // 3. Close database connection
        try {
            await database.disconnectDatabase();
            logger.info('Database connection closed');
        } catch (error) {
            logger.error('Error closing database connection:', error);
        }
        
        // 4. Close any other connections (Redis, etc.)
        if (rateLimiter.redisClient && rateLimiter.isRedisAvailable()) {
            try {
                await rateLimiter.redisClient.quit();
                logger.info('Redis connection closed');
            } catch (error) {
                logger.error('Error closing Redis connection:', error);
            }
        }
        
        // 5. Log shutdown completion
        logger.info('Graceful shutdown completed', {
            exitCode,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
        
        // 6. Exit process
        if (exitCode !== 0) {
            process.exit(exitCode);
        } else {
            process.exit(0);
        }
        
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}

/**
 * Get server status and health information
 * 
 * @returns {Object} Server status
 */
function getServerStatus() {
    return {
        status: server && server.listening ? 'running' : 'stopped',
        environment: NODE_ENV,
        port: PORT,
        host: HOST,
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: database.getConnectionStatus(),
        emailService: emailService.getServiceStatus(),
        timestamp: new Date().toISOString()
    };
}

/**
 * Get server metrics for monitoring
 * 
 * @returns {Object} Server metrics
 */
function getServerMetrics() {
    const memoryUsage = process.memoryUsage();
    
    return {
        process: {
            uptime: process.uptime(),
            memory: {
                rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
                external: Math.round(memoryUsage.external / 1024 / 1024) // MB
            },
            cpu: process.cpuUsage(),
            pid: process.pid
        },
        server: {
            listening: server ? server.listening : false,
            address: server ? server.address() : null,
            connections: server ? server._connections : 0
        },
        timestamp: new Date().toISOString()
    };
}

// Export for testing and programmatic usage
module.exports = {
    app,
    startServer,
    shutdownServer,
    getServerStatus,
    getServerMetrics,
    
    // For testing
    configureMiddleware,
    configureRoutes,
    initializeServices
};

// Start server if this file is run directly
if (require.main === module) {
    startServer().catch((error) => {
        logger.error('Failed to start server:', error);
        process.exit(1);
    });
  }
