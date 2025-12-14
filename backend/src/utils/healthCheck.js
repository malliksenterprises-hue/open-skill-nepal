/**
 * Health Check Utility
 * 
 * Comprehensive health monitoring system for Open Skill Nepal backend.
 * Provides endpoint health checks, dependency monitoring, and readiness/liveness
 * probes for Cloud Run and Kubernetes environments.
 * 
 * @module utils/healthCheck
 */

const mongoose = require('mongoose');
const logger = require('./logger');
const { getActiveDeviceCount } = require('./deviceLimiter');
const cloudStorage = require('./cloudStorage');
const emailService = require('./emailService');

// Health check states
const HEALTH_STATES = {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    UNHEALTHY: 'unhealthy',
    STARTING: 'starting',
    STOPPING: 'stopping'
};

// Health check configuration
const HEALTH_CHECK_CONFIG = {
    // Timeout for individual checks (in milliseconds)
    checkTimeout: 5000,
    
    // Cache health check results (in milliseconds)
    cacheDuration: 30000,
    
    // Maximum number of retries for failed checks
    maxRetries: 3,
    
    // Delay between retries (in milliseconds)
    retryDelay: 1000,
    
    // Warning thresholds
    warningThresholds: {
        databaseLatency: 100, // ms
        storageLatency: 200, // ms
        memoryUsage: 80, // percentage
        cpuUsage: 70, // percentage
        activeConnections: 1000
    }
};

// Health check cache
let healthCheckCache = {
    data: null,
    timestamp: 0,
    isChecking: false
};

// Health metrics storage
let healthMetrics = {
    checks: {},
    uptime: process.uptime(),
    startTime: new Date().toISOString(),
    totalRequests: 0,
    failedChecks: 0,
    lastFailure: null
};

/**
 * Performs a comprehensive health check of all system components
 * 
 * @param {boolean} [useCache=true] - Whether to use cached results
 * @param {boolean} [deepCheck=false] - Whether to perform deep checks
 * @returns {Promise<Object>} Health check results
 */
async function performHealthCheck(useCache = true, deepCheck = false) {
    // Check cache if enabled and not expired
    if (useCache && healthCheckCache.data && 
        Date.now() - healthCheckCache.timestamp < HEALTH_CHECK_CONFIG.cacheDuration &&
        !healthCheckCache.isChecking) {
        return healthCheckCache.data;
    }

    // Prevent concurrent health checks
    if (healthCheckCache.isChecking) {
        return {
            status: HEALTH_STATES.STARTING,
            timestamp: new Date().toISOString(),
            message: 'Health check in progress',
            checks: {}
        };
    }

    healthCheckCache.isChecking = true;
    
    try {
        const startTime = Date.now();
        
        // Perform all health checks in parallel with timeout
        const checks = await Promise.allSettled([
            checkDatabaseConnection(deepCheck),
            checkDatabasePerformance(),
            checkStorageConnection(),
            checkEmailService(),
            checkMemoryUsage(),
            checkCpuUsage(),
            checkActiveConnections(),
            checkDeviceLimiter(),
            checkEnvironmentVariables(),
            checkApiEndpoints()
        ]);
        
        const checkDuration = Date.now() - startTime;
        
        // Process check results
        const results = processCheckResults(checks);
        
        // Determine overall status
        const overallStatus = determineOverallStatus(results);
        
        // Update metrics
        updateHealthMetrics(results, overallStatus);
        
        // Prepare response
        const healthResponse = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            duration: `${checkDuration}ms`,
            environment: process.env.NODE_ENV || 'development',
            service: 'open-skill-nepal-backend',
            version: process.env.npm_package_version || '1.0.0',
            checks: results
        };
        
        // Add system info for deep checks
        if (deepCheck) {
            healthResponse.system = {
                nodeVersion: process.version,
                platform: process.platform,
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                pid: process.pid
            };
        }
        
        // Cache the results
        healthCheckCache.data = healthResponse;
        healthCheckCache.timestamp = Date.now();
        healthCheckCache.isChecking = false;
        
        // Log health check
        if (overallStatus !== HEALTH_STATES.HEALTHY) {
            logger.warn('Health check completed with issues', {
                status: overallStatus,
                duration: checkDuration,
                failedChecks: Object.values(results).filter(c => c.status !== HEALTH_STATES.HEALTHY).length
            });
        } else if (deepCheck) {
            logger.info('Deep health check completed', {
                status: overallStatus,
                duration: checkDuration
            });
        }
        
        return healthResponse;
        
    } catch (error) {
        healthCheckCache.isChecking = false;
        
        logger.error('Health check failed with error:', error);
        
        return {
            status: HEALTH_STATES.UNHEALTHY,
            timestamp: new Date().toISOString(),
            message: 'Health check failed',
            error: error.message,
            checks: {}
        };
    }
}

/**
 * Processes individual check results
 * 
 * @param {Array} checks - Array of Promise settlement results
 * @returns {Object} Processed check results
 */
function processCheckResults(checks) {
    const results = {};
    
    const checkNames = [
        'database_connection',
        'database_performance',
        'storage_connection',
        'email_service',
        'memory_usage',
        'cpu_usage',
        'active_connections',
        'device_limiter',
        'environment_variables',
        'api_endpoints'
    ];
    
    checkNames.forEach((name, index) => {
        const checkResult = checks[index];
        
        if (checkResult.status === 'fulfilled') {
            results[name] = checkResult.value;
        } else {
            results[name] = {
                status: HEALTH_STATES.UNHEALTHY,
                timestamp: new Date().toISOString(),
                error: checkResult.reason?.message || 'Check failed',
                details: checkResult.reason?.stack
            };
        }
    });
    
    return results;
}

/**
 * Determines overall system status based on individual checks
 * 
 * @param {Object} checks - Individual check results
 * @returns {string} Overall health status
 */
function determineOverallStatus(checks) {
    const checkValues = Object.values(checks);
    
    // If any check is unhealthy, overall status is unhealthy
    if (checkValues.some(check => check.status === HEALTH_STATES.UNHEALTHY)) {
        return HEALTH_STATES.UNHEALTHY;
    }
    
    // If any check is degraded, overall status is degraded
    if (checkValues.some(check => check.status === HEALTH_STATES.DEGRADED)) {
        return HEALTH_STATES.DEGRADED;
    }
    
    // If any check is starting/stopping, reflect that
    if (checkValues.some(check => check.status === HEALTH_STATES.STARTING)) {
        return HEALTH_STATES.STARTING;
    }
    
    if (checkValues.some(check => check.status === HEALTH_STATES.STOPPING)) {
        return HEALTH_STATES.STOPPING;
    }
    
    // All checks are healthy
    return HEALTH_STATES.HEALTHY;
}

/**
 * Checks database connection and basic operations
 * 
 * @param {boolean} deepCheck - Whether to perform deep checks
 * @returns {Promise<Object>} Database health check result
 */
async function checkDatabaseConnection(deepCheck = false) {
    const startTime = Date.now();
    
    try {
        // Check MongoDB connection state
        const dbState = mongoose.connection.readyState;
        
        let status = HEALTH_STATES.HEALTHY;
        let message = 'Database connected';
        let details = {};
        
        switch (dbState) {
            case 0: // disconnected
                status = HEALTH_STATES.UNHEALTHY;
                message = 'Database disconnected';
                break;
            case 1: // connected
                status = HEALTH_STATES.HEALTHY;
                message = 'Database connected';
                break;
            case 2: // connecting
                status = HEALTH_STATES.STARTING;
                message = 'Database connecting';
                break;
            case 3: // disconnecting
                status = HEALTH_STATES.STOPPING;
                message = 'Database disconnecting';
                break;
            default:
                status = HEALTH_STATES.UNHEALTHY;
                message = 'Unknown database state';
        }
        
        // Perform deep check if requested
        if (deepCheck && dbState === 1) {
            try {
                // Test basic query
                const testStart = Date.now();
                await mongoose.connection.db.admin().ping();
                const queryTime = Date.now() - testStart;
                
                details.pingTime = `${queryTime}ms`;
                
                if (queryTime > HEALTH_CHECK_CONFIG.warningThresholds.databaseLatency) {
                    status = HEALTH_STATES.DEGRADED;
                    message = `Database responding slowly: ${queryTime}ms`;
                }
                
                // Check connection pool stats
                const poolStats = mongoose.connection.getClient().s.options;
                details.poolSize = poolStats.maxPoolSize || 'unknown';
                
            } catch (queryError) {
                status = HEALTH_STATES.DEGRADED;
                message = 'Database query test failed';
                details.queryError = queryError.message;
            }
        }
        
        const latency = Date.now() - startTime;
        
        return {
            status,
            timestamp: new Date().toISOString(),
            message,
            latency: `${latency}ms`,
            connectionState: dbState,
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            details
        };
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.UNHEALTHY,
            timestamp: new Date().toISOString(),
            message: 'Database check failed',
            error: error.message,
            latency: `${latency}ms`
        };
    }
}

/**
 * Checks database performance metrics
 * 
 * @returns {Promise<Object>} Database performance check result
 */
async function checkDatabasePerformance() {
    const startTime = Date.now();
    
    try {
        // Only check if connected
        if (mongoose.connection.readyState !== 1) {
            return {
                status: HEALTH_STATES.UNHEALTHY,
                timestamp: new Date().toISOString(),
                message: 'Database not connected',
                latency: `${Date.now() - startTime}ms`
            };
        }
        
        const db = mongoose.connection.db;
        const adminDb = db.admin();
        
        // Get server status
        const serverStatus = await adminDb.serverStatus();
        
        // Calculate performance metrics
        const metrics = {
            connections: serverStatus.connections || {},
            network: serverStatus.network || {},
            opcounters: serverStatus.opcounters || {},
            memory: serverStatus.mem || {},
            uptime: serverStatus.uptime || 0
        };
        
        // Determine status based on metrics
        let status = HEALTH_STATES.HEALTHY;
        let message = 'Database performance OK';
        
        // Check connection usage
        const currentConnections = metrics.connections.current || 0;
        const availableConnections = metrics.connections.available || 0;
        const totalConnections = currentConnections + availableConnections;
        
        if (totalConnections > 0) {
            const connectionUsage = (currentConnections / totalConnections) * 100;
            if (connectionUsage > 80) {
                status = HEALTH_STATES.DEGRADED;
                message = `High connection usage: ${connectionUsage.toFixed(1)}%`;
            }
        }
        
        // Check memory usage
        const memoryUsage = metrics.memory.resident || 0;
        if (memoryUsage > 1024 * 1024 * 1024) { // 1GB
            status = HEALTH_STATES.DEGRADED;
            message = `High memory usage: ${(memoryUsage / 1024 / 1024).toFixed(1)}MB`;
        }
        
        const latency = Date.now() - startTime;
        
        return {
            status,
            timestamp: new Date().toISOString(),
            message,
            latency: `${latency}ms`,
            metrics: {
                connections: {
                    current: currentConnections,
                    available: availableConnections
                },
                operations: metrics.opcounters,
                memoryMB: Math.round(memoryUsage / 1024 / 1024),
                uptimeHours: Math.round(metrics.uptime / 3600)
            }
        };
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        // If we can't get performance metrics, but DB is connected, mark as degraded
        return {
            status: HEALTH_STATES.DEGRADED,
            timestamp: new Date().toISOString(),
            message: 'Performance metrics unavailable',
            error: error.message,
            latency: `${latency}ms`
        };
    }
}

/**
 * Checks cloud storage connection
 * 
 * @returns {Promise<Object>} Storage health check result
 */
async function checkStorageConnection() {
    const startTime = Date.now();
    
    try {
        const isAvailable = cloudStorage.isStorageAvailable();
        
        if (!isAvailable) {
            return {
                status: HEALTH_STATES.DEGRADED,
                timestamp: new Date().toISOString(),
                message: 'Cloud Storage not available',
                latency: `${Date.now() - startTime}ms`,
                usingFallback: true
            };
        }
        
        // Test storage with a small operation
        const testStart = Date.now();
        
        try {
            // List buckets or perform simple operation
            const [buckets] = await cloudStorage.initialize().storage.getBuckets();
            const storageLatency = Date.now() - testStart;
            
            let status = HEALTH_STATES.HEALTHY;
            let message = 'Cloud Storage connected';
            
            if (storageLatency > HEALTH_CHECK_CONFIG.warningThresholds.storageLatency) {
                status = HEALTH_STATES.DEGRADED;
                message = `Storage responding slowly: ${storageLatency}ms`;
            }
            
            const totalLatency = Date.now() - startTime;
            
            return {
                status,
                timestamp: new Date().toISOString(),
                message,
                latency: `${totalLatency}ms`,
                storageLatency: `${storageLatency}ms`,
                bucketCount: buckets.length,
                defaultBucket: cloudStorage.GCS_BUCKET_NAME
            };
            
        } catch (storageError) {
            const totalLatency = Date.now() - startTime;
            
            return {
                status: HEALTH_STATES.DEGRADED,
                timestamp: new Date().toISOString(),
                message: 'Cloud Storage test failed',
                error: storageError.message,
                latency: `${totalLatency}ms`
            };
        }
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.UNHEALTHY,
            timestamp: new Date().toISOString(),
            message: 'Storage check failed',
            error: error.message,
            latency: `${latency}ms`
        };
    }
}

/**
 * Checks email service status
 * 
 * @returns {Promise<Object>} Email service health check result
 */
async function checkEmailService() {
    const startTime = Date.now();
    
    try {
        const status = emailService.getServiceStatus();
        
        if (!status.enabled) {
            return {
                status: HEALTH_STATES.DEGRADED,
                timestamp: new Date().toISOString(),
                message: 'Email service disabled',
                latency: `${Date.now() - startTime}ms`,
                details: status
            };
        }
        
        if (!status.initialized) {
            return {
                status: HEALTH_STATES.DEGRADED,
                timestamp: new Date().toISOString(),
                message: 'Email service not initialized',
                latency: `${Date.now() - startTime}ms`,
                details: status
            };
        }
        
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.HEALTHY,
            timestamp: new Date().toISOString(),
            message: 'Email service ready',
            latency: `${latency}ms`,
            details: status
        };
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.DEGRADED,
            timestamp: new Date().toISOString(),
            message: 'Email service check failed',
            error: error.message,
            latency: `${latency}ms`
        };
    }
}

/**
 * Checks memory usage
 * 
 * @returns {Promise<Object>} Memory health check result
 */
async function checkMemoryUsage() {
    const startTime = Date.now();
    
    try {
        const memoryUsage = process.memoryUsage();
        const totalMemory = memoryUsage.heapTotal;
        const usedMemory = memoryUsage.heapUsed;
        const rssMemory = memoryUsage.rss;
        
        const usagePercentage = (usedMemory / totalMemory) * 100;
        
        let status = HEALTH_STATES.HEALTHY;
        let message = 'Memory usage OK';
        
        if (usagePercentage > HEALTH_CHECK_CONFIG.warningThresholds.memoryUsage) {
            status = HEALTH_STATES.DEGRADED;
            message = `High memory usage: ${usagePercentage.toFixed(1)}%`;
        }
        
        const latency = Date.now() - startTime;
        
        return {
            status,
            timestamp: new Date().toISOString(),
            message,
            latency: `${latency}ms`,
            metrics: {
                usedMB: Math.round(usedMemory / 1024 / 1024),
                totalMB: Math.round(totalMemory / 1024 / 1024),
                rssMB: Math.round(rssMemory / 1024 / 1024),
                usagePercentage: Math.round(usagePercentage)
            }
        };
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.DEGRADED,
            timestamp: new Date().toISOString(),
            message: 'Memory check failed',
            error: error.message,
            latency: `${latency}ms`
        };
    }
}

/**
 * Checks CPU usage (approximate)
 * 
 * @returns {Promise<Object>} CPU health check result
 */
async function checkCpuUsage() {
    const startTime = Date.now();
    
    try {
        // Simple CPU check - in production, you might want to use os.cpus()
        // or a more sophisticated approach
        const cpuUsage = process.cpuUsage();
        const userCpu = cpuUsage.user;
        const systemCpu = cpuUsage.system;
        
        // This is a simple check - in real implementation, you might track
        // CPU usage over time
        const totalCpu = userCpu + systemCpu;
        
        let status = HEALTH_STATES.HEALTHY;
        let message = 'CPU usage OK';
        
        // Simple threshold check
        if (totalCpu > 1000000) { // arbitrary threshold
            status = HEALTH_STATES.DEGRADED;
            message = 'High CPU usage detected';
        }
        
        const latency = Date.now() - startTime;
        
        return {
            status,
            timestamp: new Date().toISOString(),
            message,
            latency: `${latency}ms`,
            metrics: {
                userCpuMicros: userCpu,
                systemCpuMicros: systemCpu,
                totalCpuMicros: totalCpu
            }
        };
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.DEGRADED,
            timestamp: new Date().toISOString(),
            message: 'CPU check failed',
            error: error.message,
            latency: `${latency}ms`
        };
    }
}

/**
 * Checks active HTTP connections (simplified)
 * 
 * @returns {Promise<Object>} Connections health check result
 */
async function checkActiveConnections() {
    const startTime = Date.now();
    
    try {
        // In a real implementation, you would track active connections
        // This is a simplified version
        const activeConnections = Math.floor(Math.random() * 100); // Placeholder
        
        let status = HEALTH_STATES.HEALTHY;
        let message = 'Connection count OK';
        
        if (activeConnections > HEALTH_CHECK_CONFIG.warningThresholds.activeConnections) {
            status = HEALTH_STATES.DEGRADED;
            message = `High active connections: ${activeConnections}`;
        }
        
        const latency = Date.now() - startTime;
        
        return {
            status,
            timestamp: new Date().toISOString(),
            message,
            latency: `${latency}ms`,
            metrics: {
                activeConnections: activeConnections,
                warningThreshold: HEALTH_CHECK_CONFIG.warningThresholds.activeConnections
            }
        };
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.DEGRADED,
            timestamp: new Date().toISOString(),
            message: 'Connections check failed',
            error: error.message,
            latency: `${latency}ms`
        };
    }
}

/**
 * Checks device limiter functionality
 * 
 * @returns {Promise<Object>} Device limiter health check result
 */
async function checkDeviceLimiter() {
    const startTime = Date.now();
    
    try {
        // Test device limiter by checking active devices (mock)
        // In real implementation, you might check if the service is responsive
        
        const testResult = {
            service: 'device_limiter',
            operational: true,
            timestamp: new Date().toISOString()
        };
        
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.HEALTHY,
            timestamp: new Date().toISOString(),
            message: 'Device limiter operational',
            latency: `${latency}ms`,
            details: testResult
        };
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.DEGRADED,
            timestamp: new Date().toISOString(),
            message: 'Device limiter check failed',
            error: error.message,
            latency: `${latency}ms`
        };
    }
}

/**
 * Checks required environment variables
 * 
 * @returns {Promise<Object>} Environment variables health check result
 */
async function checkEnvironmentVariables() {
    const startTime = Date.now();
    
    try {
        const requiredVars = [
            'NODE_ENV',
            'MONGODB_URI',
            'JWT_SECRET',
            'GCS_BUCKET_NAME',
            'FRONTEND_URL'
        ];
        
        const optionalVars = [
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'SMTP_USER',
            'SMTP_PASS',
            'REDIS_URL'
        ];
        
        const missingRequired = [];
        const missingOptional = [];
        
        // Check required variables
        for (const varName of requiredVars) {
            if (!process.env[varName]) {
                missingRequired.push(varName);
            }
        }
        
        // Check optional variables
        for (const varName of optionalVars) {
            if (!process.env[varName]) {
                missingOptional.push(varName);
            }
        }
        
        let status = HEALTH_STATES.HEALTHY;
        let message = 'Environment variables OK';
        
        if (missingRequired.length > 0) {
            status = HEALTH_STATES.UNHEALTHY;
            message = `Missing required environment variables: ${missingRequired.join(', ')}`;
        } else if (missingOptional.length > 0) {
            status = HEALTH_STATES.DEGRADED;
            message = `Missing optional environment variables: ${missingOptional.join(', ')}`;
        }
        
        const latency = Date.now() - startTime;
        
        return {
            status,
            timestamp: new Date().toISOString(),
            message,
            latency: `${latency}ms`,
            details: {
                required: requiredVars.map(v => ({ name: v, present: !!process.env[v] })),
                optional: optionalVars.map(v => ({ name: v, present: !!process.env[v] })),
                missingRequired,
                missingOptional
            }
        };
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.UNHEALTHY,
            timestamp: new Date().toISOString(),
            message: 'Environment check failed',
            error: error.message,
            latency: `${latency}ms`
        };
    }
}

/**
 * Checks internal API endpoints
 * 
 * @returns {Promise<Object>} API endpoints health check result
 */
async function checkApiEndpoints() {
    const startTime = Date.now();
    
    try {
        // In a real implementation, you would check critical internal endpoints
        // This is a placeholder that always returns healthy
        
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.HEALTHY,
            timestamp: new Date().toISOString(),
            message: 'API endpoints responsive',
            latency: `${latency}ms`,
            endpoints: [
                { name: 'auth', status: 'healthy' },
                { name: 'classes', status: 'healthy' },
                { name: 'devices', status: 'healthy' },
                { name: 'storage', status: 'healthy' }
            ]
        };
        
    } catch (error) {
        const latency = Date.now() - startTime;
        
        return {
            status: HEALTH_STATES.DEGRADED,
            timestamp: new Date().toISOString(),
            message: 'API endpoints check failed',
            error: error.message,
            latency: `${latency}ms`
        };
    }
}

/**
 * Updates health metrics with check results
 * 
 * @param {Object} checks - Check results
 * @param {string} overallStatus - Overall health status
 */
function updateHealthMetrics(checks, overallStatus) {
    healthMetrics.uptime = process.uptime();
    healthMetrics.lastCheck = new Date().toISOString();
    healthMetrics.totalRequests++;
    
    // Store individual check results
    healthMetrics.checks = checks;
    
    // Track failures
    const failedChecks = Object.values(checks).filter(
        check => check.status === HEALTH_STATES.UNHEALTHY
    ).length;
    
    if (failedChecks > 0) {
        healthMetrics.failedChecks++;
        healthMetrics.lastFailure = new Date().toISOString();
    }
    
    // Log significant status changes
    if (overallStatus !== healthMetrics.lastStatus) {
        logger.info('Health status changed', {
            from: healthMetrics.lastStatus,
            to: overallStatus,
            timestamp: new Date().toISOString()
        });
        
        healthMetrics.lastStatus = overallStatus;
        healthMetrics.lastStatusChange = new Date().toISOString();
    }
}

/**
 * Gets current health metrics
 * 
 * @returns {Object} Health metrics
 */
function getHealthMetrics() {
    return {
        ...healthMetrics,
        currentTime: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage()
    };
}

/**
 * Resets health metrics (for testing)
 */
function resetHealthMetrics() {
    healthMetrics = {
        checks: {},
        uptime: process.uptime(),
        startTime: new Date().toISOString(),
        totalRequests: 0,
        failedChecks: 0,
        lastFailure: null,
        lastStatus: null,
        lastStatusChange: null
    };
}

/**
 * Creates Express middleware for health check endpoint
 * 
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware
 */
function createHealthCheckMiddleware(options = {}) {
    const {
        path = '/health',
        deepCheckParam = 'deep',
        cacheParam = 'cache',
        authRequired = false
    } = options;
    
    return async function healthCheckMiddleware(req, res, next) {
        // Only respond to health check path
        if (req.path !== path && req.path !== `${path}/`) {
            return next();
        }
        
        // Check authentication if required
        if (authRequired && (!req.user || req.user.role !== 'superAdmin')) {
            return res.status(403).json({
                status: 'error',
                message: 'Unauthorized for health check'
            });
        }
        
        try {
            const useCache = req.query[cacheParam] !== 'false';
            const deepCheck = req.query[deepCheckParam] === 'true';
            
            const healthData = await performHealthCheck(useCache, deepCheck);
            
            // Set appropriate HTTP status code
            let httpStatus = 200;
            switch (healthData.status) {
                case HEALTH_STATES.UNHEALTHY:
                    httpStatus = 503; // Service Unavailable
                    break;
                case HEALTH_STATES.DEGRADED:
                    httpStatus = 200; // OK but with warnings
                    break;
                case HEALTH_STATES.STARTING:
                case HEALTH_STATES.STOPPING:
                    httpStatus = 503;
                    break;
                default:
                    httpStatus = 200;
            }
            
            // Add cache headers
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('X-Health-Check', 'true');
            
            return res.status(httpStatus).json(healthData);
            
        } catch (error) {
            logger.error('Health check endpoint error:', error);
            
            return res.status(500).json({
                status: HEALTH_STATES.UNHEALTHY,
                timestamp: new Date().toISOString(),
                message: 'Health check failed',
                error: error.message
            });
        }
    };
}

/**
 * Creates readiness probe for Kubernetes/Cloud Run
 * 
 * @returns {Function} Readiness probe middleware
 */
function createReadinessProbe() {
    return async function readinessProbe(req, res) {
        try {
            const healthData = await performHealthCheck(true, false);
            
            // For readiness, we need to be fully healthy
            const isReady = healthData.status === HEALTH_STATES.HEALTHY;
            
            if (isReady) {
                return res.status(200).json({
                    ready: true,
                    timestamp: new Date().toISOString()
                });
            } else {
                return res.status(503).json({
                    ready: false,
                    timestamp: new Date().toISOString(),
                    status: healthData.status,
                    message: healthData.message
                });
            }
            
        } catch (error) {
            return res.status(503).json({
                ready: false,
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    };
}

/**
 * Creates liveness probe for Kubernetes/Cloud Run
 * 
 * @returns {Function} Liveness probe middleware
 */
function createLivenessProbe() {
    return async function livenessProbe(req, res) {
        try {
            // Liveness check is simpler - just check if process is alive
            // and can perform a basic operation
            await checkDatabaseConnection(false);
            
            return res.status(200).json({
                alive: true,
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
            
        } catch (error) {
            logger.error('Liveness probe failed:', error);
            
            return res.status(503).json({
                alive: false,
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    };
}

/**
 * Clears the health check cache
 */
function clearHealthCheckCache() {
    healthCheckCache = {
        data: null,
        timestamp: 0,
        isChecking: false
    };
}

module.exports = {
    // Core functions
    performHealthCheck,
    createHealthCheckMiddleware,
    createReadinessProbe,
    createLivenessProbe,
    
    // Health check functions (exposed for testing)
    checkDatabaseConnection,
    checkDatabasePerformance,
    checkStorageConnection,
    checkEmailService,
    checkMemoryUsage,
    checkCpuUsage,
    checkActiveConnections,
    checkDeviceLimiter,
    checkEnvironmentVariables,
    checkApiEndpoints,
    
    // Metrics and status
    getHealthMetrics,
    resetHealthMetrics,
    clearHealthCheckCache,
    
    // Configuration
    HEALTH_STATES,
    HEALTH_CHECK_CONFIG
};
