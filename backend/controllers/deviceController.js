const DeviceService = require('../services/DeviceService');

const deviceController = {
  // Validate device before joining session
  validateDevice: async (req, res) => {
    try {
      const { userId, schoolId, sessionType, deviceFingerprint, deviceInfo } = req.body;
      
      const validationResult = await DeviceService.validateDeviceForSession(
        userId || req.user.userId,
        schoolId || req.user.schoolId,
        deviceFingerprint,
        sessionType || 'live-class',
        deviceInfo
      );

      res.json(validationResult);
    } catch (error) {
      console.error('Device validation error:', error);
      res.status(500).json({
        error: 'Device validation failed',
        message: error.message,
        valid: true, // Fail open - allow access
        allowAccess: true
      });
    }
  },

  // Get user's active devices
  getActiveDevices: async (req, res) => {
    try {
      const { userId, schoolId } = req.user;
      const devices = await DeviceService.getUserActiveDevices(userId, schoolId);
      
      // Add flag for current device
      const deviceFingerprint = req.headers['x-device-fingerprint'];
      const devicesWithCurrent = devices.map(device => ({
        ...device.toObject ? device.toObject() : device,
        isCurrentDevice: device.deviceFingerprint === deviceFingerprint
      }));
      
      res.json({ devices: devicesWithCurrent });
    } catch (error) {
      console.error('Error fetching active devices:', error);
      res.status(500).json({ error: 'Failed to fetch active devices' });
    }
  },

  // Logout from specific device
  logoutDevice: async (req, res) => {
    try {
      const { userId, schoolId } = req.user;
      const { deviceId } = req.params;
      
      const result = await DeviceService.logoutDevice(
        userId,
        schoolId,
        deviceId
      );
      
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error logging out device:', error);
      res.status(500).json({ error: 'Failed to logout device' });
    }
  },

  // Get device usage stats
  getDeviceStats: async (req, res) => {
    try {
      const { userId, schoolId } = req.user;
      const stats = await DeviceService.getDeviceStats(userId, schoolId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching device stats:', error);
      res.status(500).json({ error: 'Failed to fetch device stats' });
    }
  },

  // Admin: Get all devices for school
  getSchoolDevices: async (req, res) => {
    try {
      const { schoolId } = req.user;
      const { page = 1, limit = 50, role, activeOnly = true } = req.query;
      
      const devices = await DeviceService.getSchoolDevices(
        schoolId,
        parseInt(page),
        parseInt(limit),
        role,
        activeOnly === 'true'
      );
      
      res.json(devices);
    } catch (error) {
      console.error('Error fetching school devices:', error);
      res.status(500).json({ error: 'Failed to fetch school devices' });
    }
  },

  // Admin: Update device limits
  updateDeviceLimits: async (req, res) => {
    try {
      const { schoolId } = req.user;
      const { deviceLimits } = req.body;
      
      const updatedSchool = await DeviceService.updateDeviceLimits(
        schoolId,
        deviceLimits
      );
      
      res.json({ success: true, school: updatedSchool });
    } catch (error) {
      console.error('Error updating device limits:', error);
      res.status(500).json({ error: 'Failed to update device limits' });
    }
  },

  // Admin: Remove device from school
  adminRemoveDevice: async (req, res) => {
    try {
      const { schoolId } = req.user;
      const { deviceId, reason } = req.body;
      
      const result = await DeviceService.adminRemoveDevice(
        schoolId,
        deviceId,
        reason
      );
      
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error removing device:', error);
      res.status(500).json({ error: 'Failed to remove device' });
    }
  }
};

module.exports = deviceController;
