const cron = require('node-cron');
const Video = require('../models/Video');

// Run every minute to update video statuses
const updateVideoStatuses = async () => {
  try {
    const now = new Date();
    console.log(`Running video status update at: ${now.toISOString()}`);

    // Update scheduled videos to live when their time comes
    const liveResult = await Video.updateMany(
      {
        status: 'scheduled',
        scheduledFor: { $lte: now }
      },
      { 
        status: 'live',
        $set: { updatedAt: now }
      }
    );

    // Update live videos to completed after 2 hours (simulate class duration)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const completedResult = await Video.updateMany(
      {
        status: 'live',
        scheduledFor: { $lte: twoHoursAgo }
      },
      { 
        status: 'completed',
        $set: { updatedAt: now }
      }
    );

    if (liveResult.modifiedCount > 0 || completedResult.modifiedCount > 0) {
      console.log(`Video status update completed: ${liveResult.modifiedCount} set to live, ${completedResult.modifiedCount} set to completed`);
    }
  } catch (error) {
    console.error('Error updating video statuses:', error);
  }
};

// Schedule to run every minute
cron.schedule('* * * * *', updateVideoStatuses);

// Also run immediately on server start
updateVideoStatuses();

module.exports = updateVideoStatuses;
