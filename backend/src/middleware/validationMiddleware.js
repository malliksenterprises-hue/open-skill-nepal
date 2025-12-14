/**
 * Validation Middleware
 * 
 * Centralized validation for all API requests including:
 * - Request body validation
 * - Query parameter validation
 * - Route parameter validation
 * - Device limit validation for live classes
 * 
 * @module middleware/validationMiddleware
 */

const { body, query, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Validates MongoDB ObjectId parameters
 * 
 * @param {...string} paramNames - Parameter names to validate
 * @returns {Array} Express-validator chain
 */
const validateObjectIds = (...paramNames) => {
    return paramNames.map(paramName =>
        param(paramName).custom(value => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                throw new Error(`Invalid ${paramName}: ${value}`);
            }
            return true;
        })
    );
};

/**
 * Validates request body for Class Login creation
 * 
 * @returns {Array} Express-validator chain
 */
const validateCreateClassLogin = () => [
    body('schoolId')
        .notEmpty().withMessage('School ID is required')
        .custom(value => mongoose.Types.ObjectId.isValid(value))
        .withMessage('Invalid School ID format'),

    body('className')
        .trim()
        .notEmpty().withMessage('Class name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Class name must be 2-100 characters'),

    body('section')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Section must be max 50 characters'),

    body('gradeLevel')
        .optional()
        .isInt({ min: 1, max: 12 }).withMessage('Grade level must be 1-12'),

    body('deviceLimit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Device limit must be 1-100')
        .default(1),

    body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Notes must be max 500 characters')
];

/**
 * Validates request body for School creation
 * 
 * @returns {Array} Express-validator chain
 */
const validateCreateSchool = () => [
    body('name')
        .trim()
        .notEmpty().withMessage('School name is required')
        .isLength({ min: 2, max: 200 }).withMessage('School name must be 2-200 characters'),

    body('address')
        .trim()
        .notEmpty().withMessage('Address is required')
        .isLength({ min: 5, max: 500 }).withMessage('Address must be 5-500 characters'),

    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Valid email is required')
        .normalizeEmail(),

    body('phone')
        .optional()
        .trim()
        .matches(/^[+]?[0-9\s\-()]{10,20}$/).withMessage('Valid phone number is required'),

    body('principalName')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Principal name must be max 100 characters'),

    body('website')
        .optional()
        .trim()
        .isURL().withMessage('Valid URL is required'),

    body('maxClasses')
        .optional()
        .isInt({ min: 1, max: 1000 }).withMessage('Max classes must be 1-1000')
];

/**
 * Validates request body for Teacher assignment
 * 
 * @returns {Array} Express-validator chain
 */
const validateAssignTeacher = () => [
    body('teacherId')
        .notEmpty().withMessage('Teacher ID is required')
        .custom(value => mongoose.Types.ObjectId.isValid(value))
        .withMessage('Invalid Teacher ID format'),

    body('schoolId')
        .notEmpty().withMessage('School ID is required')
        .custom(value => mongoose.Types.ObjectId.isValid(value))
        .withMessage('Invalid School ID format'),

    body('subjects')
        .optional()
        .isArray().withMessage('Subjects must be an array')
        .custom(value => value.length <= 20).withMessage('Maximum 20 subjects allowed'),

    body('subjects.*')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Each subject must be 1-100 characters')
];

/**
 * Validates request body for live class access
 * 
 * @returns {Array} Express-validator chain
 */
const validateLiveClassAccess = () => [
    body('classLoginId')
        .notEmpty().withMessage('Class Login ID is required')
        .custom(value => mongoose.Types.ObjectId.isValid(value))
        .withMessage('Invalid Class Login ID format'),

    body('password')
        .trim()
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 4, max: 100 }).withMessage('Password must be 4-100 characters'),

    body('deviceInfo')
        .optional()
        .isObject().withMessage('Device info must be an object'),

    body('deviceInfo.userAgent')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('User agent must be max 500 characters'),

    body('deviceInfo.deviceId')
        .optional()
        .trim()
        .isLength({ max: 200 }).withMessage('Device ID must be max 200 characters')
];

/**
 * Validates query parameters for pagination
 * 
 * @returns {Array} Express-validator chain
 */
const validatePagination = () => [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be positive integer')
        .default(1),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
        .default(20),

    query('sort')
        .optional()
        .trim()
        .isIn(['asc', 'desc', 'newest', 'oldest', 'name']).withMessage('Invalid sort value'),

    query('search')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Search term must be max 100 characters')
];

/**
 * Validates query parameters for device management
 * 
 * @returns {Array} Express-validator chain
 */
const validateDeviceQuery = () => [
    query('classLoginId')
        .optional()
        .custom(value => mongoose.Types.ObjectId.isValid(value))
        .withMessage('Invalid Class Login ID format'),

    query('activeOnly')
        .optional()
        .isBoolean().withMessage('activeOnly must be boolean')
        .toBoolean(),

    query('startDate')
        .optional()
        .isISO8601().withMessage('Start date must be ISO8601 format'),

    query('endDate')
        .optional()
        .isISO8601().withMessage('End date must be ISO8601 format')
        .custom((endDate, { req }) => {
            if (req.query.startDate && new Date(endDate) < new Date(req.query.startDate)) {
                throw new Error('End date must be after start date');
            }
            return true;
        })
];

/**
 * Validates request body for updating device limits
 * 
 * @returns {Array} Express-validator chain
 */
const validateUpdateDeviceLimit = () => [
    body('deviceLimit')
        .notEmpty().withMessage('Device limit is required')
        .isInt({ min: 1, max: 100 }).withMessage('Device limit must be 1-100'),

    body('reason')
        .optional()
        .trim()
        .isLength({ max: 200 }).withMessage('Reason must be max 200 characters')
];

/**
 * Validates JWT token structure (basic validation)
 * 
 * @returns {Array} Express-validator chain
 */
const validateToken = () => [
    body('token')
        .optional()
        .trim()
        .isJWT().withMessage('Valid JWT token is required'),

    query('token')
        .optional()
        .trim()
        .isJWT().withMessage('Valid JWT token is required')
];

/**
 * Main validation handler middleware
 * Processes validation results and formats errors
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        // Format validation errors
        const formattedErrors = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value,
            location: error.location
        }));

        // Log validation errors (but don't log sensitive data)
        logger.warn('Validation failed', {
            path: req.path,
            method: req.method,
            errorCount: formattedErrors.length,
            errors: formattedErrors.map(e => ({ field: e.field, message: e.message }))
        });

        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: formattedErrors,
            timestamp: new Date().toISOString()
        });
    }

    next();
};

/**
 * Sanitizes input data to prevent XSS attacks
 * Basic sanitization for string fields
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const sanitizeInput = (req, res, next) => {
    // Sanitize body
    if (req.body) {
        sanitizeObject(req.body);
    }

    // Sanitize query
    if (req.query) {
        sanitizeObject(req.query);
    }

    // Sanitize params
    if (req.params) {
        sanitizeObject(req.params);
    }

    next();
};

/**
 * Helper function to sanitize object properties
 * 
 * @param {Object} obj - Object to sanitize
 */
function sanitizeObject(obj) {
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            // Basic XSS prevention: remove script tags and dangerous attributes
            obj[key] = obj[key]
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+="[^"]*"/gi, '')
                .replace(/javascript:/gi, '')
                .trim();
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key]);
        }
    }
}

/**
 * Validates file upload requests
 * 
 * @param {string} fieldName - Field name containing the file
 * @param {number} maxSize - Maximum file size in bytes
 * @param {Array} allowedTypes - Allowed MIME types
 * @returns {Function} Middleware function
 */
const validateFileUpload = (fieldName, maxSize = 10 * 1024 * 1024, allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']) => {
    return [
        body(fieldName).custom((value, { req }) => {
            if (!req.file) {
                throw new Error('File is required');
            }

            // Check file size
            if (req.file.size > maxSize) {
                throw new Error(`File size must be less than ${maxSize / 1024 / 1024}MB`);
            }

            // Check file type
            if (!allowedTypes.includes(req.file.mimetype)) {
                throw new Error(`File type must be one of: ${allowedTypes.join(', ')}`);
            }

            return true;
        })
    ];
};

/**
 * Validates role-based access permissions
 * 
 * @param {Array} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
const validateRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            logger.warn('Role validation failed', {
                userId: req.user._id,
                userRole: req.user.role,
                allowedRoles,
                path: req.path
            });

            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

module.exports = {
    validateObjectIds,
    validateCreateClassLogin,
    validateCreateSchool,
    validateAssignTeacher,
    validateLiveClassAccess,
    validatePagination,
    validateDeviceQuery,
    validateUpdateDeviceLimit,
    validateToken,
    handleValidationErrors,
    sanitizeInput,
    validateFileUpload,
    validateRole,
    
    // Export express-validator for custom validations
    expressValidator: { body, query, param }
};
