/**
 * Environment Configuration
 * Centralized environment variable management
 * Validates required variables on application start
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Required environment variables for production
 */
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_EXPIRE',
  'CORS_ORIGIN',
  'GOOGLE_CLOUD_PROJECT',
  'GCS_BUCKET_NAME',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET'
];

/**
 * Optional environment variables with defaults
 */
const optionalEnvVars = {
  LOG_LEVEL: 'info',
  JWT_REFRESH_SECRET: process.env.JWT_SECRET + '_REFRESH',
  JWT_REFRESH_EXPIRE: '30d',
  SESSION_TIMEOUT: '24h',
  MAX_DEVICE_LIMIT: '50',
  DEFAULT_CLASS_LOGIN_DEVICES: '1',
  RATE_LIMIT_WINDOW_MS: '900000', // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: '100',
  UPLOAD_FILE_SIZE_LIMIT: '104857600', // 100MB
  VIDEO_PROCESSING_TIMEOUT: '300000', // 5 minutes
  LIVE_CLASS_DURATION_LIMIT: '14400', // 4 hours in seconds
  STUDENT_VERIFICATION_REQUIRED: 'true',
  TEACHER_VERIFICATION_REQUIRED: 'true',
  SCHOOL_ADMIN_VERIFICATION_REQUIRED: 'true'
};

/**
 * Validate required environment variables
 */
function validateEnv() {
  const missingVars = [];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  }
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file or deployment environment variables.'
    );
  }
  
  // Set optional variables with defaults
  for (const [key, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
    }
  }
  
  // Validate specific formats
  validateSpecificFormats();
}

/**
 * Validate specific environment variable formats
 */
function validateSpecificFormats() {
  // Validate NODE_ENV
  const validEnvironments = ['development', 'production', 'test'];
  if (!validEnvironments.includes(process.env.NODE_ENV)) {
    throw new Error(`NODE_ENV must be one of: ${validEnvironments.join(', ')}`);
  }
  
  // Validate PORT
  const port = parseInt(process.env.PORT);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid port number between 1 and 65535');
  }
  
  // Validate MongoDB URI
  if (!process.env.MONGODB_URI.startsWith('mongodb+srv://') && 
      !process.env.MONGODB_URI.startsWith('mongodb://')) {
    throw new Error('MONGODB_URI must be a valid MongoDB connection string');
  }
  
  // Validate CORS_ORIGIN
  try {
    const corsOrigins = process.env.CORS_ORIGIN.split(',');
    corsOrigins.forEach(origin => {
      if (origin !== '*' && !origin.startsWith('http://') && !origin.startsWith('https://')) {
        throw new Error('CORS_ORIGIN must be valid URLs separated by commas or * for all');
      }
    });
  } catch (error) {
    throw new Error('Invalid CORS_ORIGIN format');
  }
  
  // Validate JWT secret length
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }
  
  // Validate Google OAuth credentials
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials are required for student authentication');
  }
  
  // Validate numeric values
  const numericVars = [
    'MAX_DEVICE_LIMIT',
    'DEFAULT_CLASS_LOGIN_DEVICES',
    'RATE_LIMIT_WINDOW_MS',
    'RATE_LIMIT_MAX_REQUESTS',
    'UPLOAD_FILE_SIZE_LIMIT',
    'VIDEO_PROCESSING_TIMEOUT',
    'LIVE_CLASS_DURATION_LIMIT'
  ];
  
  numericVars.forEach(varName => {
    const value = parseInt(process.env[varName]);
    if (isNaN(value) || value < 0) {
      throw new Error(`${varName} must be a positive number`);
    }
  });
  
  // Validate boolean values
  const booleanVars = [
    'STUDENT_VERIFICATION_REQUIRED',
    'TEACHER_VERIFICATION_REQUIRED',
    'SCHOOL_ADMIN_VERIFICATION_REQUIRED'
  ];
  
  booleanVars.forEach(varName => {
    const value = process.env[varName].toLowerCase();
    if (value !== 'true' && value !== 'false') {
      throw new Error(`${varName} must be either 'true' or 'false'`);
    }
  });
}

/**
 * Get environment configuration object
 */
const envConfig = {
  // Application
  NODE_ENV: process.env.NODE_ENV,
  PORT: parseInt(process.env.PORT),
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_TEST: process.env.NODE_ENV === 'test',
  
  // Database
  MONGODB_URI: process.env.MONGODB_URI,
  
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE,
  
  // Security
  CORS_ORIGIN: process.env.CORS_ORIGIN.split(','),
  SESSION_TIMEOUT: process.env.SESSION_TIMEOUT,
  
  // Device Management
  MAX_DEVICE_LIMIT: parseInt(process.env.MAX_DEVICE_LIMIT),
  DEFAULT_CLASS_LOGIN_DEVICES: parseInt(process.env.DEFAULT_CLASS_LOGIN_DEVICES),
  
  // Google Cloud
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
  
  // Google OAuth (for students)
  GOOGLE_OAUTH: {
    CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'https://openskillnepal.com/auth/google/callback'
  },
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL,
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS),
  
  // File Uploads
  UPLOAD_FILE_SIZE_LIMIT: parseInt(process.env.UPLOAD_FILE_SIZE_LIMIT),
  VIDEO_PROCESSING_TIMEOUT: parseInt(process.env.VIDEO_PROCESSING_TIMEOUT),
  
  // Live Classes
  LIVE_CLASS_DURATION_LIMIT: parseInt(process.env.LIVE_CLASS_DURATION_LIMIT),
  
  // URLs (for production)
  FRONTEND_URL: 'https://openskillnepal.com',
  BACKEND_URL: process.env.BACKEND_URL || `https://api-${process.env.GOOGLE_CLOUD_PROJECT}.run.app`,
  WEBSOCKET_URL: process.env.WEBSOCKET_URL || `wss://api-${process.env.GOOGLE_CLOUD_PROJECT}.run.app`,
  
  // Verification Settings
  VERIFICATION: {
    STUDENT_REQUIRED: process.env.STUDENT_VERIFICATION_REQUIRED.toLowerCase() === 'true',
    TEACHER_REQUIRED: process.env.TEACHER_VERIFICATION_REQUIRED.toLowerCase() === 'true',
    SCHOOL_ADMIN_REQUIRED: process.env.SCHOOL_ADMIN_VERIFICATION_REQUIRED.toLowerCase() === 'true'
  },
  
  // Feature Flags
  FEATURES: {
    LIVE_CLASS_ENABLED: process.env.LIVE_CLASS_ENABLED !== 'false',
    DEVICE_LIMIT_ENABLED: process.env.DEVICE_LIMIT_ENABLED !== 'false',
    GOOGLE_OAUTH_ENABLED: process.env.GOOGLE_OAUTH_ENABLED === 'true',
    VIDEO_UPLOAD_ENABLED: process.env.VIDEO_UPLOAD_ENABLED !== 'false',
    RECORDED_CLASSES_ENABLED: process.env.RECORDED_CLASSES_ENABLED !== 'false'
  }
};

// Validate on module load
validateEnv();

// Export configuration
module.exports = envConfig;
