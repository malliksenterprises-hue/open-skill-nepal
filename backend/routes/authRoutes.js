const express = require('express');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/authMiddleware');
const router = express.Router();

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const User = require('../models/User');

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if user can login (student verification)
    if (!user.canLogin()) {
      return res.status(403).json({ 
        message: 'Account pending approval from school admin',
        status: user.status,
        code: 'PENDING_APPROVAL'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Prepare user data for response
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      school: user.school,
      profile: user.profile,
      isActive: user.isActive,
      lastLogin: user.lastLogin
    };

    res.json({
      message: 'Login successful',
      token,
      user: userData,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ 
      message: 'Login failed',
      error: error.message,
      code: 'LOGIN_ERROR'
    });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user._id)
      .select('-password')
      .populate('school', 'name code');

    res.json({
      user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch profile',
      error: error.message 
    });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, address, bio } = req.body;
    const User = require('../models/User');

    const user = await User.findById(req.user._id);
    
    if (name) user.name = name;
    if (phone) user.profile.phone = phone;
    if (address) user.profile.address = address;
    if (bio) user.profile.bio = bio;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ 
      message: 'Failed to update profile',
      error: error.message 
    });
  }
});

// Change password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const User = require('../models/User');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'New password must be at least 6 characters long' 
      });
    }

    const user = await User.findById(req.user._id);
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ 
        message: 'Current password is incorrect' 
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password changed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ 
      message: 'Failed to change password',
      error: error.message 
    });
  }
});

// Verify token endpoint (for frontend token validation)
router.get('/verify', auth, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
      school: req.user.school
    },
    timestamp: new Date().toISOString()
  });
});

// Logout (client-side token removal)
router.post('/logout', auth, (req, res) => {
  res.json({
    message: 'Logout successful',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
