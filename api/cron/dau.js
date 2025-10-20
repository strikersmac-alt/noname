import cron from "node-cron";
import {DailyUserAnalytics} from "../models/user.model.js";
import {DailyActiveUsers} from "../models/user.model.js";
// import { utcStartOfDay, utcEndOfDay } from "../utils/timeUtils.js";

function utcStartOfDay(ts) {
  const d = new Date(Number(ts));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function utcEndOfDay(ts) {
  const d = new Date(Number(ts));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

const saveDailyActiveUsers = async () => {
  try {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(now.getUTCDate() - 1);

    const startOfDay = utcStartOfDay(yesterday);
    const endOfDay = utcEndOfDay(yesterday);

    const existing = await DailyActiveUsers.findOne({ date: startOfDay });
    if (existing) {
      console.log(
        `Daily active users for ${startOfDay.toISOString().split("T")[0]} already exist. Skipping.`
      );
      return;
    }

    const activeUsers = await DailyUserAnalytics.distinct("user", {
      date: { $gte: startOfDay, $lte: endOfDay },
      $or: [
        { "contestsParticipated.normal.duel": { $gt: 0 } },
        { "contestsParticipated.normal.practice": { $gt: 0 } },
        { "contestsParticipated.normal.multiplayer": { $gt: 0 } },
        { "contestsParticipated.nptel.duel": { $gt: 0 } },
        { "contestsParticipated.nptel.practice": { $gt: 0 } },
        { "contestsParticipated.nptel.multiplayer": { $gt: 0 } },
        { nptelPracticeStarted: { $gt: 0 } },
        { nptelPracticeCompleted: { $gt: 0 } },
      ],
    });

    await DailyActiveUsers.create({
      date: startOfDay,
      totalActiveUsers: activeUsers.length,
      users: activeUsers,
    });

    console.log(
      `Saved daily active users for ${startOfDay.toISOString().split("T")[0]}: ${activeUsers.length}`
    );
  } catch (err) {
    console.error("Error saving daily active users:", err.message);
  }
};

const dailyActiveUserJob = cron.schedule("5 0 * * *", saveDailyActiveUsers, {
  scheduled: true,
  timezone: "UTC",
});

export default dailyActiveUserJob;
