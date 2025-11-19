const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware - FIXED CORS
app.use(cors({
  origin: [
    'https://open-skill-nepal-4zc9-git-main-dinesh-mc.vercel.app', // Your actual Vercel URL
    'https://open-skill-nepal-4zc9-aej0wknbi-dinesh-1.vercel.app', // Your other Vercel URL
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/open-skill-nepal', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.log('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));

// Basic route for health check
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Open Skill Nepal Backend is running!',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 Open Skill Nepal Backend Ready!`);
});
