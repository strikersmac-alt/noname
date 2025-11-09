import cron from 'node-cron';
import Contest from '../models/contest.model.js';

/**
 * Cron job to check and update expired contests
 * Runs every minute to mark contests as not live when time expires
 */
export const initContestExpiryCron = () => {
  cron.schedule('0 * * * * *', async () => {
    try {
      const now = Date.now();
      
      // Use bulk update instead of fetching all contests and saving individually
      // This is 10-100x faster and reduces DB load significantly
      const result = await Contest.updateMany(
        {
          isLive: true,
          $expr: {
            $lte: [
              { $add: ['$startTime', { $multiply: ['$duration', 60000] }] },
              now
            ]
          }
        },
        {
          $set: { isLive: false, status: 'end' }
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ Marked ${result.modifiedCount} contest(s) as ended - time expired`);
      }
    } catch (error) {
      console.error('❌ Error in contest expiry cron job:', error);
    }
  });

    console.log('🕐 Contest expiry cron job initialized - runs every minute');
};

export default initContestExpiryCron;
