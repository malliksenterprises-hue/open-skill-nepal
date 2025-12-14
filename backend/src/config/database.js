/**
 * Database Configuration
 * 
 * MongoDB connection and configuration for Open Skill Nepal backend.
 * Provides connection management, connection pooling, and database helpers.
 * 
 * @module config/database
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test';

// MongoDB connection configuration
const MONGODB_URI = process.env.MONGODB_URI || 
                   process.env.MONGO_URI || 
                   'mongodb://localhost:27017/open-skill-nepal';

// MongoDB connection options
const MONGODB_OPTIONS = {
    // Connection pooling
    maxPoolSize: IS_PRODUCTION ? 50 : 10,
    minPoolSize: IS_PRODUCTION ? 10 : 5,
    maxIdleTimeMS: 10000,
    waitQueueTimeoutMS: 10000,
    
    // Timeouts
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    
    // TLS/SSL
    ssl: IS_PRODUCTION,
    tlsAllowInvalidCertificates: !IS_PRODUCTION,
    
    // Authentication
    authSource: 'admin',
    
    // Replica set (if applicable)
    replicaSet: process.env.MONGODB_REPLICA_SET,
    readPreference: IS_PRODUCTION ? 'secondaryPreferred' : 'primary',
    
    // Write concern
    w: IS_PRODUCTION ? 'majority' : 1,
    journal: true,
    
    // Retry logic
    retryWrites: true,
    retryReads: true
};

// Database models cache
const models = {};

// Connection state tracking
let connectionState = {
    connected: false,
    connecting: false,
    disconnected: true,
    lastConnectAttempt: null,
    lastDisconnect: null,
    connectionCount: 0
};

// Event handlers for connection monitoring
const setupConnectionEventHandlers = () => {
    mongoose.connection.on('connected', () => {
        connectionState.connected = true;
        connectionState.connecting = false;
        connectionState.disconnected = false;
        connectionState.lastConnectAttempt = new Date();
        connectionState.connectionCount++;
        
        logger.info('MongoDB connected successfully', {
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            connectionCount: connectionState.connectionCount
        });
    });

    mongoose.connection.on('connecting', () => {
        connectionState.connected = false;
        connectionState.connecting = true;
        connectionState.disconnected = false;
        
        logger.info('Connecting to MongoDB...', {
            uri: maskMongoUri(MONGODB_URI),
            options: { ...MONGODB_OPTIONS, ssl: MONGODB_OPTIONS.ssl ? 'enabled' : 'disabled' }
        });
    });

    mongoose.connection.on('disconnected', () => {
        connectionState.connected = false;
        connectionState.connecting = false;
        connectionState.disconnected = true;
        connectionState.lastDisconnect = new Date();
        
        logger.warn('MongoDB disconnected', {
            database: mongoose.connection.name,
            host: mongoose.connection.host
        });
    });

    mongoose.connection.on('reconnected', () => {
        connectionState.connected = true;
        connectionState.connecting = false;
        connectionState.disconnected = false;
        connectionState.connectionCount++;
        
        logger.info('MongoDB reconnected', {
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            reconnectionCount: connectionState.connectionCount
        });
    });

    mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', {
            error: error.message,
            name: error.name,
            code: error.code,
            host: mongoose.connection?.host,
            database: mongoose.connection?.name
        });
    });

    mongoose.connection.on('fullsetup', () => {
        logger.info('MongoDB replica set connected', {
            database: mongoose.connection.name,
            replicaSet: mongoose.connection.client?.topology?.s?.description?.replicaSet
        });
    });
};

/**
 * Masks MongoDB URI for logging (hides credentials)
 * 
 * @param {string} uri - MongoDB URI
 * @returns {string} Masked URI
 */
function maskMongoUri(uri) {
    if (!uri) return 'undefined';
    
    try {
        // Parse the URI
        const url = new URL(uri);
        
        // Mask password if present
        if (url.password) {
            url.password = '***';
        }
        
        // Mask username if present
        if (url.username && url.username !== '') {
            url.username = '***';
        }
        
        return url.toString();
    } catch (error) {
        // If URI parsing fails, return a masked version
        return uri.replace(/:\/\/[^@]+@/, '://***:***@');
    }
}

/**
 * Connects to MongoDB database
 * 
 * @returns {Promise<mongoose.Connection>} MongoDB connection
 */
async function connectDatabase() {
    // If already connected, return existing connection
    if (mongoose.connection.readyState === 1) {
        logger.debug('Database already connected');
        return mongoose.connection;
    }
    
    // If currently connecting, wait for connection
    if (mongoose.connection.readyState === 2) {
        logger.debug('Database connection in progress, waiting...');
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                mongoose.connection.removeListener('connected', onConnected);
                mongoose.connection.removeListener('error', onError);
                reject(new Error('Database connection timeout'));
            }, 30000);
            
            function onConnected() {
                clearTimeout(timeout);
                resolve(mongoose.connection);
            }
            
            function onError(error) {
                clearTimeout(timeout);
                reject(error);
            }
            
            mongoose.connection.once('connected', onConnected);
            mongoose.connection.once('error', onError);
        });
    }
    
    // Setup event handlers (only once)
    if (!connectionState.connectionCount) {
        setupConnectionEventHandlers();
    }
    
    try {
        logger.info('Connecting to MongoDB database...', {
            environment: NODE_ENV,
            maskedUri: maskMongoUri(MONGODB_URI),
            options: {
                maxPoolSize: MONGODB_OPTIONS.maxPoolSize,
                minPoolSize: MONGODB_OPTIONS.minPoolSize,
                ssl: MONGODB_OPTIONS.ssl ? 'enabled' : 'disabled'
            }
        });
        
        // Configure mongoose global settings
        configureMongoose();
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI, MONGODB_OPTIONS);
        
        // Verify connection with a ping
        await mongoose.connection.db.admin().ping();
        
        logger.info('MongoDB connection verified with ping');
        
        return mongoose.connection;
        
    } catch (error) {
        logger.error('Failed to connect to MongoDB:', {
            error: error.message,
            name: error.name,
            code: error.code,
            maskedUri: maskMongoUri(MONGODB_URI)
        });
        
        // In production, we might want to retry or exit
        if (IS_PRODUCTION) {
            // For Cloud Run, we might want to exit and let it restart
            if (error.name === 'MongoNetworkError' || error.code === 'ECONNREFUSED') {
                logger.error('Critical database connection failure in production. Exiting...');
                process.exit(1);
            }
        }
        
        throw error;
    }
}

/**
 * Configures mongoose global settings
 */
function configureMongoose() {
    // Set mongoose promise library
    mongoose.Promise = global.Promise;
    
    // Disable automatic index creation in production (do it manually)
    mongoose.set('autoIndex', !IS_PRODUCTION);
    
    // Enable debug mode in development
    mongoose.set('debug', NODE_ENV === 'development' && process.env.MONGOOSE_DEBUG === 'true');
    
    // Set buffer commands (helpful for connection issues)
    mongoose.set('bufferCommands', true);
    mongoose.set('bufferTimeoutMS', 30000);
    
    // Set strict query mode
    mongoose.set('strictQuery', true);
    
    // Configure toObject and toJSON transforms
    mongoose.set('toObject', {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret.__v;
            delete ret._id;
            return ret;
        }
    });
    
    mongoose.set('toJSON', {
        virtuals: true,
        transform: (doc, ret) => {
            delete ret.__v;
            delete ret._id;
            return ret;
        }
    });
}

/**
 * Disconnects from MongoDB database
 * 
 * @returns {Promise<void>}
 */
async function disconnectDatabase() {
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            logger.info('MongoDB disconnected successfully');
        }
    } catch (error) {
        logger.error('Error disconnecting from MongoDB:', error);
        throw error;
    }
}

/**
 * Gets database connection status
 * 
 * @returns {Object} Connection status
 */
function getConnectionStatus() {
    const readyStateMap = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
        99: 'uninitialized'
    };
    
    return {
        readyState: mongoose.connection.readyState,
        readyStateText: readyStateMap[mongoose.connection.readyState] || 'unknown',
        connected: mongoose.connection.readyState === 1,
        connecting: mongoose.connection.readyState === 2,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
        models: Object.keys(mongoose.models),
        connectionState: { ...connectionState }
    };
}

/**
 * Gets database statistics
 * 
 * @returns {Promise<Object>} Database statistics
 */
async function getDatabaseStats() {
    try {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database not connected');
        }
        
        const db = mongoose.connection.db;
        const adminDb = db.admin();
        
        // Get server status
        const serverStatus = await adminDb.serverStatus();
        
        // Get database stats
        const dbStats = await db.stats();
        
        // Get collection stats for main collections
        const collections = await db.listCollections().toArray();
        const collectionStats = await Promise.all(
            collections.slice(0, 10).map(async (collection) => {
                try {
                    const stats = await db.collection(collection.name).stats();
                    return {
                        name: collection.name,
                        count: stats.count,
                        size: stats.size,
                        storageSize: stats.storageSize,
                        avgObjSize: stats.avgObjSize,
                        indexes: stats.nindexes,
                        indexSize: stats.totalIndexSize
                    };
                } catch (error) {
                    return {
                        name: collection.name,
                        error: error.message
                    };
                }
            })
        );
        
        return {
            server: {
                version: serverStatus.version,
                host: serverStatus.host,
                process: serverStatus.process,
                uptime: serverStatus.uptime,
                connections: serverStatus.connections,
                network: serverStatus.network
            },
            database: {
                name: dbStats.db,
                collections: dbStats.collections,
                objects: dbStats.objects,
                avgObjSize: dbStats.avgObjSize,
                dataSize: dbStats.dataSize,
                storageSize: dbStats.storageSize,
                indexSize: dbStats.indexSize,
                fileSize: dbStats.fileSize,
                indexes: dbStats.indexes
            },
            collections: collectionStats,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        logger.error('Failed to get database stats:', error);
        throw error;
    }
}

/**
 * Creates database indexes (should be called after connection)
 * 
 * @returns {Promise<Object>} Index creation results
 */
async function createDatabaseIndexes() {
    try {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database not connected');
        }
        
        const results = {};
        const modelsToIndex = Object.values(mongoose.models);
        
        logger.info('Creating database indexes...', {
            modelCount: modelsToIndex.length
        });
        
        for (const model of modelsToIndex) {
            try {
                // Get existing indexes
                const existingIndexes = await model.collection.indexes();
                
                // Create indexes (mongoose will only create missing ones)
                await model.createIndexes();
                
                // Get new indexes
                const newIndexes = await model.collection.indexes();
                
                results[model.modelName] = {
                    success: true,
                    existingCount: existingIndexes.length,
                    newCount: newIndexes.length,
                    indexes: newIndexes.map(idx => ({
                        name: idx.name,
                        key: idx.key,
                        unique: idx.unique || false,
                        sparse: idx.sparse || false
                    }))
                };
                
                logger.debug(`Indexes created for ${model.modelName}`, {
                    count: newIndexes.length
                });
                
            } catch (error) {
                results[model.modelName] = {
                    success: false,
                    error: error.message
                };
                
                logger.error(`Failed to create indexes for ${model.modelName}:`, error);
            }
        }
        
        logger.info('Database indexes created', {
            successful: Object.values(results).filter(r => r.success).length,
            failed: Object.values(results).filter(r => !r.success).length
        });
        
        return results;
        
    } catch (error) {
        logger.error('Failed to create database indexes:', error);
        throw error;
    }
}

/**
 * Drops database (USE WITH CAUTION - development only)
 * 
 * @returns {Promise<Object>} Drop result
 */
async function dropDatabase() {
    if (IS_PRODUCTION) {
        throw new Error('Cannot drop database in production');
    }
    
    if (IS_TEST) {
        throw new Error('Use test-specific cleanup in test environment');
    }
    
    try {
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database not connected');
        }
        
        logger.warn('Dropping database...', {
            database: mongoose.connection.name,
            environment: NODE_ENV
        });
        
        await mongoose.connection.db.dropDatabase();
        
        logger.warn('Database dropped successfully');
        
        return {
            success: true,
            database: mongoose.connection.name,
            droppedAt: new Date().toISOString()
        };
        
    } catch (error) {
        logger.error('Failed to drop database:', error);
        throw error;
    }
}

/**
 * Health check for database connection
 * 
 * @returns {Promise<Object>} Health check result
 */
async function healthCheck() {
    const startTime = Date.now();
    
    try {
        if (mongoose.connection.readyState !== 1) {
            return {
                status: 'unhealthy',
                message: 'Database not connected',
                latency: Date.now() - startTime,
                readyState: mongoose.connection.readyState
            };
        }
        
        // Perform a simple query to check responsiveness
        const pingStart = Date.now();
        await mongoose.connection.db.admin().ping();
        const pingLatency = Date.now() - pingStart;
        
        const totalLatency = Date.now() - startTime;
        
        return {
            status: 'healthy',
            message: 'Database connected and responsive',
            latency: totalLatency,
            pingLatency: pingLatency,
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            database: mongoose.connection.name
        };
        
    } catch (error) {
        const totalLatency = Date.now() - startTime;
        
        return {
            status: 'unhealthy',
            message: 'Database health check failed',
            error: error.message,
            latency: totalLatency,
            readyState: mongoose.connection.readyState
        };
    }
}

/**
 * Registers a model with the database module
 * 
 * @param {string} name - Model name
 * @param {mongoose.Schema} schema - Mongoose schema
 * @param {string} collection - Collection name (optional)
 * @returns {mongoose.Model} Registered model
 */
function registerModel(name, schema, collection = null) {
    if (models[name]) {
        logger.warn(`Model ${name} already registered, returning existing model`);
        return models[name];
    }
    
    const model = mongoose.model(name, schema, collection);
    models[name] = model;
    
    logger.debug(`Model registered: ${name}`, {
        collection: collection || name.toLowerCase() + 's',
        schemaPaths: Object.keys(schema.paths).length
    });
    
    return model;
}

/**
 * Gets a registered model
 * 
 * @param {string} name - Model name
 * @returns {mongoose.Model} Model instance
 */
function getModel(name) {
    if (!models[name]) {
        throw new Error(`Model ${name} not registered`);
    }
    
    return models[name];
}

/**
 * Transaction helper for MongoDB transactions (requires replica set)
 * 
 * @param {Function} callback - Transaction callback
 * @param {Object} options - Transaction options
 * @returns {Promise<any>} Transaction result
 */
async function withTransaction(callback, options = {}) {
    if (mongoose.connection.readyState !== 1) {
        throw new Error('Database not connected');
    }
    
    const session = await mongoose.startSession();
    
    const transactionOptions = {
        readPreference: 'primary',
        readConcern: { level: 'local' },
        writeConcern: { w: 'majority' },
        ...options
    };
    
    let result;
    
    try {
        await session.withTransaction(async () => {
            result = await callback(session);
        }, transactionOptions);
        
        return result;
    } catch (error) {
        logger.error('Transaction failed:', error);
        throw error;
    } finally {
        await session.endSession();
    }
}

/**
 * Creates a Mongoose session (for transactions)
 * 
 * @returns {Promise<mongoose.ClientSession>} Mongoose session
 */
async function createSession() {
    if (mongoose.connection.readyState !== 1) {
        throw new Error('Database not connected');
    }
    
    return await mongoose.startSession();
}

/**
 * Database middleware for Express (attaches db helpers to request)
 * 
 * @returns {Function} Express middleware
 */
function databaseMiddleware() {
    return function(req, res, next) {
        // Attach database helpers to request
        req.db = {
            // Connection status
            getStatus: () => getConnectionStatus(),
            
            // Health check
            healthCheck: () => healthCheck(),
            
            // Model access
            getModel: (name) => getModel(name),
            
            // Transaction helper
            withTransaction: (callback, options) => withTransaction(callback, options),
            
            // Session creation
            createSession: () => createSession()
        };
        
        next();
    };
}

module.exports = {
    // Core connection functions
    connectDatabase,
    disconnectDatabase,
    getConnectionStatus,
    
    // Database operations
    getDatabaseStats,
    createDatabaseIndexes,
    dropDatabase,
    healthCheck,
    
    // Model management
    registerModel,
    getModel,
    
    // Transaction support
    withTransaction,
    createSession,
    
    // Middleware
    databaseMiddleware,
    
    // Configuration
    MONGODB_URI: maskMongoUri(MONGODB_URI),
    MONGODB_OPTIONS,
    NODE_ENV,
    IS_PRODUCTION,
    IS_TEST,
    
    // Mongoose instance (for direct access if needed)
    mongoose,
    
    // Connection state
    connectionState
};
