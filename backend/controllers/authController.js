const jwt = require('jsonwebtoken');
const User = require('../models/User');
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

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required' 
      });
    }

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid email or password' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Account is deactivated' 
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid email or password' 
      });
    }

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

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      message: 'Internal server error' 
    });
  }
};

/**
 * Google OAuth login/signup
 */
exports.googleLogin = async (req, res) => {
  try {
    const { name, email, googleId, avatar } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({ 
        message: 'Google authentication data is required' 
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
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Account is deactivated' 
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

    res.json({
      message: 'Google authentication successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ 
      message: 'Internal server error' 
    });
  }
};

/**
 * Get current user profile
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      message: 'Internal server error' 
    });
  }
};

/**
 * Logout (client-side token removal)
 */
exports.logout = (req, res) => {
  res.json({ 
    message: 'Logout successful - please remove token from client storage' 
  });
};
