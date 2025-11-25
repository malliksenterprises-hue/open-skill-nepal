const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        message: 'No token provided, access denied',
        code: 'NO_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Token is invalid, user not found',
        code: 'INVALID_TOKEN'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // For students, check if they are approved
    if (user.role === 'student' && user.status !== 'approved') {
      return res.status(403).json({ 
        message: 'Account pending approval from school admin',
        status: user.status,
        code: 'PENDING_APPROVAL'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    res.status(500).json({ 
      message: 'Server error in authentication',
      code: 'AUTH_SERVER_ERROR'
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        userRole: req.user.role,
        code: 'ROLE_ACCESS_DENIED'
      });
    }

    next();
  };
};

// Specific role middlewares for convenience
const requireStudent = requireRole('student');
const requireTeacher = requireRole('teacher');
const requireSchoolAdmin = requireRole('school_admin');
const requireAdmin = requireRole('admin');
const requireSuperAdmin = requireRole('super_admin');

// Combined role middlewares
const requireSchoolStaff = requireRole(['school_admin', 'teacher']);
const requireAnyAdmin = requireRole(['admin', 'super_admin']);

module.exports = {
  auth,
  requireRole,
  requireStudent,
  requireTeacher,
  requireSchoolAdmin,
  requireAdmin,
  requireSuperAdmin,
  requireSchoolStaff,
  requireAnyAdmin
};
