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
      
      const liveContests = await Contest.find({ isLive: true });
      
      for (const contest of liveContests) {
        const startTime = contest.startTime || 0;  // UPDATED: Direct number, no parseInt
        const duration = contest.duration * 60 * 1000;
        const endTime = startTime + duration;
        
        if (now >= endTime) {
          contest.isLive = false;
          contest.status = "end";
          await contest.save();
          console.log(`✅ Contest ${contest.code} (${contest._id}) marked as not live - time expired`);
        }
      }
    } catch (error) {
      console.error('❌ Error in contest expiry cron job:', error);
    }
  });

    console.log('🕐 Contest expiry cron job initialized - runs every minute');
};

export default initContestExpiryCron;
