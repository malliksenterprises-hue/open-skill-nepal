const express = require('express');
const {
  login,
  googleLogin,
  getMe,
  logout
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/google-login', googleLogin);

// Protected routes (require authentication)
router.get('/me', authenticateToken, getMe);
router.post('/logout', authenticateToken, logout);

module.exports = router;
