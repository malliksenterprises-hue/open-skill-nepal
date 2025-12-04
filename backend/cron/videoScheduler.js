const cron = require('node-cron');
const Video = require('../models/Video');

console.log('⏰ Video Scheduler started');

// Run every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    console.log(`🔄 Checking video schedules at ${now.toISOString()}`);

    // 1. Update scheduled videos to LIVE if time has come
    const scheduledToLive = await Video.updateMany(
      {
        status: 'scheduled',
        scheduledFor: { $lte: now }
      },
      {
        status: 'live',
        $set: { updatedAt: now }
      }
    );

    if (scheduledToLive.modifiedCount > 0) {
      console.log(`🎬 ${scheduledToLive.modifiedCount} videos marked as LIVE`);
    }

    // 2. Update LIVE videos to RECORDED after 2 hours
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const liveToRecorded = await Video.updateMany(
      {
        status: 'live',
        scheduledFor: { $lte: twoHoursAgo }
      },
      {
        status: 'recorded',
        $set: { updatedAt: now }
      }
    );

    if (liveToRecorded.modifiedCount > 0) {
      console.log(`📼 ${liveToRecorded.modifiedCount} videos moved to RECORDED`);
    }

    // 3. Cleanup: Any LIVE videos older than 4 hours (shouldn't happen)
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const staleLive = await Video.updateMany(
      {
        status: 'live',
        scheduledFor: { $lte: fourHoursAgo }
      },
      {
        status: 'recorded',
        $set: { updatedAt: now }
      }
    );

    if (staleLive.modifiedCount > 0) {
      console.log(`🧹 ${staleLive.modifiedCount} stale LIVE videos cleaned up`);
    }

    // 4. Update statistics (optional, for monitoring)
    const stats = {
      scheduled: await Video.countDocuments({ status: 'scheduled' }),
      live: await Video.countDocuments({ status: 'live' }),
      recorded: await Video.countDocuments({ status: 'recorded' }),
      total: await Video.countDocuments({})
    };

    console.log('📊 Video Stats:', stats);

  } catch (error) {
    console.error('❌ Video scheduler error:', error);
  }
});

// Export for server.js
module.exports = cron;
