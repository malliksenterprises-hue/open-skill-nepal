const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const auth = require('../middleware/auth');

// Device validation endpoint
router.post('/validate', auth.verifyToken, deviceController.validateDevice);

// Get user's active devices
router.get('/active', auth.verifyToken, deviceController.getActiveDevices);

// Logout from specific device
router.post('/:deviceId/logout', auth.verifyToken, deviceController.logoutDevice);

// Get device usage stats
router.get('/stats', auth.verifyToken, deviceController.getDeviceStats);

// Admin endpoints
router.get('/admin/school-devices', auth.verifyToken, auth.isAdmin, deviceController.getSchoolDevices);
router.post('/admin/update-limits', auth.verifyToken, auth.isAdmin, deviceController.updateDeviceLimits);
router.post('/admin/remove-device', auth.verifyToken, auth.isAdmin, deviceController.adminRemoveDevice);

module.exports = router;
