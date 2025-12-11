const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cron = require('node-cron');

dotenv.config();

const cleanupInactiveDevices = async (schoolId = null) => {
  try {
    console.log('🧹 Starting cleanup of inactive devices...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    // Get Device and School models
    const Device = require('../models/Device');
    const School = require('../models/School');

    // Get all schools or specific school
    const query = schoolId ? { _id: schoolId } : {};
    const schools = await School.find(query);
    
    console.log(`📊 Processing ${schools.length} school(s)`);

    let totalCleaned = 0;

    for (const school of schools) {
      try {
        const autoCleanupDays = school.deviceManagement?.autoCleanupDays || 30;
        const cutoffDate = new Date(Date.now() - autoCleanupDays * 24 * 60 * 60 * 1000);
        
        console.log(`\n🏫 School: ${school.name}`);
        console.log(`   Auto cleanup days: ${autoCleanupDays}`);
        console.log(`   Cutoff date: ${cutoffDate.toISOString()}`);

        // Find and mark inactive devices
        const result = await Device.updateMany(
          {
            schoolId: school._id,
            lastSessionAt: { $lt: cutoffDate },
            isActive: true,
            removedAt: null
          },
          {
            $set: {
              isActive: false,
              removedReason: 'inactive',
              removedAt: new Date(),
              updatedAt: new Date()
            }
          }
        );

        console.log(`   Cleaned up ${result.modifiedCount} inactive devices`);
        totalCleaned += result.modifiedCount;

        // Update school stats
        const activeDevicesCount = await Device.countDocuments({
          schoolId: school._id,
          isActive: true,
          removedAt: null
        });

        school.stats.activeDevices = activeDevicesCount;
        await school.save();

        console.log(`   Active devices: ${activeDevicesCount}`);

      } catch (schoolError) {
        console.error(`❌ Error processing school ${school.name}:`, schoolError.message);
      }
    }

    console.log(`\n🎉 Cleanup completed!`);
    console.log(`✅ Total cleaned up: ${totalCleaned} devices`);
    
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');

    return totalCleaned;
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
};

// If called directly, run once
if (require.main === module) {
  const schoolId = process.argv[2] || null;
  cleanupInactiveDevices(schoolId)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

// Schedule daily cleanup at 2 AM
const scheduleCleanup = () => {
  // Run at 2 AM every day
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ Running scheduled device cleanup...');
    try {
      await cleanupInactiveDevices();
      console.log('✅ Scheduled cleanup completed');
    } catch (error) {
      console.error('❌ Scheduled cleanup failed:', error);
    }
  });

  console.log('⏰ Scheduled device cleanup: Daily at 2 AM');
};

module.exports = { cleanupInactiveDevices, scheduleCleanup };
