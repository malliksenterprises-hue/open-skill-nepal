const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const migrateSchoolDeviceLimits = async () => {
  try {
    console.log('🔧 Starting school device limits migration...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB');

    // Get School model
    const School = require('../models/School');

    // Get all schools
    const schools = await School.find({});
    console.log(`📊 Found ${schools.length} schools`);

    let updatedCount = 0;

    // Update each school with device limits
    for (const school of schools) {
      try {
        // Check if deviceLimits already exists
        if (!school.deviceLimits) {
          school.deviceLimits = {
            admin: 3,
            teacher: 5,
            student: 2,
            parent: 2
          };
        }

        // Check if deviceManagement exists
        if (!school.deviceManagement) {
          school.deviceManagement = {
            allowMultipleSessions: false,
            sessionTimeout: 30,
            notifyOnLimit: true,
            autoCleanupDays: 30
          };
        }

        // Check if stats exists
        if (!school.stats) {
          school.stats = {
            totalTeachers: 0,
            totalStudents: 0,
            totalClasses: 0,
            activeDevices: 0,
            maxConcurrentSessions: 0
          };
        }

        await school.save();
        updatedCount++;
        
        console.log(`✅ Updated school: ${school.name} (${school.code})`);
      } catch (schoolError) {
        console.error(`❌ Error updating school ${school.name}:`, schoolError.message);
      }
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Updated ${updatedCount} out of ${schools.length} schools`);
    
    // Create indexes if needed
    console.log(`\n🔧 Creating indexes...`);
    await School.collection.createIndex({ 'deviceLimits.admin': 1 });
    await School.collection.createIndex({ 'deviceLimits.teacher': 1 });
    await School.collection.createIndex({ 'deviceLimits.student': 1 });
    console.log(`✅ Indexes created`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrateSchoolDeviceLimits();
