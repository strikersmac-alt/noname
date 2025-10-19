import cron from 'node-cron';
import Contest from '../models/contest.model.js';

/**
 * Cron job to check and update expired contests
 * Runs every minute to mark contests as not live when time expires
 */
export const initContestExpiryCron = () => {
    // Run every minute (at second 0)
    cron.schedule('0 * * * * *', async () => {
        try {
            const now = Date.now();
            
            // Find all live contests
            const liveContests = await Contest.find({ isLive: true });
            
            for (const contest of liveContests) {
                const startTime = parseInt(contest.startTime);
                const duration = contest.duration * 60 * 1000; // Convert minutes to milliseconds
                const endTime = startTime + duration;
                
                // Check if contest time has expired
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
