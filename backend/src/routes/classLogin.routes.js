const express = require('express');
const router = express.Router();
const ClassLoginController = require('../controllers/classLoginController');
const { authenticate, authorize } = require('../middleware/auth.middleware');

/**
 * @route POST /api/class-login/auth
 * @desc Authenticate Class Login (for classroom devices)
 * @access Public
 * @note Used by schools for classroom/smart board access
 */
router.post('/auth', ClassLoginController.authenticate);

/**
 * @route POST /api/class-login
 * @desc Create new Class Login
 * @access Private (School Admin, Admin, Super Admin)
 */
router.post(
  '/',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  ClassLoginController.createClassLogin
);

/**
 * @route GET /api/class-login/school/:schoolId
 * @desc Get Class Logins for a school
 * @access Private (School Admin, Admin, Super Admin)
 */
router.get(
  '/school/:schoolId',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  ClassLoginController.getBySchool
);

/**
 * @route GET /api/class-login/:id
 * @desc Get Class Login by ID
 * @access Private (School Admin, Admin, Super Admin)
 */
router.get(
  '/:id',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  async (req, res) => {
    try {
      // Implementation would go here
      res.json({ success: true, data: {} });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

/**
 * @route PUT /api/class-login/:id
 * @desc Update Class Login (maxDevices, password, etc.)
 * @access Private (School Admin, Admin, Super Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  ClassLoginController.update
);

/**
 * @route DELETE /api/class-login/:id
 * @desc Deactivate Class Login (soft delete)
 * @access Private (School Admin, Admin, Super Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  ClassLoginController.delete
);

/**
 * @route GET /api/class-login/:id/devices
 * @desc Get active devices for a Class Login
 * @access Private (School Admin, Admin, Super Admin)
 */
router.get(
  '/:id/devices',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  ClassLoginController.getActiveDevices
);

/**
 * @route POST /api/class-login/:id/reset-devices
 * @desc Reset all devices for a Class Login
 * @access Private (School Admin, Admin, Super Admin)
 * @note Useful when device limit is reached or suspicious activity
 */
router.post(
  '/:id/reset-devices',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  ClassLoginController.resetDevices
);

/**
 * @route DELETE /api/class-login/:id/devices/:deviceId
 * @desc Revoke a specific device from Class Login
 * @access Private (School Admin, Admin, Super Admin)
 */
router.delete(
  '/:id/devices/:deviceId',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  ClassLoginController.revokeDevice
);

/**
 * @route GET /api/class-login/:id/usage
 * @desc Get usage statistics for Class Login
 * @access Private (School Admin, Admin, Super Admin)
 */
router.get(
  '/:id/usage',
  authenticate,
  authorize(['schoolAdmin', 'admin', 'superAdmin']),
  async (req, res) => {
    try {
      // Implementation would go here
      res.json({ success: true, data: {} });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

/**
 * @route POST /api/class-login/:id/check-device-limit
 * @desc Check if device limit is reached before joining live class
 * @access Private (Class Login only)
 */
router.post(
  '/:id/check-device-limit',
  authenticate,
  authorize(['classLogin']),
  async (req, res) => {
    try {
      // Implementation would go here
      res.json({ success: true, data: {} });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

module.exports = router;
