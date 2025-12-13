const Device = require('../models/Device');
const ClassLogin = require('../models/ClassLogin');
const School = require('../models/School');
const logger = require('../utils/logger');

/**
 * @class DeviceController
 * Handles device tracking and validation operations for Class Logins
 */
class DeviceController {
  
  /**
   * Validate device for live class access (real-time validation)
   * Called before allowing any live class stream
   * Only for Class Login role
   */
  static async validateDevice(req, res) {
    try {
      const { classLoginId, sessionId } = req.user; // From JWT
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'] || '';
      
      // Find Class Login
      const classLogin = await ClassLogin.findById(classLoginId);
      
      if (!classLogin) {
        return res.status(404).json({
          success: false,
          message: 'Class Login not found',
          code: 'CLASS_LOGIN_NOT_FOUND'
        });
      }
      
      // Check if Class Login is active
      if (!classLogin.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Class Login is disabled',
          code: 'CLASS_LOGIN_DISABLED'
        });
      }
      
      // Check if expired
      if (classLogin.isExpired()) {
        return res.status(403).json({
          success: false,
          message: 'Class Login has expired',
          code: 'CLASS_LOGIN_EXPIRED'
        });
      }
      
      // Generate device hash for validation
      const deviceHash = Device.generateDeviceHash(ipAddress, userAgent);
      
      // Find active device session
      const device = await Device.findOne({
        classLoginId: classLoginId,
        sessionId: sessionId,
        deviceHash: deviceHash,
        isActive: true
      });
      
      if (!device) {
        return res.status(403).json({
          success: false,
          message: 'Device session not found or inactive',
          code: 'DEVICE_SESSION_INVALID'
        });
      }
      
      // Check if device is stale (inactive > 24h)
      if (device.isStale()) {
        device.isActive = false;
        await device.save();
        
        // Update device count
        const activeCount = await Device.countActiveByClassLogin(classLoginId);
        await ClassLogin.findByIdAndUpdate(classLoginId, {
          currentDevices: activeCount
        });
        
        return res.status(403).json({
          success: false,
          message: 'Session expired. Please re-authenticate.',
          code: 'SESSION_EXPIRED'
        });
      }
      
      // Update last active timestamp
      await device.updateLastActive();
      
      // Update Class Login last used
      classLogin.lastUsed = new Date();
      await classLogin.save();
      
      logger.debug(`Device validated for live class access`, {
        classLoginId: classLogin._id,
        deviceId: device._id,
        schoolId: classLogin.schoolId
      });
      
      res.json({
        success: true,
        data: {
          classLogin: {
            id: classLogin._id,
            loginId: classLogin.loginId,
            maxDevices: classLogin.maxDevices
          },
          device: {
            id: device._id,
            lastActive: device.lastActive
          },
          validation: {
            isValid: true,
            expiresAt: new Date(device.lastActive.getTime() + 24 * 60 * 60 * 1000)
          }
        },
        message: 'Device validated successfully'
      });
      
    } catch (error) {
      logger.error('Error validating device:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Get all devices for a Class Login
   * School Admin and above can access
   */
  static async getDevicesByClassLogin(req, res) {
    try {
      const { classLoginId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Find Class Login
      const classLogin = await ClassLogin.findById(classLoginId);
      
      if (!classLogin) {
        return res.status(404).json({
          success: false,
          message: 'Class Login not found'
        });
      }
      
      // Permission check based on role hierarchy
      let hasPermission = false;
      
      if (userRole === 'superAdmin') {
        // Super Admin has access to everything
        hasPermission = true;
      } else if (userRole === 'admin') {
        // Admin can access if they manage Open Skill Nepal
        hasPermission = true;
      } else if (userRole === 'schoolAdmin') {
        // School Admin can access only their school's Class Logins
        const school = await School.findOne({
          _id: classLogin.schoolId,
          adminId: userId
        });
        hasPermission = !!school;
      }
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view devices for this Class Login'
        });
      }
      
      // Get devices with pagination
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;
      
      const query = { classLoginId: classLoginId };
      
      // Filter by active status
      if (req.query.status === 'active') {
        query.isActive = true;
        query.lastActive = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
      } else if (req.query.status === 'inactive') {
        query.$or = [
          { isActive: false },
          { lastActive: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        ];
      }
      
      // Execute query
      const [devices, total] = await Promise.all([
        Device.find(query)
          .sort({ lastActive: -1 })
          .skip(skip)
          .limit(limit),
        Device.countDocuments(query)
      ]);
      
      // Get active device count
      const activeCount = await Device.countActiveByClassLogin(classLoginId);
      
      res.json({
        success: true,
        data: {
          classLogin: {
            id: classLogin._id,
            loginId: classLogin.loginId,
            maxDevices: classLogin.maxDevices,
            activeDevices: activeCount
          },
          devices,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
      
    } catch (error) {
      logger.error('Error fetching devices:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Force logout a specific device
   * School Admin and above can revoke
   */
  static async forceLogoutDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Find device
      const device = await Device.findById(deviceId);
      
      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Device not found'
        });
      }
      
      // Find Class Login
      const classLogin = await ClassLogin.findById(device.classLoginId);
      
      if (!classLogin) {
        return res.status(404).json({
          success: false,
          message: 'Class Login not found'
        });
      }
      
      // Permission check based on role hierarchy
      let hasPermission = false;
      
      if (userRole === 'superAdmin') {
        hasPermission = true;
      } else if (userRole === 'admin') {
        hasPermission = true;
      } else if (userRole === 'schoolAdmin') {
        const school = await School.findOne({
          _id: classLogin.schoolId,
          adminId: userId
        });
        hasPermission = !!school;
      }
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to revoke this device'
        });
      }
      
      // Deactivate device
      device.isActive = false;
      await device.save();
      
      // Update active device count
      const activeCount = await Device.countActiveByClassLogin(classLogin._id);
      await ClassLogin.findByIdAndUpdate(classLogin._id, {
        currentDevices: activeCount
      });
      
      logger.info(`Device force logged out`, {
        userId,
        userRole,
        deviceId: device._id,
        classLoginId: classLogin._id,
        schoolId: classLogin.schoolId
      });
      
      res.json({
        success: true,
        message: 'Device has been logged out successfully'
      });
      
    } catch (error) {
      logger.error('Error force logging out device:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Get device analytics for a school
   * Shows device usage patterns
   */
  static async getSchoolDeviceAnalytics(req, res) {
    try {
      const { schoolId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Permission check
      let hasPermission = false;
      
      if (userRole === 'superAdmin') {
        hasPermission = true;
      } else if (userRole === 'admin') {
        hasPermission = true;
      } else if (userRole === 'schoolAdmin') {
        const school = await School.findOne({
          _id: schoolId,
          adminId: userId
        });
        hasPermission = !!school;
      }
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view analytics for this school'
        });
      }
      
      // Get Class Logins for this school
      const classLogins = await ClassLogin.find({ schoolId: schoolId });
      const classLoginIds = classLogins.map(cl => cl._id);
      
      // Calculate time ranges
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      
      // Get analytics data
      const [
        totalDevices,
        activeDevicesToday,
        activeDevicesThisWeek,
        deviceByType,
        devicesByClassLogin
      ] = await Promise.all([
        // Total devices ever registered
        Device.countDocuments({ classLoginId: { $in: classLoginIds } }),
        
        // Active devices today
        Device.countDocuments({
          classLoginId: { $in: classLoginIds },
          isActive: true,
          lastActive: { $gte: todayStart }
        }),
        
        // Active devices this week
        Device.countDocuments({
          classLoginId: { $in: classLoginIds },
          isActive: true,
          lastActive: { $gte: weekStart }
        }),
        
        // Devices by type
        Device.aggregate([
          { $match: { classLoginId: { $in: classLoginIds } } },
          { $group: { _id: '$deviceType', count: { $sum: 1 } } }
        ]),
        
        // Devices per Class Login
        Device.aggregate([
          { $match: { classLoginId: { $in: classLoginIds } } },
          {
            $group: {
              _id: '$classLoginId',
              totalDevices: { $sum: 1 },
              activeDevices: {
                $sum: {
                  $cond: [
                    { 
                      $and: [
                        { $eq: ['$isActive', true] },
                        { $gte: ['$lastActive', new Date(Date.now() - 24 * 60 * 60 * 1000)] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          },
          {
            $lookup: {
              from: 'classlogins',
              localField: '_id',
              foreignField: '_id',
              as: 'classLogin'
            }
          },
          { $unwind: '$classLogin' },
          {
            $project: {
              classLoginId: '$_id',
              loginId: '$classLogin.loginId',
              maxDevices: '$classLogin.maxDevices',
              totalDevices: 1,
              activeDevices: 1,
              usagePercentage: {
                $multiply: [
                  { $divide: ['$activeDevices', '$classLogin.maxDevices'] },
                  100
                ]
              }
            }
          },
          { $sort: { usagePercentage: -1 } }
        ])
      ]);
      
      res.json({
        success: true,
        data: {
          summary: {
            totalDevices,
            activeDevicesToday,
            activeDevicesThisWeek,
            classLoginsCount: classLogins.length
          },
          deviceByType: deviceByType.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
          }, {}),
          devicesByClassLogin,
          timestamp: now.toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Error fetching device analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Clean up stale devices (cron job endpoint)
   * Internal use only - requires admin permissions
   */
  static async cleanupStaleDevices(req, res) {
    try {
      const userRole = req.user.role;
      
      // Only superAdmin and admin can trigger cleanup
      if (userRole !== 'superAdmin' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to perform cleanup'
        });
      }
      
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Find and deactivate stale devices
      const result = await Device.updateMany(
        {
          isActive: true,
          lastActive: { $lt: twentyFourHoursAgo }
        },
        {
          isActive: false
        }
      );
      
      // Update all Class Login device counts
      const classLogins = await ClassLogin.find({});
      
      for (const classLogin of classLogins) {
        const activeCount = await Device.countActiveByClassLogin(classLogin._id);
        classLogin.currentDevices = activeCount;
        await classLogin.save();
      }
      
      logger.info(`Stale devices cleanup completed`, {
        devicesDeactivated: result.modifiedCount,
        triggeredBy: req.user.id
      });
      
      res.json({
        success: true,
        message: `Cleanup completed. ${result.modifiedCount} devices deactivated.`,
        data: {
          devicesDeactivated: result.modifiedCount,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      logger.error('Error during device cleanup:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
  
  /**
   * Check device limit before joining live class
   * This is a pre-validation step
   */
  static async checkDeviceLimit(req, res) {
    try {
      const { classLoginId } = req.params;
      const { deviceInfo } = req.body;
      
      // Find Class Login
      const classLogin = await ClassLogin.findById(classLoginId);
      
      if (!classLogin) {
        return res.status(404).json({
          success: false,
          message: 'Class Login not found'
        });
      }
      
      // Check if device limit is reached
      const activeDeviceCount = await Device.countActiveByClassLogin(classLoginId);
      const isLimitReached = activeDeviceCount >= classLogin.maxDevices;
      
      // Generate device hash for pre-check
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'] || '';
      const deviceHash = Device.generateDeviceHash(ipAddress, userAgent);
      
      // Check if this device already has an active session
      const existingDevice = await Device.findOne({
        classLoginId: classLoginId,
        deviceHash: deviceHash,
        isActive: true,
        lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      
      res.json({
        success: true,
        data: {
          classLogin: {
            id: classLogin._id,
            loginId: classLogin.loginId,
            maxDevices: classLogin.maxDevices,
            currentDevices: activeDeviceCount
          },
          deviceCheck: {
            isLimitReached,
            hasExistingSession: !!existingDevice,
            canJoin: !isLimitReached || !!existingDevice
          }
        }
      });
      
    } catch (error) {
      logger.error('Error checking device limit:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

module.exports = DeviceController;
