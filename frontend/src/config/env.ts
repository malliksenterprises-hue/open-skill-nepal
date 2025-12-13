/**
 * Environment Configuration
 * Centralized environment variable management for frontend
 * Validates required variables on application start
 */

// Runtime environment variables (from Next.js)
const runtimeEnv = {
  // API Configuration
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WEBSOCKET_URL: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
  NEXT_PUBLIC_FRONTEND_URL: process.env.NEXT_PUBLIC_FRONTEND_URL,
  
  // Authentication
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  NEXT_PUBLIC_GOOGLE_REDIRECT_URI: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,
  
  // Application
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
  
  // Feature Flags
  NEXT_PUBLIC_FEATURE_LIVE_CLASSES: process.env.NEXT_PUBLIC_FEATURE_LIVE_CLASSES,
  NEXT_PUBLIC_FEATURE_DEVICE_LIMITS: process.env.NEXT_PUBLIC_FEATURE_DEVICE_LIMITS,
  NEXT_PUBLIC_FEATURE_GOOGLE_OAUTH: process.env.NEXT_PUBLIC_FEATURE_GOOGLE_OAUTH,
  NEXT_PUBLIC_FEATURE_VIDEO_UPLOAD: process.env.NEXT_PUBLIC_FEATURE_VIDEO_UPLOAD,
  NEXT_PUBLIC_FEATURE_RECORDED_CLASSES: process.env.NEXT_PUBLIC_FEATURE_RECORDED_CLASSES,
  
  // Analytics
  NEXT_PUBLIC_GA_TRACKING_ID: process.env.NEXT_PUBLIC_GA_TRACKING_ID,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Third-party Services
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  
  // Development
  NEXT_PUBLIC_ENABLE_MOCK_API: process.env.NEXT_PUBLIC_ENABLE_MOCK_API,
  NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL,
};

/**
 * Required environment variables for production
 */
const requiredEnvVars = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
  'NEXT_PUBLIC_APP_NAME',
];

/**
 * Optional environment variables with defaults
 */
const defaultEnvVars = {
  NEXT_PUBLIC_API_URL: 'https://api.openskillnepal.com',
  NEXT_PUBLIC_WEBSOCKET_URL: 'wss://api.openskillnepal.com',
  NEXT_PUBLIC_FRONTEND_URL: 'https://openskillnepal.com',
  NEXT_PUBLIC_GOOGLE_REDIRECT_URI: 'https://openskillnepal.com/auth/google/callback',
  NEXT_PUBLIC_APP_NAME: 'Open Skill Nepal',
  NEXT_PUBLIC_APP_VERSION: '1.0.0',
  NEXT_PUBLIC_ENVIRONMENT: 'production',
  NEXT_PUBLIC_FEATURE_LIVE_CLASSES: 'true',
  NEXT_PUBLIC_FEATURE_DEVICE_LIMITS: 'true',
  NEXT_PUBLIC_FEATURE_GOOGLE_OAUTH: 'true',
  NEXT_PUBLIC_FEATURE_VIDEO_UPLOAD: 'true',
  NEXT_PUBLIC_FEATURE_RECORDED_CLASSES: 'true',
  NEXT_PUBLIC_ENABLE_MOCK_API: 'false',
  NEXT_PUBLIC_LOG_LEVEL: 'info',
};

/**
 * Validate required environment variables
 * Throws error in development, logs warning in production
 */
export function validateEnv(): void {
  // Only validate in browser environment
  if (typeof window === 'undefined') return;
  
  const missingVars: string[] = [];
  const warnings: string[] = [];
  
  for (const envVar of requiredEnvVars) {
    if (!runtimeEnv[envVar as keyof typeof runtimeEnv]) {
      missingVars.push(envVar);
    }
  }
  
  if (missingVars.length > 0) {
    const message = `Missing required environment variables: ${missingVars.join(', ')}`;
    
    if (isDevelopment()) {
      throw new Error(`${message}\nPlease check your .env.local file.`);
    } else {
      warnings.push(message);
      console.warn(message);
    }
  }
  
  // Validate specific formats
  validateSpecificFormats(warnings);
  
  // Log warnings in development
  if (warnings.length > 0 && isDevelopment()) {
    warnings.forEach(warning => console.warn(`Env Warning: ${warning}`));
  }
}

/**
 * Validate specific environment variable formats
 */
function validateSpecificFormats(warnings: string[]): void {
  // Validate URLs
  const urlVars = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_FRONTEND_URL', 'NEXT_PUBLIC_GOOGLE_REDIRECT_URI'];
  
  urlVars.forEach(varName => {
    const value = runtimeEnv[varName as keyof typeof runtimeEnv];
    if (value && !isValidUrl(value)) {
      warnings.push(`${varName} must be a valid URL: ${value}`);
    }
  });
  
  // Validate boolean values
  const booleanVars = [
    'NEXT_PUBLIC_FEATURE_LIVE_CLASSES',
    'NEXT_PUBLIC_FEATURE_DEVICE_LIMITS',
    'NEXT_PUBLIC_FEATURE_GOOGLE_OAUTH',
    'NEXT_PUBLIC_FEATURE_VIDEO_UPLOAD',
    'NEXT_PUBLIC_FEATURE_RECORDED_CLASSES',
    'NEXT_PUBLIC_ENABLE_MOCK_API',
  ];
  
  booleanVars.forEach(varName => {
    const value = runtimeEnv[varName as keyof typeof runtimeEnv];
    if (value && value !== 'true' && value !== 'false') {
      warnings.push(`${varName} must be 'true' or 'false': ${value}`);
    }
  });
  
  // Validate log level
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  const logLevel = runtimeEnv.NEXT_PUBLIC_LOG_LEVEL;
  if (logLevel && !validLogLevels.includes(logLevel)) {
    warnings.push(`NEXT_PUBLIC_LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`);
  }
}

/**
 * Check if string is a valid URL
 */
function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Get environment configuration object with defaults applied
 */
export const envConfig = {
  // API Configuration
  API_URL: runtimeEnv.NEXT_PUBLIC_API_URL || defaultEnvVars.NEXT_PUBLIC_API_URL,
  WEBSOCKET_URL: runtimeEnv.NEXT_PUBLIC_WEBSOCKET_URL || defaultEnvVars.NEXT_PUBLIC_WEBSOCKET_URL,
  FRONTEND_URL: runtimeEnv.NEXT_PUBLIC_FRONTEND_URL || defaultEnvVars.NEXT_PUBLIC_FRONTEND_URL,
  
  // Authentication
  GOOGLE_CLIENT_ID: runtimeEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  GOOGLE_REDIRECT_URI: runtimeEnv.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || defaultEnvVars.NEXT_PUBLIC_GOOGLE_REDIRECT_URI,
  
  // Application
  APP_NAME: runtimeEnv.NEXT_PUBLIC_APP_NAME || defaultEnvVars.NEXT_PUBLIC_APP_NAME,
  APP_VERSION: runtimeEnv.NEXT_PUBLIC_APP_VERSION || defaultEnvVars.NEXT_PUBLIC_APP_VERSION,
  ENVIRONMENT: runtimeEnv.NEXT_PUBLIC_ENVIRONMENT || defaultEnvVars.NEXT_PUBLIC_ENVIRONMENT,
  IS_PRODUCTION: (runtimeEnv.NEXT_PUBLIC_ENVIRONMENT || defaultEnvVars.NEXT_PUBLIC_ENVIRONMENT) === 'production',
  IS_DEVELOPMENT: (runtimeEnv.NEXT_PUBLIC_ENVIRONMENT || defaultEnvVars.NEXT_PUBLIC_ENVIRONMENT) === 'development',
  IS_STAGING: (runtimeEnv.NEXT_PUBLIC_ENVIRONMENT || defaultEnvVars.NEXT_PUBLIC_ENVIRONMENT) === 'staging',
  
  // Feature Flags (as booleans)
  FEATURES: {
    LIVE_CLASSES: (runtimeEnv.NEXT_PUBLIC_FEATURE_LIVE_CLASSES || defaultEnvVars.NEXT_PUBLIC_FEATURE_LIVE_CLASSES) === 'true',
    DEVICE_LIMITS: (runtimeEnv.NEXT_PUBLIC_FEATURE_DEVICE_LIMITS || defaultEnvVars.NEXT_PUBLIC_FEATURE_DEVICE_LIMITS) === 'true',
    GOOGLE_OAUTH: (runtimeEnv.NEXT_PUBLIC_FEATURE_GOOGLE_OAUTH || defaultEnvVars.NEXT_PUBLIC_FEATURE_GOOGLE_OAUTH) === 'true',
    VIDEO_UPLOAD: (runtimeEnv.NEXT_PUBLIC_FEATURE_VIDEO_UPLOAD || defaultEnvVars.NEXT_PUBLIC_FEATURE_VIDEO_UPLOAD) === 'true',
    RECORDED_CLASSES: (runtimeEnv.NEXT_PUBLIC_FEATURE_RECORDED_CLASSES || defaultEnvVars.NEXT_PUBLIC_FEATURE_RECORDED_CLASSES) === 'true',
  },
  
  // Analytics
  GA_TRACKING_ID: runtimeEnv.NEXT_PUBLIC_GA_TRACKING_ID,
  SENTRY_DSN: runtimeEnv.NEXT_PUBLIC_SENTRY_DSN,
  
  // Third-party Services
  STRIPE_PUBLISHABLE_KEY: runtimeEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  CLOUDINARY_CLOUD_NAME: runtimeEnv.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  
  // Development
  ENABLE_MOCK_API: (runtimeEnv.NEXT_PUBLIC_ENABLE_MOCK_API || defaultEnvVars.NEXT_PUBLIC_ENABLE_MOCK_API) === 'true',
  LOG_LEVEL: runtimeEnv.NEXT_PUBLIC_LOG_LEVEL || defaultEnvVars.NEXT_PUBLIC_LOG_LEVEL,
  
  // URLs for different environments
  URLS: {
    // API endpoints
    API: {
      AUTH: `${runtimeEnv.NEXT_PUBLIC_API_URL || defaultEnvVars.NEXT_PUBLIC_API_URL}/api/auth`,
      CLASS_LOGIN: `${runtimeEnv.NEXT_PUBLIC_API_URL || defaultEnvVars.NEXT_PUBLIC_API_URL}/api/class-login`,
      DEVICES: `${runtimeEnv.NEXT_PUBLIC_API_URL || defaultEnvVars.NEXT_PUBLIC_API_URL}/api/devices`,
      LIVE_CLASS: `${runtimeEnv.NEXT_PUBLIC_API_URL || defaultEnvVars.NEXT_PUBLIC_API_URL}/api/live-class`,
      SCHOOLS: `${runtimeEnv.NEXT_PUBLIC_API_URL || defaultEnvVars.NEXT_PUBLIC_API_URL}/api/schools`,
      TEACHERS: `${runtimeEnv.NEXT_PUBLIC_API_URL || defaultEnvVars.NEXT_PUBLIC_API_URL}/api/teachers`,
      STUDENTS: `${runtimeEnv.NEXT_PUBLIC_API_URL || defaultEnvVars.NEXT_PUBLIC_API_URL}/api/students`,
      VIDEOS: `${runtimeEnv.NEXT_PUBLIC_API_URL || defaultEnvVars.NEXT_PUBLIC_API_URL}/api/videos`,
      ADMIN: `${runtimeEnv.NEXT_PUBLIC_API_URL || defaultEnvVars.NEXT_PUBLIC_API_URL}/api/admin`,
    },
    
    // Frontend routes
    FRONTEND: {
      HOME: runtimeEnv.NEXT_PUBLIC_FRONTEND_URL || defaultEnvVars.NEXT_PUBLIC_FRONTEND_URL,
      LOGIN: `${runtimeEnv.NEXT_PUBLIC_FRONTEND_URL || defaultEnvVars.NEXT_PUBLIC_FRONTEND_URL}/login`,
      STUDENT_LOGIN: `${runtimeEnv.NEXT_PUBLIC_FRONTEND_URL || defaultEnvVars.NEXT_PUBLIC_FRONTEND_URL}/login?type=student`,
      CLASS_LOGIN: `${runtimeEnv.NEXT_PUBLIC_FRONTEND_URL || defaultEnvVars.NEXT_PUBLIC_FRONTEND_URL}/login?type=class`,
      LIVE_CLASS_JOIN: `${runtimeEnv.NEXT_PUBLIC_FRONTEND_URL || defaultEnvVars.NEXT_PUBLIC_FRONTEND_URL}/live-class/join`,
      STUDENT_RECORDINGS: `${runtimeEnv.NEXT_PUBLIC_FRONTEND_URL || defaultEnvVars.NEXT_PUBLIC_FRONTEND_URL}/student/recorded-classes`,
    },
    
    // Documentation
    DOCS: {
      API: 'https://docs.openskillnepal.com/api-reference',
      USER_GUIDE: 'https://docs.openskillnepal.com/user-guide',
      DEVELOPER: 'https://docs.openskillnepal.com/developer',
    },
  },
  
  // Application constants
  CONSTANTS: {
    // Device limits
    MAX_DEVICE_LIMIT: 50,
    DEFAULT_CLASS_LOGIN_DEVICES: 1,
    
    // Session timeouts (in milliseconds)
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
    DEVICE_VALIDATION_INTERVAL: 5 * 60 * 1000, // 5 minutes
    
    // File upload limits (in bytes)
    MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
    MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
    
    // Live class limits
    MAX_LIVE_CLASS_DURATION: 4 * 60 * 60, // 4 hours in seconds
    MAX_PARTICIPANTS: 1000,
    
    // Pagination
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
  },
  
  // Role-based access constants
  ROLES: {
    SUPER_ADMIN: 'superAdmin',
    ADMIN: 'admin',
    TEACHER: 'teacher',
    SCHOOL_ADMIN: 'schoolAdmin',
    CLASS_LOGIN: 'classLogin',
    STUDENT: 'student',
  },
  
  // Storage keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    USER_DATA: 'user_data',
    DEVICE_SESSION_ID: 'device_session_id',
    SELECTED_SCHOOL: 'selected_school',
    THEME_MODE: 'theme_mode',
    LANGUAGE: 'language',
  },
};

/**
 * Helper function to check if we're in development mode
 */
export function isDevelopment(): boolean {
  return envConfig.IS_DEVELOPMENT;
}

/**
 * Helper function to check if we're in production mode
 */
export function isProduction(): boolean {
  return envConfig.IS_PRODUCTION;
}

/**
 * Get API URL with path
 */
export function getApiUrl(path: string = ''): string {
  const baseUrl = envConfig.API_URL.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${baseUrl}/api/${cleanPath}`;
}

/**
 * Get WebSocket URL
 */
export function getWebSocketUrl(path: string = ''): string {
  const baseUrl = envConfig.WEBSOCKET_URL.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${baseUrl}/${cleanPath}`;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof envConfig.FEATURES): boolean {
  return envConfig.FEATURES[feature];
}

/**
 * Get Google OAuth configuration
 */
export function getGoogleOAuthConfig() {
  return {
    clientId: envConfig.GOOGLE_CLIENT_ID,
    redirectUri: envConfig.GOOGLE_REDIRECT_URI,
    scope: 'email profile',
    responseType: 'code',
    accessType: 'offline',
    prompt: 'consent',
  };
}

// Validate environment on module load (in browser only)
if (typeof window !== 'undefined') {
  validateEnv();
}

export default envConfig;
