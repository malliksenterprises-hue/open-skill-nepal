const express = require('express');
const router = express.Router();
const DeviceController = require('../controllers/deviceController');
const { authenticate, authorize } = require('../middleware/auth.middleware');

/**
 * @route POST /api/devices/validate
 * @desc Validate device for live class access (real-time validation)
 * @access Private (Class Login only)
 * @note This is called before allowing any live class stream
 */
router.post(
  '/validate',
  authenticate,
  authorize(['classLogin']), // Only Class Login role can validate
  DeviceController.validateDevice
);

/**
 * @route GET /api/devices/class-login/:classLoginId
 * @desc Get all devices for a Class Login
 * @access Private (School Admin, Admin, Super Admin)
 */
router.get(
  '/class-login/:classLoginId',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  DeviceController.getDevicesByClassLogin
);

/**
 * @route POST /api/devices/:deviceId/logout
 * @desc Force logout a specific device
 * @access Private (School Admin, Admin, Super Admin)
 */
router.post(
  '/:deviceId/logout',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  DeviceController.forceLogoutDevice
);

/**
 * @route GET /api/devices/analytics/school/:schoolId
 * @desc Get device analytics for a school
 * @access Private (School Admin, Admin, Super Admin)
 */
router.get(
  '/analytics/school/:schoolId',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  DeviceController.getSchoolDeviceAnalytics
);

/**
 * @route POST /api/devices/cleanup
 * @desc Clean up stale devices (cron job)
 * @access Private (Admin, Super Admin only)
 * @note Internal endpoint for maintenance
 */
router.post(
  '/cleanup',
  authenticate,
  authorize(['admin', 'superAdmin']),
  DeviceController.cleanupStaleDevices
);

/**
 * @route POST /api/devices/check-limit/:classLoginId
 * @desc Check device limit before joining live class
 * @access Public (used by frontend before authentication)
 */
router.post(
  '/check-limit/:classLoginId',
  DeviceController.checkDeviceLimit
);

/**
 * @route GET /api/devices/health
 * @desc Device service health check
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Device Management',
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    features: {
      deviceValidation: true,
      realTimeChecking: true,
      analytics: true
    }
  });
});

module.exports = router;
