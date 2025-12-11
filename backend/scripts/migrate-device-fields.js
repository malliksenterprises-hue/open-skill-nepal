const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const migrateDeviceFields = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Get Device model
    const Device = require('../models/Device');
    const School = require('../models/School');

    // Add new fields to all devices
    console.log('Adding new fields to Device collection...');
    const deviceUpdateResult = await Device.updateMany(
      {},
      {
        $set: {
          sessionCount: { $ifNull: ['$sessionCount', 0] },
          lastSessionType: { $ifNull: ['$lastSessionType', null] },
          lastSessionAt: { $ifNull: ['$lastSessionAt', null] },
          removedReason: { $ifNull: ['$removedReason', null] },
          removedAt: { $ifNull: ['$removedAt', null] }
        }
      }
    );

    console.log(`Updated ${deviceUpdateResult.modifiedCount} devices`);

    // Add deviceLimits to all schools
    console.log('Adding deviceLimits to School collection...');
    const schoolUpdateResult = await School.updateMany(
      {},
      {
        $set: {
          deviceLimits: {
            admin: 3,
            teacher: 5,
            student: 2,
            parent: 2
          },
          'deviceManagement.allowMultipleSessions': false,
          'deviceManagement.sessionTimeout': 30,
          'deviceManagement.notifyOnLimit': true,
          'deviceManagement.autoCleanupDays': 30
        }
      }
    );

    console.log(`Updated ${schoolUpdateResult.modifiedCount} schools`);

    // Create indexes
    console.log('Creating indexes...');
    await Device.collection.createIndex({ userId: 1, schoolId: 1, isActive: 1 });
    await Device.collection.createIndex({ schoolId: 1, lastSessionAt: -1 });
    await Device.collection.createIndex({ deviceFingerprint: 1, isActive: 1 });

    console.log('✅ Migration completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateDeviceFields();
