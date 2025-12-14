const ClassLogin = require('../models/ClassLogin');
const Device = require('../models/Device');
const School = require('../models/School');
const Class = require('../models/Class');
const { generateToken } = require('../utils/jwt');
const { validateRequest } = require('../utils/validation');
const logger = require('../utils/logger');

/**
 * @class ClassLoginController
 * Handles all Class Login related operations
 */
class ClassLoginController {
  
  /**
   * Create a new Class Login
   * ONLY School Admin can create (Phase 3 fix)
   */
  static async createClassLogin(req, res) {
    try {
      const { schoolId, classId, loginId, password, maxDevices, expiresAt } = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // PHASE 3 FIX: Only School Admin can create Class Logins
      if (userRole !== 'schoolAdmin') {
        return res.status(403).json({
          success: false,
          message: 'Only School Admin can create Class Logins'
        });
      }
      
      // Validate required fields
      const errors = validateRequest(req.body, [
        'schoolId', 'classId', 'loginId', 'password', 'maxDevices'
      ]);
      
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          errors
        });
      }
      
      // PHASE 3 FIX: School Admin can only create for their own school
      const school = await School.findOne({
        _id: schoolId,
        adminId: userId  // Only check adminId, not managers
      });
      
      if (!school) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to create Class Login for this school'
        });
      }
      
      // Check if class exists and belongs to school
      const classExists = await Class.findOne({
        _id: classId,
        schoolId: schoolId
      });
      
      if (!classExists) {
        return res.status(404).json({
          success: false,
          message: 'Class not found in this school'
        });
      }
      
      // Check if loginId already exists
      const existingLogin = await ClassLogin.findByLoginId(loginId);
      if (existingLogin) {
        return res.status(409).json({
          success: false,
          message: 'Login ID already exists'
        });
      }
      
      // Create Class Login
      const classLogin = new ClassLogin({
        loginId: loginId.toUpperCase(),
        password,
        schoolId,
        classId,
        maxDevices: parseInt(maxDevices) || 1,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: userId,
        isActive: true
      });
      
      await classLogin.save();
      
      // Log the creation
      logger.info(`Class Login created: ${classLogin.loginId}`, {
        userId,
        schoolId,
        classId,
        classLoginId: classLogin._id
      });
      
      res.status(201).json({
        success: true,
        data: classLogin,
        message: 'Class Login created successfully'
      });
      
    } catch (error) {
      logger.error('Error creating Class Login:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Authenticate Class Login
   * Used by students to access live classes
   */
  static async authenticate(req, res) {
    try {
      const { loginId, password, deviceInfo } = req.body;
      
      // Validate required fields
      if (!loginId || !password) {
        return res.status(400).json({
          success: false,
          message: 'Login ID and password are required'
        });
      }
      
      // Find Class Login
      const classLogin = await ClassLogin.findByLoginId(loginId);
      
      if (!classLogin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Check if Class Login is active
      if (!classLogin.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Class Login is disabled'
        });
      }
      
      // Check if expired
      if (classLogin.isExpired()) {
        return res.status(403).json({
          success: false,
          message: 'Class Login has expired'
        });
      }
      
      // Verify password
      const isPasswordValid = await classLogin.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Get device information
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'] || '';
      const deviceHash = Device.generateDeviceHash(ipAddress, userAgent);
      
      // Check for existing device
      let device = await Device.findOne({
        classLoginId: classLogin._id,
        deviceHash
      });
      
      let isNewDevice = false;
      
      if (!device) {
        // Check device limit
        const activeDeviceCount = await Device.countActiveByClassLogin(classLogin._id);
        
        if (activeDeviceCount >= classLogin.maxDevices) {
          return res.status(403).json({
            success: false,
            message: 'Device limit reached. Maximum devices allowed: ' + classLogin.maxDevices
          });
        }
        
        // Create new device record
        isNewDevice = true;
        device = new Device({
          deviceHash,
          classLoginId: classLogin._id,
          ipAddress,
          userAgent,
          browser: deviceInfo?.browser || '',
          os: deviceInfo?.os || '',
          deviceType: deviceInfo?.deviceType || 'unknown',
          sessionId: Device.generateSessionId(),
          isActive: true
        });
        
        await device.save();
        
        // Update current device count
        await ClassLogin.findByIdAndUpdate(classLogin._id, {
          $inc: { currentDevices: 1 },
          lastUsed: new Date()
        });
      } else {
        // Update existing device
        device.lastActive = new Date();
        device.isActive = true;
        await device.save();
        
        // Update last used
        classLogin.lastUsed = new Date();
        await classLogin.save();
      }
      
      // Generate JWT token for Class Login
      const token = generateToken({
        id: classLogin._id,
        loginId: classLogin.loginId,
        schoolId: classLogin.schoolId,
        classId: classLogin.classId,
        role: 'classLogin',
        deviceId: device._id,
        sessionId: device.sessionId
      });
      
      // Log authentication
      logger.info(`Class Login authenticated: ${classLogin.loginId}`, {
        classLoginId: classLogin._id,
        schoolId: classLogin.schoolId,
        classId: classLogin.classId,
        deviceId: device._id,
        isNewDevice
      });
      
      res.json({
        success: true,
        data: {
          token,
          classLogin: {
            id: classLogin._id,
            loginId: classLogin.loginId,
            schoolId: classLogin.schoolId,
            classId: classLogin.classId,
            maxDevices: classLogin.maxDevices,
            expiresAt: classLogin.expiresAt
          },
          device: {
            id: device._id,
            sessionId: device.sessionId,
            isNewDevice
          }
        },
        message: 'Authentication successful'
      });
      
    } catch (error) {
      logger.error('Error authenticating Class Login:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Get Class Logins for a school
   * Only School Admin can view their own school's logins (Phase 3 fix)
   */
  static async getBySchool(req, res) {
    try {
      const { schoolId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // PHASE 3 FIX: Restrict access based on role
      if (userRole === 'schoolAdmin') {
        // School Admin can only access their own school
        const school = await School.findOne({
          _id: schoolId,
          adminId: userId  // Only adminId, not managers
        });
        
        if (!school) {
          return res.status(403).json({
            success: false,
            message: 'Unauthorized to view Class Logins for this school'
          });
        }
      } else if (userRole === 'superAdmin' || userRole === 'admin') {
        // Super Admin and Admin can access any school
        // No additional check needed
      } else {
        // Teachers, Students, ClassLogin cannot view Class Logins
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }
      
      // Get Class Logins with pagination
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      const query = { schoolId };
      
      // Filter by status if provided
      if (req.query.status === 'active') {
        query.isActive = true;
      } else if (req.query.status === 'inactive') {
        query.isActive = false;
      }
      
      // Filter by class if provided
      if (req.query.classId) {
        query.classId = req.query.classId;
      }
      
      // Execute query
      const [classLogins, total] = await Promise.all([
        ClassLogin.find(query)
          .populate('classId', 'name grade')
          .populate('createdBy', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        ClassLogin.countDocuments(query)
      ]);
      
      res.json({
        success: true,
        data: classLogins,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
      
    } catch (error) {
      logger.error('Error fetching Class Logins:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Update Class Login
   * ONLY School Admin can update (Phase 3 fix)
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // PHASE 3 FIX: Only School Admin can update Class Logins
      if (userRole !== 'schoolAdmin') {
        return res.status(403).json({
          success: false,
          message: 'Only School Admin can update Class Logins'
        });
      }
      
      // Find Class Login
      const classLogin = await ClassLogin.findById(id);
      
      if (!classLogin) {
        return res.status(404).json({
          success: false,
          message: 'Class Login not found'
        });
      }
      
      // PHASE 3 FIX: School Admin can only update their own school's logins
      const school = await School.findOne({
        _id: classLogin.schoolId,
        adminId: userId  // Only adminId, not managers
      });
      
      if (!school) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to update this Class Login'
        });
      }
      
      // Prevent updating loginId
      if (updates.loginId) {
        delete updates.loginId;
      }
      
      // If updating maxDevices, validate
      if (updates.maxDevices) {
        const maxDevices = parseInt(updates.maxDevices);
        if (maxDevices < 1 || maxDevices > 50) {
          return res.status(400).json({
            success: false,
            message: 'maxDevices must be between 1 and 50'
          });
        }
        
        // Check if new limit is less than current devices
        const activeDeviceCount = await Device.countActiveByClassLogin(classLogin._id);
        if (maxDevices < activeDeviceCount) {
          return res.status(400).json({
            success: false,
            message: `Cannot set maxDevices to ${maxDevices}. There are ${activeDeviceCount} active devices.`
          });
        }
      }
      
      // Update password if provided
      if (updates.password) {
        classLogin.password = updates.password;
        delete updates.password;
      }
      
      // Apply other updates
      Object.keys(updates).forEach(key => {
        if (key in classLogin) {
          classLogin[key] = updates[key];
        }
      });
      
      await classLogin.save();
      
      logger.info(`Class Login updated: ${classLogin.loginId}`, {
        userId,
        classLoginId: classLogin._id,
        updates: Object.keys(updates)
      });
      
      res.json({
        success: true,
        data: classLogin,
        message: 'Class Login updated successfully'
      });
      
    } catch (error) {
      logger.error('Error updating Class Login:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Delete (deactivate) Class Login
   * ONLY School Admin can delete (Phase 3 fix)
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // PHASE 3 FIX: Only School Admin can delete Class Logins
      if (userRole !== 'schoolAdmin') {
        return res.status(403).json({
          success: false,
          message: 'Only School Admin can delete Class Logins'
        });
      }
      
      // Find Class Login
      const classLogin = await ClassLogin.findById(id);
      
      if (!classLogin) {
        return res.status(404).json({
          success: false,
          message: 'Class Login not found'
        });
      }
      
      // PHASE 3 FIX: School Admin can only delete their own school's logins
      const school = await School.findOne({
        _id: classLogin.schoolId,
        adminId: userId  // Only adminId, not managers
      });
      
      if (!school) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to delete this Class Login'
        });
      }
      
      // Soft delete
      classLogin.isActive = false;
      await classLogin.save();
      
      // Deactivate all devices for this Class Login
      await Device.updateMany(
        { classLoginId: classLogin._id },
        { isActive: false }
      );
      
      logger.info(`Class Login deactivated: ${classLogin.loginId}`, {
        userId,
        classLoginId: classLogin._id
      });
      
      res.json({
        success: true,
        message: 'Class Login deactivated successfully'
      });
      
    } catch (error) {
      logger.error('Error deleting Class Login:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Get active devices for a Class Login
   */
  static async getActiveDevices(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Find Class Login
      const classLogin = await ClassLogin.findById(id);
      
      if (!classLogin) {
        return res.status(404).json({
          success: false,
          message: 'Class Login not found'
        });
      }
      
      // PHASE 3 FIX: Restrict device view access
      if (userRole === 'schoolAdmin') {
        // School Admin can only view their own school's devices
        const school = await School.findOne({
          _id: classLogin.schoolId,
          adminId: userId
        });
        
        if (!school) {
          return res.status(403).json({
            success: false,
            message: 'Unauthorized to view devices for this Class Login'
          });
        }
      } else if (userRole === 'superAdmin' || userRole === 'admin') {
        // Super Admin and Admin can view any school's devices
        // No additional check needed
      } else {
        // Teachers, Students, ClassLogin cannot view devices
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to view devices'
        });
      }
      
      // Get active devices
      const devices = await Device.findActiveByClassLogin(classLogin._id);
      
      res.json({
        success: true,
        data: {
          classLogin: {
            id: classLogin._id,
            loginId: classLogin.loginId,
            maxDevices: classLogin.maxDevices,
            currentDevices: devices.length
          },
          devices
        }
      });
      
    } catch (error) {
      logger.error('Error fetching active devices:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Revoke a device from Class Login
   */
  static async revokeDevice(req, res) {
    try {
      const { id, deviceId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // PHASE 3 FIX: Only School Admin, Admin, Super Admin can revoke devices
      if (!['schoolAdmin', 'admin', 'superAdmin'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to revoke devices'
        });
      }
      
      // Find Class Login
      const classLogin = await ClassLogin.findById(id);
      
      if (!classLogin) {
        return res.status(404).json({
          success: false,
          message: 'Class Login not found'
        });
      }
      
      // Check permission based on role
      if (userRole === 'schoolAdmin') {
        // School Admin can only revoke from their own school
        const school = await School.findOne({
          _id: classLogin.schoolId,
          adminId: userId
        });
        
        if (!school) {
          return res.status(403).json({
            success: false,
            message: 'Unauthorized to revoke devices for this Class Login'
          });
        }
      }
      // Admin and Super Admin can revoke from any school (no additional check)
      
      // Find and deactivate device
      const device = await Device.findOneAndUpdate(
        { _id: deviceId, classLoginId: classLogin._id },
        { isActive: false },
        { new: true }
      );
      
      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }
      
      // Update current device count
      const activeDeviceCount = await Device.countActiveByClassLogin(classLogin._id);
      classLogin.currentDevices = activeDeviceCount;
      await classLogin.save();
      
      logger.info(`Device revoked from Class Login: ${classLogin.loginId}`, {
        userId,
        classLoginId: classLogin._id,
        deviceId: device._id
      });
      
      res.json({
        success: true,
        message: 'Device revoked successfully'
      });
      
    } catch (error) {
      logger.error('Error revoking device:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Reset all devices for a Class Login
   * ONLY School Admin, Admin, Super Admin can reset (Phase 3 fix)
   */
  static async resetDevices(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // PHASE 3 FIX: Only School Admin, Admin, Super Admin can reset devices
      if (!['schoolAdmin', 'admin', 'superAdmin'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to reset devices'
        });
      }
      
      // Find Class Login
      const classLogin = await ClassLogin.findById(id);
      
      if (!classLogin) {
        return res.status(404).json({
          success: false,
          message: 'Class Login not found'
        });
      }
      
      // Check permission based on role
      if (userRole === 'schoolAdmin') {
        // School Admin can only reset their own school's devices
        const school = await School.findOne({
          _id: classLogin.schoolId,
          adminId: userId
        });
        
        if (!school) {
          return res.status(403).json({
            success: false,
            message: 'Unauthorized to reset devices for this Class Login'
          });
        }
      }
      // Admin and Super Admin can reset any school's devices (no additional check)
      
      // Deactivate all devices
      await Device.updateMany(
        { classLoginId: classLogin._id },
        { isActive: false }
      );
      
      // Reset device count
      classLogin.currentDevices = 0;
      await classLogin.save();
      
      logger.info(`All devices reset for Class Login: ${classLogin.loginId}`, {
        userId,
        classLoginId: classLogin._id
      });
      
      res.json({
        success: true,
        message: 'All devices have been reset. Users will need to re-authenticate.'
      });
      
    } catch (error) {
      logger.error('Error resetting devices:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = ClassLoginController;
