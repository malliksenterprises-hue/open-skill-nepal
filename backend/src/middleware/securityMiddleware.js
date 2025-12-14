/**
 * Security Middleware
 * 
 * Comprehensive security middleware for Open Skill Nepal backend.
 * Implements security headers, CORS, input sanitization, and attack protection.
 * 
 * @module middleware/securityMiddleware
 */

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const logger = require('../utils/logger');

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : [FRONTEND_URL, 'http://localhost:3000'];

/**
 * CORS configuration with dynamic origin checking
 */
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin && !IS_PRODUCTION) {
            return callback(null, true);
        }
        
        // Check if origin is in allowed list
        if (ALLOWED_ORIGINS.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            logger.warn('CORS blocked origin', { origin, allowedOrigins: ALLOWED_ORIGINS });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Allow cookies and authentication headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Request-ID',
        'X-Device-ID',
        'X-Client-Version',
        'Accept',
        'Origin'
    ],
    exposedHeaders: [
        'X-Request-ID',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
    ],
    maxAge: 86400, // 24 hours in seconds
    preflightContinue: false,
    optionsSuccessStatus: 204
};

/**
 * Security headers configuration using Helmet
 */
const helmetConfig = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", FRONTEND_URL, "https://accounts.google.com"],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            manifestSrc: ["'self'"],
            workerSrc: ["'self'", "blob:"],
            childSrc: ["'self'", "blob:"],
            formAction: ["'self'"],
            upgradeInsecureRequests: IS_PRODUCTION ? [] : null // Enable in production
        }
    },
    crossOriginEmbedderPolicy: false, // Allow embedding from same origin
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' }, // Prevent clickjacking
    hidePoweredBy: true,
    hsts: IS_PRODUCTION ? {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    } : false, // Only enable HSTS in production
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true
};

/**
 * Rate limiting for security endpoints (login, registration, password reset)
 */
const securityRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        success: false,
        message: 'Too many security attempts from this IP, please try again later.',
        code: 'RATE_LIMIT_SECURITY'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only count failed attempts
    keyGenerator: (req) => {
        // Combine IP with endpoint for more granular limiting
        return `${req.ip}:${req.path}:security`;
    }
});

/**
 * SQL injection protection middleware
 * Checks for common SQL injection patterns
 */
function sqlInjectionProtection(req, res, next) {
    const sqlKeywords = [
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'UNION', 'OR', 'AND',
        'WHERE', 'FROM', 'HAVING', 'GROUP BY', 'ORDER BY', 'LIMIT', 'OFFSET',
        'JOIN', 'INNER', 'OUTER', 'LEFT', 'RIGHT', 'CREATE', 'ALTER', 'TRUNCATE',
        'EXEC', 'EXECUTE', 'DECLARE', 'FETCH', 'OPEN', 'CLOSE', 'CURSOR'
    ];
    
    const sqlPatterns = [
        /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
        /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
        /((\%27)|(\'))\s*((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
        /((\%27)|(\'))\s+union/gi
    ];
    
    // Check query parameters
    const checkValue = (value) => {
        if (typeof value === 'string') {
            const upperValue = value.toUpperCase();
            
            // Check for SQL keywords in suspicious contexts
            for (const keyword of sqlKeywords) {
                if (upperValue.includes(keyword) && 
                    (upperValue.includes('FROM') || upperValue.includes('WHERE'))) {
                    logger.warn('Potential SQL injection detected', {
                        value: value.substring(0, 100),
                        keyword,
                        path: req.path,
                        ip: req.ip
                    });
                    return false;
                }
            }
            
            // Check for SQL patterns
            for (const pattern of sqlPatterns) {
                if (pattern.test(value)) {
                    logger.warn('SQL injection pattern detected', {
                        value: value.substring(0, 100),
                        pattern: pattern.toString(),
                        path: req.path,
                        ip: req.ip
                    });
                    return false;
                }
            }
        }
        return true;
    };
    
    // Check all request data
    const checkObject = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                if (!checkValue(obj[key])) {
                    return false;
                }
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (!checkObject(obj[key])) {
                    return false;
                }
            }
        }
        return true;
    };
    
    // Check request body, query, and params
    const checks = [
        checkObject(req.body),
        checkObject(req.query),
        checkObject(req.params)
    ];
    
    if (checks.every(check => check === true)) {
        next();
    } else {
        logger.error('SQL injection attempt blocked', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            userAgent: req.get('user-agent')
        });
        
        return res.status(400).json({
            success: false,
            message: 'Invalid request data',
            code: 'SECURITY_BLOCK'
        });
    }
}

/**
 * No-cache middleware for sensitive endpoints
 * Prevents caching of sensitive data
 */
function noCacheMiddleware(req, res, next) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
}

/**
 * Request size limiter middleware
 * Prevents DoS attacks via large payloads
 */
function requestSizeLimiter(maxSize = '10mb') {
    return function(req, res, next) {
        const contentLength = req.headers['content-length'];
        
        if (contentLength) {
            const sizeInMB = parseInt(contentLength) / (1024 * 1024);
            const maxSizeMB = parseInt(maxSize) || 10;
            
            if (sizeInMB > maxSizeMB) {
                logger.warn('Request size limit exceeded', {
                    size: `${sizeInMB.toFixed(2)}MB`,
                    limit: `${maxSizeMB}MB`,
                    path: req.path,
                    ip: req.ip
                });
                
                return res.status(413).json({
                    success: false,
                    message: `Request payload too large. Maximum size is ${maxSizeMB}MB.`,
                    code: 'PAYLOAD_TOO_LARGE'
                });
            }
        }
        
        next();
    };
}

/**
 * HTTP Parameter Pollution protection
 * Extended configuration for HPP
 */
const hppOptions = {
    whitelist: [
        'page',
        'limit',
        'sort',
        'fields',
        'search',
        'classLoginId',
        'schoolId',
        'teacherId',
        'activeOnly'
    ],
    checkBodyOnlyForContentType: 'application/json'
};

/**
 * Security headers middleware (custom implementation)
 * Adds additional security headers beyond Helmet
 */
function securityHeadersMiddleware(req, res, next) {
    // Feature Policy / Permissions Policy
    res.setHeader('Permissions-Policy', [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()'
    ].join(', '));
    
    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // X-Frame-Options (redundant with Helmet but added for compatibility)
    res.setHeader('X-Frame-Options', 'DENY');
    
    // X-XSS-Protection (for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Expect-CT (Certificate Transparency)
    if (IS_PRODUCTION) {
        res.setHeader('Expect-CT', 'max-age=86400, enforce');
    }
    
    // Server header obfuscation
    res.setHeader('Server', 'OpenSkillNepal');
    
    // Referrer Policy (more specific than Helmet's default)
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
}

/**
 * Request validation middleware
 * Validates request structure and content type
 */
function requestValidationMiddleware(req, res, next) {
    // Check Content-Type for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];
        
        if (!contentType || !contentType.includes('application/json')) {
            return res.status(415).json({
                success: false,
                message: 'Content-Type must be application/json',
                code: 'INVALID_CONTENT_TYPE'
            });
        }
    }
    
    // Validate JSON body
    if (req.body && Object.keys(req.body).length > 0) {
        // Check for circular references or extremely deep objects
        try {
            JSON.stringify(req.body);
        } catch (error) {
            logger.warn('Invalid JSON body', {
                error: error.message,
                path: req.path,
                ip: req.ip
            });
            
            return res.status(400).json({
                success: false,
                message: 'Invalid JSON data',
                code: 'INVALID_JSON'
            });
        }
    }
    
    next();
}

/**
 * IP-based access control
 * Can be extended to block malicious IPs
 */
function ipAccessControl(req, res, next) {
    // List of blocked IPs (could be loaded from database or Redis)
    const blockedIPs = process.env.BLOCKED_IPS 
        ? process.env.BLOCKED_IPS.split(',') 
        : [];
    
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Check if IP is blocked
    if (blockedIPs.includes(clientIP)) {
        logger.warn('Blocked IP attempt', {
            ip: clientIP,
            path: req.path,
            userAgent: req.get('user-agent')
        });
        
        return res.status(403).json({
            success: false,
            message: 'Access denied',
            code: 'IP_BLOCKED'
        });
    }
    
    // Check for private IP access in production
    if (IS_PRODUCTION) {
        const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.|::1|fe80::)/.test(clientIP);
        
        if (isPrivateIP && !req.path.includes('/health')) {
            logger.warn('Private IP access attempt in production', {
                ip: clientIP,
                path: req.path
            });
            
            return res.status(403).json({
                success: false,
                message: 'Access denied',
                code: 'PRIVATE_IP_BLOCKED'
            });
        }
    }
    
    next();
}

/**
 * User-Agent validation
 * Blocks suspicious or malicious user agents
 */
function userAgentValidation(req, res, next) {
    const userAgent = req.get('user-agent') || '';
    
    // List of suspicious user agents
    const suspiciousAgents = [
        /nikto/i,
        /sqlmap/i,
        /wget/i,
        /curl/i,
        /libwww-perl/i,
        /python-urllib/i,
        /nessus/i,
        /acunetix/i,
        /netsparker/i,
        /metasploit/i,
        /hydra/i,
        /havij/i,
        /zap/i,
        /burp/i,
        /dirbuster/i,
        /gobuster/i,
        /wfuzz/i
    ];
    
    // Check for suspicious user agents
    for (const pattern of suspiciousAgents) {
        if (pattern.test(userAgent)) {
            logger.warn('Suspicious User-Agent detected', {
                userAgent,
                ip: req.ip,
                path: req.path
            });
            
            // In production, block these requests
            if (IS_PRODUCTION) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied',
                    code: 'USER_AGENT_BLOCKED'
                });
            }
            break;
        }
    }
    
    next();
}

/**
 * Security audit logging middleware
 * Logs security-relevant events
 */
function securityAuditMiddleware(req, res, next) {
    const securityRelevantPaths = [
        '/api/auth/',
        '/api/admin/',
        '/api/device/',
        '/api/live/join',
        '/api/class-login/'
    ];
    
    const isSecurityRelevant = securityRelevantPaths.some(path => req.path.startsWith(path));
    
    if (isSecurityRelevant) {
        // Store original end method
        const originalEnd = res.end;
        
        res.end = function(chunk, encoding) {
            // Log security-relevant request
            logger.info('Security audit', {
                timestamp: new Date().toISOString(),
                method: req.method,
                path: req.path,
                ip: req.ip,
                userAgent: req.get('user-agent'),
                userId: req.user?._id,
                userRole: req.user?.role,
                statusCode: res.statusCode,
                contentLength: res.get('content-length')
            });
            
            // Call original end method
            originalEnd.call(this, chunk, encoding);
        };
    }
    
    next();
}

/**
 * Comprehensive security middleware setup
 * Applies all security middleware in correct order
 */
function setupSecurityMiddleware(app) {
    // 1. IP Access Control (first line of defense)
    app.use(ipAccessControl);
    
    // 2. User-Agent Validation
    app.use(userAgentValidation);
    
    // 3. CORS (early in chain)
    app.use(cors(corsOptions));
    
    // 4. Request Size Limiter
    app.use(requestSizeLimiter('10mb'));
    
    // 5. Helmet security headers
    app.use(helmet(helmetConfig));
    
    // 6. Custom security headers
    app.use(securityHeadersMiddleware);
    
    // 7. Request validation
    app.use(requestValidationMiddleware);
    
    // 8. No-cache for sensitive endpoints
    app.use('/api/auth', noCacheMiddleware);
    app.use('/api/admin', noCacheMiddleware);
    app.use('/api/device', noCacheMiddleware);
    
    // 9. Security rate limiting for sensitive endpoints
    app.use('/api/auth/login', securityRateLimiter);
    app.use('/api/auth/register', securityRateLimiter);
    app.use('/api/auth/reset-password', securityRateLimiter);
    
    // 10. SQL injection protection
    app.use(sqlInjectionProtection);
    
    // 11. MongoDB injection protection
    app.use(mongoSanitize({
        replaceWith: '_',
        onSanitize: ({ req, key }) => {
            logger.warn('MongoDB injection attempt sanitized', {
                key,
                path: req.path,
                ip: req.ip
            });
        }
    }));
    
    // 12. XSS protection
    app.use(xss());
    
    // 13. HTTP Parameter Pollution protection
    app.use(hpp(hppOptions));
    
    // 14. Security audit logging
    app.use(securityAuditMiddleware);
    
    logger.info('Security middleware configured', {
        environment: NODE_ENV,
        production: IS_PRODUCTION,
        frontendUrl: FRONTEND_URL,
        allowedOrigins: ALLOWED_ORIGINS
    });
}

module.exports = {
    // Individual middleware exports
    corsOptions,
    helmetConfig,
    securityRateLimiter,
    sqlInjectionProtection,
    noCacheMiddleware,
    requestSizeLimiter,
    securityHeadersMiddleware,
    requestValidationMiddleware,
    ipAccessControl,
    userAgentValidation,
    securityAuditMiddleware,
    
    // Main setup function
    setupSecurityMiddleware,
    
    // Helper functions
    validateOrigin: (origin) => {
        return !origin || ALLOWED_ORIGINS.includes(origin);
    }
};
