/**
 * Open Skill Nepal - Backend Entry Point
 * 
 * Main entry point for the Open Skill Nepal backend application.
 * Handles environment setup, error handling, and server startup.
 * 
 * @module index
 */

// Load environment variables first
require('dotenv').config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : 
        process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
});

// Set up global error handling before any other imports
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(error.name, error.message);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

// Import core modules
const server = require('./server');
const logger = require('./utils/logger');
const database = require('./config/database');
const healthCheck = require('./utils/healthCheck');
const { AppError } = require('./utils/errorHandler');

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Validates required environment variables
 */
function validateEnvironment() {
  logger.info('Validating environment configuration...');
  
  const requiredVariables = [
    'NODE_ENV',
    'MONGODB_URI',
    'JWT_SECRET',
    'GCS_BUCKET_NAME',
    'FRONTEND_URL'
  ];
  
  const missingVariables = requiredVariables.filter(
    variable => !process.env[variable]
  );
  
  if (missingVariables.length > 0) {
    throw new AppError(
      `Missing required environment variables: ${missingVariables.join(', ')}`,
      500,
      true,
      'ENVIRONMENT_ERROR'
    );
  }
  
  // Validate MongoDB URI format
  if (!process.env.MONGODB_URI.startsWith('mongodb://') && 
      !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    throw new AppError(
      'Invalid MONGODB_URI format. Must start with mongodb:// or mongodb+srv://',
      500,
      true,
      'ENVIRONMENT_ERROR'
    );
  }
  
  // Validate JWT secret length
  if (process.env.JWT_SECRET.length < 32) {
    throw new AppError(
      'JWT_SECRET must be at least 32 characters long for security',
      500,
      true,
      'ENVIRONMENT_ERROR'
    );
  }
  
  logger.info('Environment validation passed', {
    environment: NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid
  });
}

/**
 * Sets up global application configuration
 */
function setupApplicationConfig() {
  logger.info('Setting up application configuration...');
  
  // Set global application name
  global.APP_NAME = 'Open Skill Nepal';
  global.APP_VERSION = process.env.npm_package_version || '1.0.0';
  
  // Set global request ID for correlation
  global.requestId = null;
  
  // Configure process settings
  process.title = `open-skill-nepal-backend-${NODE_ENV}`;
  
  // Increase max listeners for event-heavy applications
  process.setMaxListeners(20);
  
  // Set memory limits (helpful for debugging)
  if (NODE_ENV === 'development') {
    const v8 = require('v8');
    const heapStatistics = v8.getHeapStatistics();
    logger.debug('V8 Heap Statistics:', {
      totalHeapSize: Math.round(heapStatistics.total_heap_size / 1024 / 1024) + 'MB',
      usedHeapSize: Math.round(heapStatistics.used_heap_size / 1024 / 1024) + 'MB',
      heapSizeLimit: Math.round(heapStatistics.heap_size_limit / 1024 / 1024) + 'MB'
    });
  }
  
  logger.info('Application configuration complete');
}

/**
 * Sets up graceful shutdown for the application
 */
function setupGracefulShutdown() {
  logger.info('Setting up graceful shutdown handlers...');
  
  // SIGTERM is used by Cloud Run and Kubernetes
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal, starting graceful shutdown...');
    await gracefulShutdown();
  });
  
  // SIGINT is used by Ctrl+C in development
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal, starting graceful shutdown...');
    await gracefulShutdown();
  });
  
  // SIGUSR2 is used by nodemon for restart
  process.on('SIGUSR2', async () => {
    logger.info('Received SIGUSR2 signal (nodemon restart)...');
    await gracefulShutdown(true); // Restart mode
  });
  
  logger.info('Graceful shutdown handlers configured');
}

/**
 * Performs graceful shutdown of the application
 * 
 * @param {boolean} isRestart - Whether this is a restart (vs shutdown)
 */
async function gracefulShutdown(isRestart = false) {
  const shutdownStart = Date.now();
  
  try {
    logger.info('Starting graceful shutdown sequence...', {
      isRestart,
      uptime: process.uptime()
    });
    
    // 1. Stop accepting new connections
    logger.info('Stopping server from accepting new connections...');
    
    // 2. Close HTTP server
    await server.shutdownServer();
    
    // 3. Close database connections
    try {
      await database.disconnectDatabase();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections:', error);
    }
    
    // 4. Close any other resources
    // (Add other resource cleanup here)
    
    const shutdownDuration = Date.now() - shutdownStart;
    
    logger.info('Graceful shutdown completed', {
      duration: `${shutdownDuration}ms`,
      isRestart,
      exitCode: 0
    });
    
    if (isRestart) {
      // For nodemon restarts, we exit with 0
      process.exit(0);
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    const shutdownDuration = Date.now() - shutdownStart;
    
    logger.error('Graceful shutdown failed:', {
      error: error.message,
      duration: `${shutdownDuration}ms`,
      isRestart
    });
    
    // Force exit after timeout
    setTimeout(() => {
      logger.error('Forcing process exit due to shutdown timeout');
      process.exit(1);
    }, 10000).unref();
  }
}

/**
 * Starts the application
 */
async function startApplication() {
  try {
    // Log startup banner
    logStartupBanner();
    
    // Validate environment
    validateEnvironment();
    
    // Setup application configuration
    setupApplicationConfig();
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Start the server
    await server.startServer();
    
    // Log successful startup
    logStartupSuccess();
    
    // Perform initial health check
    await performInitialHealthCheck();
    
  } catch (error) {
    logger.error('Failed to start application:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Attempt graceful shutdown if server was partially started
    try {
      await server.shutdownServer();
    } catch (shutdownError) {
      logger.error('Error during emergency shutdown:', shutdownError);
    }
    
    process.exit(1);
  }
}

/**
 * Logs the application startup banner
 */
function logStartupBanner() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 Open Skill Nepal - Backend Application');
  console.log('='.repeat(70));
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform}/${process.arch}`);
  console.log(`PID: ${process.pid}`);
  console.log(`Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log('='.repeat(70) + '\n');
}

/**
 * Logs successful startup
 */
function logStartupSuccess() {
  const serverUrl = `http://${HOST}:${PORT}`;
  
  logger.info('🎉 Application started successfully!', {
    environment: NODE_ENV,
    serverUrl,
    port: PORT,
    host: HOST,
    pid: process.pid,
    uptime: process.uptime()
  });
  
  console.log('\n' + '✅ ' + '='.repeat(60));
  console.log('✅ Open Skill Nepal Backend is running!');
  console.log('✅ ' + '='.repeat(60));
  console.log(`✅ Environment: ${NODE_ENV}`);
  console.log(`✅ Server: ${serverUrl}`);
  console.log(`✅ Health: ${serverUrl}/health`);
  console.log(`✅ Ready: ${serverUrl}/ready`);
  console.log(`✅ Live: ${serverUrl}/live`);
  console.log('✅ ' + '='.repeat(60));
  console.log('✅ Press Ctrl+C to stop the server\n');
}

/**
 * Performs initial health check after startup
 */
async function performInitialHealthCheck() {
  try {
    logger.info('Performing initial health check...');
    
    const health = await healthCheck.performHealthCheck(false, true);
    
    if (health.status === 'healthy') {
      logger.info('Initial health check passed', {
        status: health.status,
        duration: health.duration
      });
    } else {
      logger.warn('Initial health check shows issues', {
        status: health.status,
        message: health.message,
        failedChecks: Object.values(health.checks).filter(c => c.status !== 'healthy').length
      });
    }
    
    // Log database connection info
    const dbStatus = database.getConnectionStatus();
    logger.info('Database connection status:', {
      connected: dbStatus.connected,
      host: dbStatus.host,
      database: dbStatus.name,
      models: dbStatus.models?.length || 0
    });
    
  } catch (error) {
    logger.error('Initial health check failed:', error);
  }
}

/**
 * Application lifecycle event handlers
 */
function setupApplicationLifecycle() {
  // Track application state
  let isHealthy = true;
  
  // Monitor memory usage (development only)
  if (NODE_ENV === 'development') {
    setInterval(() => {
      const memory = process.memoryUsage();
      const memoryUsage = {
        rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
        external: Math.round(memory.external / 1024 / 1024) + 'MB'
      };
      
      // Warn if memory usage is high
      if (memory.heapUsed > 500 * 1024 * 1024) { // 500MB
        logger.warn('High memory usage detected', memoryUsage);
      }
    }, 60000); // Check every minute
  }
  
  // Periodic health checks (production only)
  if (NODE_ENV === 'production') {
    setInterval(async () => {
      try {
        const health = await healthCheck.performHealthCheck(true, false);
        isHealthy = health.status === 'healthy' || health.status === 'degraded';
        
        if (!isHealthy) {
          logger.error('Periodic health check failed:', {
            status: health.status,
            message: health.message
          });
        }
      } catch (error) {
        logger.error('Periodic health check error:', error);
        isHealthy = false;
      }
    }, 300000); // Check every 5 minutes
  }
  
  // Handle process warnings
  process.on('warning', (warning) => {
    logger.warn('Node.js warning:', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });
}

/**
 * Main application entry point
 */
async function main() {
  // Check if this is the main module
  if (require.main === module) {
    await startApplication();
    setupApplicationLifecycle();
  }
}

// Export for testing and programmatic usage
module.exports = {
  startApplication,
  gracefulShutdown,
  validateEnvironment,
  setupApplicationConfig,
  
  // Re-export server for convenience
  server,
  logger,
  database,
  healthCheck
};

// Start the application if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('FATAL: Application failed to start:', error);
    process.exit(1);
  });
                       }
