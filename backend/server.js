const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// =======================
// ROOT ROUTE - ADDED HERE
// =======================
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Open Skill Nepal Backend API',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      mongodb: '/api/debug/mongodb',
      dbStatus: '/api/debug/db-status',
      test: '/api/test',
      auth: '/api/auth'
    },
    documentation: 'https://github.com/malliksenterprises-hue/open-skill-nepal'
  });
});

// PRODUCTION CORS CONFIGURATION
app.use(cors({
  origin: [
    'https://openskillnepal.com',
    'https://www.openskillnepal.com',
    'https://api.openskillnepal.com',
    'https://open-skill-nepal.vercel.app',
    'https://open-skill-nepal-qsq3idytx-dinesh-malliks-projects.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  optionsSuccessStatus: 204
}));

// ADD THIS AT THE TOP after express() initialization
app.post('/api/direct-test-login', (req, res) => {
  console.log('✅ DIRECT TEST ROUTE HIT');
  res.json({
    message: 'DIRECT ROUTE WORKS - Auth routes file missing in deployment',
    timestamp: new Date().toISOString(),
    status: 'direct_test_success'
  });
});

// 🔥 CRITICAL FIX: Add body-parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Enhanced MongoDB connection with better logging
console.log('🔧 Initializing MongoDB connection...');
console.log('📝 MongoDB URI present:', process.env.MONGO_URI ? '✅ Yes' : '❌ No');

if (!process.env.MONGO_URI) {
  console.error('💥 CRITICAL: MONGO_URI environment variable is missing!');
} else {
  // Log safe connection info
  const safeURI = process.env.MONGO_URI.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://$1:********@');
  console.log('🔗 Connection URI:', safeURI);
}

// MongoDB connection options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  retryWrites: true,
  w: 'majority',
  ssl: true,
  sslValidate: true
};

// Connection event listeners
mongoose.connection.on('connecting', () => {
  console.log('🔄 MongoDB Connecting...');
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB Connected successfully');
  console.log('📊 Database name:', mongoose.connection.db?.databaseName || 'Unknown');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Connection Error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB Disconnected');
});

// User Schema (simplified)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Auto-create sample users when connection opens
mongoose.connection.once('open', async () => {
  console.log('🔓 MongoDB connection open - checking for sample data...');
  
  try {
    // Check if any users exist
    const userCount = await User.countDocuments();
    console.log(`👥 Found ${userCount} existing users in database`);
    
    if (userCount === 0) {
      console.log('📝 No users found, creating sample users...');
      await createSampleUsersManually();
    } else {
      console.log('✅ Database already has users, skipping initialization');
      
      // Log existing users for reference
      const users = await User.find({}, 'email role name');
      console.log('📋 Existing users:');
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.role}) - ${user.name}`);
      });
    }
  } catch (error) {
    console.log('💥 Error during sample data check:', error.message);
  }
});

// Manual user creation
async function createSampleUsersManually() {
  try {
    const sampleUsers = [
      {
        name: 'Super Admin',
        email: 'superadmin@example.com',
        password: await bcrypt.hash('password', 12),
        role: 'super_admin',
        isActive: true
      },
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: await bcrypt.hash('password', 12),
        role: 'admin',
        isActive: true
      },
      {
        name: 'Teacher User',
        email: 'teacher@example.com',
        password: await bcrypt.hash('password', 12),
        role: 'teacher',
        isActive: true
      },
      {
        name: 'School Admin',
        email: 'school@example.com',
        password: await bcrypt.hash('password', 12),
        role: 'school_admin',
        isActive: true
      },
      {
        name: 'Student User',
        email: 'student@example.com',
        password: await bcrypt.hash('password', 12),
        role: 'student',
        isActive: true
      }
    ];

    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`✅ Created user: ${user.email} (${user.role})`);
    }

    console.log('🎉 Manual user creation completed!');
    console.log('\n📧 Login credentials:');
    sampleUsers.forEach(user => {
      console.log(`   👤 ${user.email} / password (Role: ${user.role})`);
    });
    
  } catch (error) {
    console.error('❌ Manual user creation failed:', error.message);
  }
}

// Initialize database connection
async function connectDB() {
  try {
    console.log('🚀 Attempting MongoDB connection...');
    await mongoose.connect(process.env.MONGO_URI, mongooseOptions);
    console.log('🎉 MongoDB connection established successfully');
  } catch (error) {
    console.error('💥 MongoDB connection failed:', error.message);
  }
}

// Connect to database
connectDB();

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// ==========================================
// 🔥 AUTHENTICATION ROUTES - BUILT DIRECTLY
// ==========================================

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET || 'fallback-secret-key',
    { expiresIn: '7d' }
  );
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required',
        timestamp: new Date().toISOString()
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        message: 'User not found or inactive',
        timestamp: new Date().toISOString()
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ 
      message: 'Invalid or expired token',
      timestamp: new Date().toISOString()
    });
  }
};

// LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
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

    // Find user by email
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

    // Verify password
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
      avatar: user.avatar || '',
      school: user.school || ''
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
});

// GET CURRENT USER PROFILE
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ 
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }
    
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || '',
      school: user.school || ''
    };
    
    res.json(userResponse);
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ 
      message: 'Failed to get user profile',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// LOGOUT ROUTE
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({ 
    message: 'Logout successful - please remove token from client storage',
    timestamp: new Date().toISOString()
  });
});

// GOOGLE LOGIN (Simplified)
app.post('/api/auth/google-login', async (req, res) => {
  try {
    const { email, name, googleId } = req.body;

    if (!email) {
      return res.status(400).json({ 
        message: 'Google authentication data is required',
        timestamp: new Date().toISOString()
      });
    }

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create new user for students only via Google
      user = new User({
        name: name || 'Google User',
        email: email.toLowerCase(),
        password: await bcrypt.hash(googleId + Date.now(), 12), // Temporary password
        role: 'student',
        isActive: true
      });
      await user.save();
      console.log('✅ New Google user created:', email);
    }

    // Generate token
    const token = generateToken(user);

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || '',
      school: user.school || ''
    };

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
});

// ==========================================
// EXISTING ROUTES (Keep all your current routes)
// ==========================================

// Health check with DB status
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'disconnected',
    1: 'connected', 
    2: 'connecting',
    3: 'disconnecting'
  }[dbStatus] || 'unknown';
  
  res.json({ 
    status: dbStatus === 1 ? 'healthy' : 'unhealthy',
    database: dbStatusText,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime()
  });
});

// MongoDB Debug Endpoint
app.get('/api/debug/mongodb', async (req, res) => {
  try {
    console.log('🔍 Testing MongoDB connection directly...');
    
    const dbStatus = mongoose.connection.readyState;
    const dbStatusText = {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    }[dbStatus] || 'unknown';
    
    let debugInfo = {
      mongooseState: dbStatusText,
      mongooseReadyState: dbStatus,
      connectionHost: mongoose.connection.host,
      connectionName: mongoose.connection.name,
      mongoURIPresent: !!process.env.MONGO_URI,
      timestamp: new Date().toISOString()
    };
    
    // Only test database operations if connected
    if (dbStatus === 1) {
      try {
        const adminDb = mongoose.connection.db.admin();
        const pingResult = await adminDb.ping();
        debugInfo.ping = pingResult;
        
        // Test if we can access users collection
        const userCount = await User.countDocuments();
        debugInfo.userCount = userCount;
      } catch (dbError) {
        debugInfo.dbError = dbError.message;
      }
    }
    
    res.json({
      status: dbStatus === 1 ? 'success' : 'error',
      ...debugInfo
    });
    
  } catch (error) {
    console.error('❌ MongoDB Debug Error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      mongooseState: mongoose.connection.readyState,
      timestamp: new Date().toISOString()
    });
  }
});

// Database status endpoint
app.get('/api/debug/db-status', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    mongooseState: states[mongoose.connection.readyState],
    mongooseReadyState: mongoose.connection.readyState,
    mongooseHost: mongoose.connection.host,
    mongooseName: mongoose.connection.name,
    mongoURIPresent: !!process.env.MONGO_URI,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify server is responding
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is responding correctly!',
    timestamp: new Date().toISOString(),
    server: 'Open Skill Nepal Backend',
    status: 'active'
  });
});

// 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.originalUrl}`);
  res.status(404).json({ 
    message: 'API route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Error stack:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 Open Skill Nepal Backend Ready!`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔍 Authentication endpoints:`);
  console.log(`   - POST /api/auth/login - User login`);
  console.log(`   - GET  /api/auth/me - Get current user`);
  console.log(`   - POST /api/auth/logout - User logout`);
  console.log(`   - POST /api/auth/google-login - Google OAuth`);
  console.log(`\n📧 Test credentials available - Login should now work!`);
});
