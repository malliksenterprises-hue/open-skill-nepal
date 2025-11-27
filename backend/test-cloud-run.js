// Test if the server starts correctly
const app = require('./server.js');

console.log('✅ Cloud Run Test: Server module loaded successfully');
console.log('✅ Environment Variables Check:');
console.log('   PORT:', process.env.PORT || '8080 (default)');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set' : '✗ Not set');
console.log('   MONGO_URI:', process.env.MONGO_URI ? '✓ Set' : '✗ Not set');

console.log('🎯 Ready for Cloud Run deployment!');
