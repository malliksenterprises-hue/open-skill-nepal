const jwt = require('jsonwebtoken');

const auth = {
  // Middleware to verify JWT token
  verifyToken: (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ 
          error: 'Access denied. No token provided.',
          code: 'NO_TOKEN'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      console.error('Token verification error:', error.message);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  },

  // WebSocket token verification (returns decoded token or throws error)
  verifyWebSocketToken: (token) => {
    try {
      if (!token) {
        throw new Error('No token provided');
      }
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.error('WebSocket token verification error:', error.message);
      throw error;
    }
  },

  // Check if user is admin
  isAdmin: (req, res, next) => {
    if (req.user.role !== 'admin' && req.user.role !== 'school_admin') {
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.',
        code: 'ADMIN_REQUIRED'
      });
    }
    next();
  },

  // Check if user is teacher
  isTeacher: (req, res, next) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin' && req.user.role !== 'school_admin') {
      return res.status(403).json({ 
        error: 'Access denied. Teacher privileges required.',
        code: 'TEACHER_REQUIRED'
      });
    }
    next();
  },

  // Check if user is student
  isStudent: (req, res, next) => {
    if (req.user.role !== 'student') {
      return res.status(403).json({ 
        error: 'Access denied. Student privileges required.',
        code: 'STUDENT_REQUIRED'
      });
    }
    next();
  },

  // Check if user owns the resource
  isOwner: (modelName) => {
    return async (req, res, next) => {
      try {
        const Model = require(`../models/${modelName}`);
        const resource = await Model.findById(req.params.id);
        
        if (!resource) {
          return res.status(404).json({ error: 'Resource not found' });
        }
        
        // Check if user owns the resource or is admin
        if (resource.userId.toString() !== req.user.userId && 
            req.user.role !== 'admin' && 
            req.user.role !== 'school_admin') {
          return res.status(403).json({ 
            error: 'Access denied. You do not own this resource.',
            code: 'NOT_OWNER'
          });
        }
        
        next();
      } catch (error) {
        console.error('Ownership check error:', error);
        res.status(500).json({ error: 'Server error during ownership check' });
      }
    };
  },

  // Check if user belongs to the same school
  isSameSchool: (req, res, next) => {
    // For routes that require school ID in params
    if (req.params.schoolId && req.params.schoolId !== req.user.schoolId) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied. You do not belong to this school.',
          code: 'WRONG_SCHOOL'
        });
      }
    }
    next();
  }
};

module.exports = auth;
