const Device = require('../models/Device');
const School = require('../models/School');

class DeviceService {
  /**
   * Validate if a device can join a session based on device limits
   */
  static async validateDeviceForSession(userId, schoolId, deviceFingerprint, sessionType = 'live-class', deviceInfo = {}, userRole = null) {
    try {
      // First, get or create device
      let device = await Device.findOne({
        userId,
        schoolId,
        deviceFingerprint
      });

      const now = new Date();
      
      if (!device) {
        // New device - create it
        device = new Device({
          userId,
          schoolId,
          deviceFingerprint,
          userAgent: deviceInfo.userAgent || 'unknown',
          platform: deviceInfo.platform || 'web',
          browser: deviceInfo.browser || { name: 'unknown', version: 'unknown' },
          os: deviceInfo.os || { name: 'unknown', version: 'unknown' },
          ipAddress: deviceInfo.ipAddress || 'unknown',
          isActive: true,
          sessionCount: 1,
          lastSessionType: sessionType,
          lastSessionAt: now
        });
      } else {
        // Existing device - update session count
        device.sessionCount += 1;
        device.lastSessionType = sessionType;
        device.lastSessionAt = now;
        device.updatedAt = now;
        
        // Reactivate if previously removed
        if (!device.isActive) {
          device.isActive = true;
          device.removedReason = null;
          device.removedAt = null;
        }
      }

      // Get user role and school device limits
      const school = await School.findById(schoolId);
      const limit = school?.deviceLimits?.[userRole] || 
                   (userRole === 'admin' ? 3 : 
                    userRole === 'teacher' ? 5 : 
                    userRole === 'student' ? 2 : 2);

      // Check active devices count
      const activeDevicesCount = await Device.countDocuments({
        userId,
        schoolId,
        isActive: true,
        removedAt: null
      });

      // Check if adding this device would exceed limit
      if (!device.isActive && activeDevicesCount >= limit) {
        return {
          valid: false,
          reason: 'device-limit-exceeded',
          limit,
          current: activeDevicesCount,
          role: userRole,
          message: `Device limit exceeded. Maximum ${limit} devices allowed for ${userRole} role.`
        };
      }

      // If device is already active, we're just updating it
      await device.save();

      return {
        valid: true,
        limit,
        current: device.isActive ? activeDevicesCount : activeDevicesCount + 1,
        isNewDevice: !device._id,
        deviceId: device._id,
        sessionCount: device.sessionCount
      };

    } catch (error) {
      console.error('Device validation error:', error);
      // Fail open - allow access in case of errors
      return {
        valid: true,
        allowAccess: true,
        error: true,
        message: 'Device validation service temporarily unavailable'
      };
    }
  }

  /**
   * Update device session info
   */
  static async updateDeviceSessionInfo(userId, schoolId, deviceFingerprint, sessionData = {}) {
    try {
      const updateData = {
        lastSessionAt: new Date(),
        updatedAt: new Date(),
        ...sessionData
      };

      if (sessionData.sessionType) {
        updateData.lastSessionType = sessionData.sessionType;
      }

      const device = await Device.findOneAndUpdate(
        { userId, schoolId, deviceFingerprint },
        {
          $set: updateData,
          $inc: { sessionCount: 1 },
          $setOnInsert: {
            userAgent: sessionData.userAgent || 'unknown',
            platform: sessionData.platform || 'web',
            isActive: true
          }
        },
        { upsert: true, new: true }
      );

      return device;
    } catch (error) {
      console.error('Error updating device session info:', error);
      throw error;
    }
  }

  /**
   * Update device activity (heartbeat)
   */
  static async updateDeviceActivity(userId, schoolId, deviceFingerprint) {
    try {
      await Device.findOneAndUpdate(
        { userId, schoolId, deviceFingerprint },
        { $set: { lastActiveAt: new Date(), updatedAt: new Date() } }
      );
      return true;
    } catch (error) {
      console.error('Error updating device activity:', error);
      return false;
    }
  }

  /**
   * Update device on disconnect
   */
  static async updateDeviceDisconnect(userId, schoolId, deviceFingerprint, disconnectReason = 'normal') {
    try {
      await Device.findOneAndUpdate(
        { userId, schoolId, deviceFingerprint },
        { 
          $set: { 
            lastActiveAt: new Date(),
            disconnectReason,
            updatedAt: new Date()
          }
        }
      );
      return true;
    } catch (error) {
      console.error('Error updating device disconnect:', error);
      return false;
    }
  }

  /**
   * Get user's active devices
   */
  static async getUserActiveDevices(userId, schoolId) {
    try {
      const devices = await Device.find({
        userId,
        schoolId,
        isActive: true,
        removedAt: null
      }).sort({ lastSessionAt: -1 });

      return devices;
    } catch (error) {
      console.error('Error getting active devices:', error);
      return [];
    }
  }

  /**
   * Logout from a specific device
   */
  static async logoutDevice(userId, schoolId, deviceId) {
    try {
      const device = await Device.findOne({
        _id: deviceId,
        userId,
        schoolId
      });

      if (!device) {
        return { success: false, error: 'Device not found' };
      }

      device.isActive = false;
      device.removedReason = 'device-limit';
      device.removedAt = new Date();
      device.updatedAt = new Date();
      await device.save();

      return {
        success: true,
        deviceId: device._id,
        deviceFingerprint: device.deviceFingerprint,
        message: 'Device logged out successfully'
      };
    } catch (error) {
      console.error('Error logging out device:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get device stats for user
   */
  static async getDeviceStats(userId, schoolId) {
    try {
      const school = await School.findById(schoolId);
      const activeDevices = await Device.countDocuments({
        userId,
        schoolId,
        isActive: true,
        removedAt: null
      });

      const totalDevices = await Device.countDocuments({ userId, schoolId });
      const recentDevices = await Device.find({
        userId,
        schoolId,
        lastSessionAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).sort({ lastSessionAt: -1 }).limit(10);

      const limit = school?.deviceLimits?.student || 2; // Default to student limit

      return {
        activeDevices,
        totalDevices,
        limit,
        availableSlots: Math.max(0, limit - activeDevices),
        recentDevices: recentDevices.map(d => ({
          id: d._id,
          deviceFingerprint: d.deviceFingerprint,
          platform: d.platform,
          lastSessionAt: d.lastSessionAt,
          sessionCount: d.sessionCount
        }))
      };
    } catch (error) {
      console.error('Error getting device stats:', error);
      throw error;
    }
  }

  /**
   * Cleanup inactive devices (cron job)
   */
  static async cleanupInactiveDevices(schoolId) {
    try {
      const school = await School.findById(schoolId);
      const autoCleanupDays = school?.deviceManagement?.autoCleanupDays || 30;
      const cutoffDate = new Date(Date.now() - autoCleanupDays * 24 * 60 * 60 * 1000);

      const result = await Device.updateMany(
        {
          schoolId,
          lastSessionAt: { $lt: cutoffDate },
          isActive: true
        },
        {
          $set: {
            isActive: false,
            removedReason: 'inactive',
            removedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      return {
        success: true,
        cleanedCount: result.modifiedCount
      };
    } catch (error) {
      console.error('Error cleaning up inactive devices:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all devices for school (admin view)
   */
  static async getSchoolDevices(schoolId, page = 1, limit = 50, role = null, activeOnly = true) {
    try {
      const query = { schoolId };
      if (role) query.role = role;
      if (activeOnly) {
        query.isActive = true;
        query.removedAt = null;
      }

      const skip = (page - 1) * limit;

      const devices = await Device.find(query)
        .populate('userId', 'name email role')
        .sort({ lastSessionAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Device.countDocuments(query);

      return {
        devices,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting school devices:', error);
      throw error;
    }
  }
}

module.exports = DeviceService;
