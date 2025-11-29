const { ROLES, USER_STATUS } = require('../models/User');

/**
 * Middleware to check if student is approved
 * Prevents login for pending/rejected students
 */
const checkStudentApproval = (req, res, next) => {
  // Only check for student role
  if (req.user.role === ROLES.STUDENT) {
    if (req.user.status !== USER_STATUS.APPROVED) {
      return res.status(403).json({
        message: 'Account pending verification by school admin. Please contact your school administrator.',
        status: req.user.status,
        canLogin: false
      });
    }
    
    if (!req.user.isActive) {
      return res.status(403).json({
        message: 'Account is deactivated. Please contact support.',
        canLogin: false
      });
    }
  }
  
  next();
};

/**
 * Middleware to check if user can access dashboard based on role and status
 */
const checkDashboardAccess = (req, res, next) => {
  const user = req.user;
  
  // Student-specific checks
  if (user.role === ROLES.STUDENT && user.status !== USER_STATUS.APPROVED) {
    return res.status(403).json({
      message: 'Access denied. Account pending verification.',
      status: user.status
    });
  }
  
  // General active check
  if (!user.isActive) {
    return res.status(403).json({
      message: 'Account is deactivated'
    });
  }
  
  next();
};

module.exports = {
  checkStudentApproval,
  checkDashboardAccess
};
