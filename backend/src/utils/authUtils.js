/**
 * Authentication Utilities
 * 
 * Centralized authentication and authorization utilities including:
 * - JWT token generation and verification
 * - Google OAuth integration helpers
 * - Password hashing and validation
 * - Role-based permission checks
 * - Session management
 * 
 * @module utils/authUtils
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const logger = require('./logger');

// Load environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS) || 10;

// Initialize Google OAuth client
let googleOAuthClient = null;
if (GOOGLE_CLIENT_ID) {
    googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);
}

/**
 * Generates a JWT token for a user
 * 
 * @param {Object} user - User object from database
 * @param {Object} options - Additional token options
 * @param {string} [options.expiresIn=JWT_EXPIRY] - Token expiration time
 * @param {string} [options.audience] - Token audience
 * @param {string} [options.issuer] - Token issuer
 * @returns {string} JWT token
 */
function generateToken(user, options = {}) {
    try {
        const payload = {
            userId: user._id.toString(),
            role: user.role,
            email: user.email,
            schoolId: user.schoolId,
            permissions: getRolePermissions(user.role)
        };

        // Add additional claims if present in user object
        if (user.classLoginId) {
            payload.classLoginId = user.classLoginId;
        }

        const tokenOptions = {
            expiresIn: options.expiresIn || JWT_EXPIRY,
            issuer: options.issuer || 'open-skill-nepal',
            audience: options.audience || 'open-skill-nepal-api'
        };

        if (options.jwtId) {
            tokenOptions.jwtid = options.jwtId;
        }

        const token = jwt.sign(payload, JWT_SECRET, tokenOptions);

        logger.debug('JWT token generated', {
            userId: user._id,
            role: user.role,
            expiresIn: tokenOptions.expiresIn
        });

        return token;
    } catch (error) {
        logger.error('Error generating JWT token:', error);
        throw new Error('Failed to generate authentication token');
    }
}

/**
 * Verifies and decodes a JWT token
 * 
 * @param {string} token - JWT token to verify
 * @param {Object} options - Verification options
 * @returns {Promise<Object>} Decoded token payload
 */
async function verifyToken(token, options = {}) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            issuer: options.issuer || 'open-skill-nepal',
            audience: options.audience || 'open-skill-nepal-api',
            ...options
        });

        logger.debug('JWT token verified', {
            userId: decoded.userId,
            role: decoded.role
        });

        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            logger.warn('JWT token expired', { token: token.substring(0, 20) + '...' });
            throw new Error('Token has expired');
        } else if (error.name === 'JsonWebTokenError') {
            logger.warn('Invalid JWT token', { error: error.message });
            throw new Error('Invalid token');
        } else {
            logger.error('JWT verification error:', error);
            throw new Error('Token verification failed');
        }
    }
}

/**
 * Generates a refresh token for session renewal
 * 
 * @param {string} userId - User ID
 * @returns {Object} Refresh token object
 */
function generateRefreshToken(userId) {
    try {
        const refreshToken = crypto.randomBytes(64).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        
        // Hash the refresh token for storage
        const hashedToken = crypto
            .createHash('sha256')
            .update(refreshToken)
            .digest('hex');

        return {
            token: refreshToken,
            hashedToken,
            expiresAt,
            userId
        };
    } catch (error) {
        logger.error('Error generating refresh token:', error);
        throw new Error('Failed to generate refresh token');
    }
}

/**
 * Hashes a password using bcrypt
 * 
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
    try {
        if (!password || password.length < 4) {
            throw new Error('Password must be at least 4 characters');
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        return hashedPassword;
    } catch (error) {
        logger.error('Error hashing password:', error);
        throw new Error('Failed to hash password');
    }
}

/**
 * Compares a plain text password with a hashed password
 * 
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} True if passwords match
 */
async function comparePassword(password, hashedPassword) {
    try {
        if (!password || !hashedPassword) {
            return false;
        }

        const isMatch = await bcrypt.compare(password, hashedPassword);
        return isMatch;
    } catch (error) {
        logger.error('Error comparing passwords:', error);
        return false;
    }
}

/**
 * Verifies a Google OAuth ID token
 * 
 * @param {string} idToken - Google ID token
 * @returns {Promise<Object>} Google user information
 */
async function verifyGoogleToken(idToken) {
    try {
        if (!googleOAuthClient) {
            throw new Error('Google OAuth client not configured');
        }

        const ticket = await googleOAuthClient.verifyIdToken({
            idToken,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        logger.debug('Google token verified', {
            googleId: payload.sub,
            email: payload.email
        });

        return {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            givenName: payload.given_name,
            familyName: payload.family_name,
            picture: payload.picture,
            emailVerified: payload.email_verified
        };
    } catch (error) {
        logger.error('Error verifying Google token:', error);
        throw new Error('Invalid Google authentication token');
    }
}

/**
 * Generates a random password for Class Login or Teacher accounts
 * 
 * @param {number} length - Password length (default: 12)
 * @returns {string} Generated password
 */
function generateRandomPassword(length = 12) {
    try {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        
        // Ensure at least one of each character type
        password += getRandomChar('abcdefghijklmnopqrstuvwxyz'); // lowercase
        password += getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ'); // uppercase
        password += getRandomChar('0123456789'); // number
        password += getRandomChar('!@#$%^&*'); // special
        
        // Fill the rest randomly
        for (let i = 4; i < length; i++) {
            password += charset[Math.floor(Math.random() * charset.length)];
        }
        
        // Shuffle the password
        password = password.split('').sort(() => Math.random() - 0.5).join('');
        
        return password;
    } catch (error) {
        logger.error('Error generating random password:', error);
        // Fallback to simpler password
        return Math.random().toString(36).slice(-length) + 'Aa1!';
    }
}

/**
 * Helper function to get random character from string
 * 
 * @param {string} charset - Character set
 * @returns {string} Random character
 */
function getRandomChar(charset) {
    return charset[Math.floor(Math.random() * charset.length)];
}

/**
 * Gets permissions for a specific role
 * 
 * @param {string} role - User role
 * @returns {Array<string>} Array of permissions
 */
function getRolePermissions(role) {
    const permissions = {
        'superAdmin': [
            'platform:full',
            'admin:create',
            'admin:delete',
            'admin:manage',
            'school:create',
            'school:delete',
            'school:manage',
            'teacher:create',
            'teacher:delete',
            'teacher:manage',
            'class:create',
            'class:delete',
            'class:manage',
            'device:manage',
            'live:control',
            'recordings:manage',
            'analytics:view'
        ],
        'admin': [
            'school:create',
            'school:manage',
            'teacher:assign',
            'teacher:manage',
            'class:create',
            'class:manage',
            'device:manage',
            'live:control',
            'recordings:manage',
            'analytics:view'
        ],
        'teacher': [
            'class:view',
            'live:conduct',
            'live:control',
            'students:manage',
            'recordings:upload',
            'notes:create',
            'notes:manage'
        ],
        'schoolAdmin': [
            'class:create',
            'class:manage',
            'students:view',
            'recordings:view',
            'analytics:view'
        ],
        'classLogin': [
            'live:join',
            'live:interact',
            'recordings:view'
        ],
        'student': [
            'recordings:view',
            'notes:view'
        ]
    };

    return permissions[role] || [];
}

/**
 * Checks if a user has a specific permission
 * 
 * @param {Object} user - User object with role/permissions
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
function hasPermission(user, permission) {
    if (!user || !user.role) {
        return false;
    }

    // Super admin has all permissions
    if (user.role === 'superAdmin') {
        return true;
    }

    const permissions = getRolePermissions(user.role);
    return permissions.includes(permission);
}

/**
 * Validates if a user can access a specific school resource
 * 
 * @param {Object} user - User object
 * @param {string} schoolId - School ID to check
 * @returns {boolean} True if user can access the school
 */
function canAccessSchool(user, schoolId) {
    if (!user || !schoolId) {
        return false;
    }

    // Super admin can access all schools
    if (user.role === 'superAdmin') {
        return true;
    }

    // Admin can access all schools (in current implementation)
    if (user.role === 'admin') {
        return true;
    }

    // Teacher and SchoolAdmin can only access their assigned school
    if (user.role === 'teacher' || user.role === 'schoolAdmin') {
        return user.schoolId && user.schoolId.toString() === schoolId.toString();
    }

    // ClassLogin access is handled separately in device limiter
    if (user.role === 'classLogin') {
        return false; // ClassLogin doesn't directly access schools
    }

    return false;
}

/**
 * Generates a secure session ID for device tracking
 * 
 * @returns {string} Secure session ID
 */
function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Extracts token from Authorization header
 * 
 * @param {Object} headers - Request headers
 * @returns {string|null} Extracted token or null
 */
function extractTokenFromHeaders(headers) {
    try {
        const authHeader = headers.authorization;
        
        if (!authHeader) {
            return null;
        }

        // Check for Bearer token format
        if (authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Also check for custom header
        if (headers['x-access-token']) {
            return headers['x-access-token'];
        }

        return null;
    } catch (error) {
        logger.error('Error extracting token from headers:', error);
        return null;
    }
}

/**
 * Creates a secure token for password reset
 * 
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Object} Password reset token
 */
function createPasswordResetToken(userId, email) {
    try {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
        
        // Hash the token for storage
        const hashedToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Create a token for email (combines userId and token)
        const emailToken = Buffer.from(`${userId}:${resetToken}`).toString('base64');

        return {
            resetToken: emailToken,
            hashedToken,
            expiresAt,
            userId,
            email
        };
    } catch (error) {
        logger.error('Error creating password reset token:', error);
        throw new Error('Failed to create password reset token');
    }
}

/**
 * Validates a password reset token
 * 
 * @param {string} token - Password reset token
 * @param {string} hashedToken - Hashed token from database
 * @returns {Object|null} Decoded token data or null
 */
function validatePasswordResetToken(token, hashedToken) {
    try {
        // Decode the base64 token
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const [userId, resetToken] = decoded.split(':');

        if (!userId || !resetToken) {
            return null;
        }

        // Hash the provided token
        const hashedProvidedToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Compare with stored hash
        if (hashedProvidedToken !== hashedToken) {
            return null;
        }

        return { userId, resetToken };
    } catch (error) {
        logger.error('Error validating password reset token:', error);
        return null;
    }
}

module.exports = {
    generateToken,
    verifyToken,
    generateRefreshToken,
    hashPassword,
    comparePassword,
    verifyGoogleToken,
    generateRandomPassword,
    getRolePermissions,
    hasPermission,
    canAccessSchool,
    generateSessionId,
    extractTokenFromHeaders,
    createPasswordResetToken,
    validatePasswordResetToken,
    
    // Constants for external use
    JWT_SECRET,
    JWT_EXPIRY,
    SALT_ROUNDS
};
