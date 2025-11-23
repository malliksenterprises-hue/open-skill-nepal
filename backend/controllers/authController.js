const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../models/User');

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {String} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' } // Token expires in 7 days
  );
};

/**
 * Login with email and password
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required',
        timestamp: new Date().toISOString()
      });
    }

    // Find user by email using standard Mongoose method
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ 
        message: 'Invalid email or password',
        timestamp: new Date().toISOString()
      });
    }

    console.log('✅ User found:', user.email, 'Role:', user.role);

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Account is deactivated',
        timestamp: new Date().toISOString()
      });
    }

    // Verify password using bcrypt directly
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ 
        message: 'Invalid email or password',
        timestamp: new Date().toISOString()
      });
    }

    console.log('✅ Password valid for:', email);

    // Generate token
    const token = generateToken(user);

    // Return user data (excluding password) and token
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      school: user.school
    };

    console.log('✅ Login successful for:', email);

    res.json({
      message: 'Login successful',
      token,
      user: userResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      message: 'Authentication failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Google OAuth login/signup
 */
exports.googleLogin = async (req, res) => {
  try {
    const { name, email, googleId, avatar } = req.body;

    console.log('🔐 Google login attempt for:', email);

    if (!email || !googleId) {
      return res.status(400).json({ 
        message: 'Google authentication data is required',
        timestamp: new Date().toISOString()
      });
    }

    // Find existing user by email or googleId
    let user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { googleId: googleId }
      ]
    });

    if (user) {
      // Update user data if needed
      if (!user.googleId) user.googleId = googleId;
      if (!user.avatar && avatar) user.avatar = avatar;
      await user.save();
      console.log('✅ Existing Google user updated:', email);
    } else {
      // Create new user for students only via Google
      user = new User({
        name,
        email: email.toLowerCase(),
        googleId,
        avatar: avatar || '',
        role: ROLES.STUDENT, // Only students can sign up via Google
        password: undefined // No password for Google users
      });
      await user.save();
      console.log('✅ New Google user created:', email);
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Account is deactivated',
        timestamp: new Date().toISOString()
      });
    }

    // Generate token
    const token = generateToken(user);

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      school: user.school
    };

    console.log('✅ Google login successful for:', email);

    res.json({
      message: 'Google authentication successful',
      token,
      user: userResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Google login error:', error);
    res.status(500).json({ 
      message: 'Google authentication failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get current user profile
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }
    res.json(user);
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ 
      message: 'Failed to get user profile',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Logout (client-side token removal)
 */
exports.logout = (req, res) => {
  res.json({ 
    message: 'Logout successful - please remove token from client storage',
    timestamp: new Date().toISOString()
  });
};
