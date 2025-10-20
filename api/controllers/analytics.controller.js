// import mongoose from 'mongoose';
// import { UserAnalytics, DailyUserAnalytics, ContestAnalytics, NptelPracticeAnalytics } from '../models/user.model.js';
// import User from '../models/user.model.js';
// import Contest from '../models/contest.model.js';

// function utcStartOfDay(ts) {
//   const d = new Date(Number(ts));
//   return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
// }
// function utcEndOfDay(ts) {
//   const d = new Date(Number(ts));
//   return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
// }


// const createUserContestAnalytics = async (req, res) => {
//   try {
//     const { userId, contestType, mode } = req.body;
//     if (!userId || !contestType || !mode) {
//       return res.status(400).json({ error: 'Missing required fields: userId, contestType, mode' });
//     }

//     let userAnalytics = await UserAnalytics.findOne({ user: userId });
//     if (!userAnalytics) {
//       userAnalytics = new UserAnalytics({ user: userId });
//     }

//     userAnalytics.contestTypes[contestType][mode] += 1;
//     await userAnalytics.save();

//     await User.findByIdAndUpdate(userId, { analytics: userAnalytics._id });

//     res.status(201).json({ message: 'User analytics updated' });
//   } catch (error) {
//     res.status(500).json({ error: `Server error: ${error.message}` });
//   }
// };

// const createUserNptelAnalytics = async (req, res) => {
//   try {
//     const { userId, startCnt, endCnt } = req.body;
//     if (!userId) {
//       return res.status(400).json({ error: 'Missing required fields: userId' });
//     }

//     let userAnalytics = await UserAnalytics.findOne({ user: userId });
//     if (!userAnalytics) {
//       userAnalytics = new UserAnalytics({ user: userId });
//     }

//     userAnalytics.nptelPracticeStarted += startCnt || 0;
//     userAnalytics.nptelPracticeCompleted += endCnt || 0;

//     await userAnalytics.save();

//     await User.findByIdAndUpdate(userId, { analytics: userAnalytics._id });

//     res.status(201).json({ message: 'User analytics updated' });
//   } catch (error) {
//     res.status(500).json({ error: `Server error: ${error.message}` });
//   }
// };

// const createDailyUserAnalytics = async (req, res) => {
//   try {
//     const { userId, timestamp, contestType, mode, startCnt, endCnt } = req.body;
//     if (!userId || !timestamp) {
//       return res.status(400).json({ error: 'Missing required fields: userId, timestamp' });
//     }

//     const date = new Date(Number(timestamp));
//     const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));


//     let dailyAnalytics = await DailyUserAnalytics.findOne({ user: userId, date: startOfDay });
//     if (!dailyAnalytics) {
//       dailyAnalytics = new DailyUserAnalytics({ user: userId, date: startOfDay });
//     }
//     if (contestType && mode) {
//       dailyAnalytics.contestsParticipated[contestType][mode] += 1;
//     }
//     if (startCnt) {
//       dailyAnalytics.nptelPracticeStarted += startCnt;
//     }
//     if (endCnt) {
//       dailyAnalytics.nptelPracticeCompleted += endCnt;
//     }

//     await dailyAnalytics.save();

//     await User.findByIdAndUpdate(userId, { $addToSet: { dailyAnalytics: dailyAnalytics._id } });

//     res.status(201).json({ message: 'Daily user analytics updated', dailyAnalytics });
//   } catch (error) {
//     res.status(500).json({ error: `Server error: ${error.message}` });
//   }
// };

// const createContestAnalytics = async (req, res) => {
//   try {
//     const { contestId, timestamp, topic } = req.body;
//     if (!contestId || !timestamp) {
//       return res.status(400).json({ error: 'Missing required fields: contestId, timestamp' });
//     }

//     const date = new Date(Number(timestamp));
//     const contest = await Contest.findById(contestId);
//     if (!contest) {
//       return res.status(404).json({ error: 'Contest not found' });
//     }

//     try {
//       const contestAnalytics = await ContestAnalytics.create({
//         contest: contestId,
//         date,
//         topic: topic || contest.topic,
//       });

//       return res.status(201).json({
//         message: 'Contest analytics created',
//         contestAnalytics,
//       });
//     } catch (error) {
//       if (error.code === 11000) {
//         return res.status(400).json({ error: 'Contest analytics already exists' });
//       }
//       throw error;
//     }
//   } catch (error) {
//     res.status(500).json({ error: `Server error: ${error.message}` });
//   }
// };

// const createNptelPracticeAnalytics = async (req, res) => {
//   try {
//     const { subject, timestamp } = req.body;
//     if (!subject || !timestamp) {
//       return res.status(400).json({ error: 'Missing required fields: subject, timestamp' });
//     }

//     const date = utcStartOfDay(timestamp);
//     const nptelAnalytics = await NptelPracticeAnalytics.findOneAndUpdate(
//       { subject, date },
//       {
//         $inc: { count: 1 },
//         $setOnInsert: { subject, date },
//       },
//       {
//         new: true,
//         upsert: true,
//         setDefaultsOnInsert: true,
//       }
//     ).exec();

//     return res.status(201).json({
//       message: 'NPTEL practice analytics updated'
//     });
//   } catch (err) {
//     if (err && err.code === 11000) {
//       return res.status(409).json({ error: 'Duplicate key error' });
//     }
//     return res.status(500).json({ error: `Server error: ${err.message}` });
//   }
// };

// const getDailyActiveUsers = async (req, res) => {
//   try {
//     const { timestamp } = req.params;
//     if (!timestamp || isNaN(timestamp)) {
//       return res.status(400).json({ error: 'Invalid Unix timestamp' });
//     }

//     const d = new Date(Number(timestamp));
//     const startOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
//     const endOfDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

//     const activeUsers = await DailyUserAnalytics.distinct('user', {
//       date: { $gte: startOfDay, $lte: endOfDay },
//       $or: [
//         { 'contestsParticipated.normal.duel': { $gt: 0 } },
//         { 'contestsParticipated.normal.practice': { $gt: 0 } },
//         { 'contestsParticipated.normal.multiplayer': { $gt: 0 } },
//         { 'contestsParticipated.nptel.duel': { $gt: 0 } },
//         { 'contestsParticipated.nptel.practice': { $gt: 0 } },
//         { 'contestsParticipated.nptel.multiplayer': { $gt: 0 } },
//         { nptelPracticeStarted: { $gt: 0 } },
//         { nptelPracticeCompleted: { $gt: 0 } },
//       ],
//     });

//     res.status(200).json({
//       date: startOfDay,
//       totalActiveUsers: activeUsers.length,
//     });
//   } catch (error) {
//     res.status(500).json({ error: `Server error: ${error.message}` });
//   }
// };

// const getUserAnalytics = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ error: 'Invalid user ID' });
//     }

//     const userAnalytics = await UserAnalytics.findOne({ user: userId }).populate('user', 'name email');
//     if (!userAnalytics) {
//       return res.status(404).json({ error: 'User analytics not found' });
//     }

//     res.status(200).json(userAnalytics);
//   } catch (error) {
//     res.status(500).json({ error: `Server error: ${error.message}` });
//   }
// };

// const getContestAnalytics = async (req, res) => {
//   try {
//     const { startTimestamp, endTimestamp, limit = 5 } = req.query;

//     const matchStage = {};
//     if (startTimestamp && endTimestamp) {
//       matchStage.date = {
//         $gte: new Date(Number(startTimestamp)),
//         $lte: new Date(Number(endTimestamp))
//       };
//     }

//     const analytics = await ContestAnalytics.aggregate([
//       { $match: matchStage },
//       {
//         $lookup: {
//           from: "contests",
//           localField: "contest",
//           foreignField: "_id",
//           as: "contestInfo"
//         }
//       },
//       { $unwind: "$contestInfo" },
//       {
//         $group: {
//           _id: {
//             topic: "$contestInfo.topic",
//             contestType: "$contestInfo.contestType",
//             mode: "$contestInfo.mode"
//           },
//           totalContests: { $sum: 1 }
//         }
//       },
//       {
//         $group: {
//           _id: "$_id.topic",
//           contestBreakdown: {
//             $push: {
//               contestType: "$_id.contestType",
//               mode: "$_id.mode",
//               totalContests: "$totalContests"
//             }
//           },
//           totalContests: { $sum: "$totalContests" }
//         }
//       },
//       { $sort: { totalContests: -1 } },
//       { $limit: Number(limit) },
//       {
//         $project: {
//           _id: 0,
//           topic: "$_id",
//           totalContests: 1,
//           contestBreakdown: 1
//         }
//       }
//     ]);

//     if (!analytics.length) {
//       return res.status(404).json({ message: "No contest analytics found for the given range" });
//     }

//     res.status(200).json({
//       insights: analytics,
//       summary: {
//         topTopic: analytics[0].topic,
//         totalTopics: analytics.length
//       }
//     });
//   } catch (error) {
//     res.status(500).json({ error: `Server error: ${error.message}` });
//   }
// };

// const getNptelPracticeAnalytics = async (req, res) => {
//   try {
//     const { startTimestamp, endTimestamp, groupBy = "subject", limit = 5 } = req.query;

//     const matchStage = {};
//     if (startTimestamp && endTimestamp) {
//       matchStage.date = {
//         $gte: new Date(Number(startTimestamp)),
//         $lte: new Date(Number(endTimestamp))
//       };
//     }

//     const groupStage =
//       groupBy === "date"
//         ? {
//             _id: {
//               date: {
//                 $dateToString: { format: "%Y-%m-%d", date: "$date" }
//               }
//             },
//             totalPractices: { $sum: "$count" }
//           }
//         : {
//             _id: "$subject",
//             totalPractices: { $sum: "$count" }
//           };

//     const analytics = await NptelPracticeAnalytics.aggregate([
//       { $match: matchStage },
//       { $group: groupStage },
//       { $sort: { totalPractices: -1 } },
//       { $limit: Number(limit) },
//       {
//         $project: {
//           _id: 0,
//           [groupBy]: "$_id",
//           totalPractices: 1
//         }
//       }
//     ]);

//     if (!analytics.length) {
//       return res.status(404).json({ message: "No NPTEL analytics found" });
//     }

//     res.status(200).json({
//       insights: analytics,
//       summary:
//         groupBy === "subject"
//           ? { topSubject: analytics[0].subject, totalSubjects: analytics.length }
//           : { totalDays: analytics.length }
//     });
//   } catch (error) {
//     res.status(500).json({ error: `Server error: ${error.message}` });
//   }
// };


// export {
//   createUserContestAnalytics,
//   createUserNptelAnalytics,
//   createDailyUserAnalytics,
//   createContestAnalytics,
//   createNptelPracticeAnalytics,
//   getDailyActiveUsers,
//   getUserAnalytics,
//   getContestAnalytics,
//   getNptelPracticeAnalytics,
// };

import mongoose from 'mongoose';
import User from '../models/user.model.js';
import Contest from '../models/contest.model.js';
import {
  UserAnalytics,
  DailyUserAnalytics,
  ContestAnalytics,
  NptelPracticeAnalytics
} from '../models/user.model.js';

// utils 
function utcStartOfDay(ts) {
  const d = new Date(Number(ts));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function utcEndOfDay(ts) {
  const d = new Date(Number(ts));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

// CREATE
const createUserContestAnalytics = async (req, res) => {
  try {
    const { userId, contestType, mode } = req.body;
    if (!userId || !contestType || !mode) {
      return res.status(400).json({ success: false, error: 'Missing required fields: userId, contestType, mode' });
    }

    let userAnalytics = await UserAnalytics.findOne({ user: userId });
    if (!userAnalytics) userAnalytics = new UserAnalytics({ user: userId });

    userAnalytics.contestTypes[contestType][mode] += 1;
    await userAnalytics.save();
    await User.findByIdAndUpdate(userId, { analytics: userAnalytics._id });

    res.status(201).json({ success: true, message: 'User contest analytics updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: `Server error: ${error.message}` });
  }
};

const createUserNptelAnalytics = async (req, res) => {
  try {
    const { userId, startCnt = 0, endCnt = 0 } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'Missing required field: userId' });

    let userAnalytics = await UserAnalytics.findOne({ user: userId });
    if (!userAnalytics) userAnalytics = new UserAnalytics({ user: userId });

    userAnalytics.nptelPracticeStarted += startCnt;
    userAnalytics.nptelPracticeCompleted += endCnt;
    await userAnalytics.save();
    await User.findByIdAndUpdate(userId, { analytics: userAnalytics._id });

    res.status(201).json({ success: true, message: 'User NPTEL analytics updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: `Server error: ${error.message}` });
  }
};

const createDailyUserAnalytics = async (req, res) => {
  try {
    const { userId, timestamp, contestType, mode, startCnt = 0, endCnt = 0 } = req.body;
    if (!userId || !timestamp)
      return res.status(400).json({ success: false, error: 'Missing required fields: userId, timestamp' });

    const date = utcStartOfDay(timestamp);
    let dailyAnalytics = await DailyUserAnalytics.findOne({ user: userId, date });
    if (!dailyAnalytics) dailyAnalytics = new DailyUserAnalytics({ user: userId, date });

    if (contestType && mode) {
      dailyAnalytics.contestsParticipated ??= {};
      dailyAnalytics.contestsParticipated[contestType] ??= { duel: 0, practice: 0, multiplayer: 0 };
      dailyAnalytics.contestsParticipated[contestType][mode] += 1;
    }
    dailyAnalytics.nptelPracticeStarted += startCnt;
    dailyAnalytics.nptelPracticeCompleted += endCnt;

    await dailyAnalytics.save();
    await User.findByIdAndUpdate(userId, { $addToSet: { dailyAnalytics: dailyAnalytics._id } });

    res.status(201).json({ success: true, message: 'Daily analytics updated', data: dailyAnalytics });
  } catch (error) {
    res.status(500).json({ success: false, error: `Server error: ${error.message}` });
  }
};

const createContestAnalytics = async (req, res) => {
  try {
    const { contestId, timestamp, topic } = req.body;
    if (!contestId || !timestamp)
      return res.status(400).json({ success: false, error: 'Missing required fields: contestId, timestamp' });

    const date = utcStartOfDay(timestamp);
    const contest = await Contest.findById(contestId);
    if (!contest) return res.status(404).json({ success: false, error: 'Contest not found' });

    try {
      const contestAnalytics = await ContestAnalytics.create({
        contest: contestId,
        date,
        topic: topic || contest.topic
      });
      res.status(201).json({ success: true, message: 'Contest analytics created', data: contestAnalytics });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, error: 'Contest analytics already exists' });
      throw err;
    }
  } catch (error) {
    res.status(500).json({ success: false, error: `Server error: ${error.message}` });
  }
};

const createNptelPracticeAnalytics = async (req, res) => {
  try {
    const { subject, timestamp } = req.body;
    if (!subject || !timestamp)
      return res.status(400).json({ success: false, error: 'Missing required fields: subject, timestamp' });

    const date = utcStartOfDay(timestamp);
    await NptelPracticeAnalytics.findOneAndUpdate(
      { subject, date },
      { $inc: { count: 1 }, $setOnInsert: { subject, date } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, message: 'NPTEL practice analytics updated' });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, error: 'Duplicate key error' });
    res.status(500).json({ success: false, error: `Server error: ${err.message}` });
  }
};


// GET
const getDailyActiveUsers = async (req, res) => {
  try {
    const { timestamp } = req.params;
    if (!timestamp || isNaN(timestamp))
      return res.status(400).json({ success: false, error: 'Invalid Unix timestamp' });

    const startOfDay = utcStartOfDay(timestamp);
    const endOfDay = utcEndOfDay(timestamp);

    const activeUsers = await DailyUserAnalytics.distinct('user', {
      date: { $gte: startOfDay, $lte: endOfDay },
      $or: [
        { 'contestsParticipated.normal.duel': { $gt: 0 } },
        { 'contestsParticipated.normal.practice': { $gt: 0 } },
        { 'contestsParticipated.normal.multiplayer': { $gt: 0 } },
        { 'contestsParticipated.nptel.duel': { $gt: 0 } },
        { 'contestsParticipated.nptel.practice': { $gt: 0 } },
        { 'contestsParticipated.nptel.multiplayer': { $gt: 0 } },
        { nptelPracticeStarted: { $gt: 0 } },
        { nptelPracticeCompleted: { $gt: 0 } }
      ]
    });

    res.status(200).json({ success: true, date: startOfDay, totalActiveUsers: activeUsers.length });
  } catch (error) {
    res.status(500).json({ success: false, error: `Server error: ${error.message}` });
  }
};

const getUserAnalytics = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ success: false, error: 'Invalid user ID' });

    const userAnalytics = await UserAnalytics.findOne({ user: userId }).populate('user', 'name email');
    if (!userAnalytics)
      return res.status(404).json({ success: false, error: 'User analytics not found' });

    res.status(200).json({ success: true, data: userAnalytics });
  } catch (error) {
    res.status(500).json({ success: false, error: `Server error: ${error.message}` });
  }
};

const getContestAnalytics = async (req, res) => {
  try {
    const { startTimestamp, endTimestamp, limit = 5 } = req.query;

    const matchStage = {};
    if (startTimestamp && endTimestamp) {
      matchStage.date = { $gte: new Date(Number(startTimestamp)), $lte: new Date(Number(endTimestamp)) };
    }

    const analytics = await ContestAnalytics.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'contests',
          localField: 'contest',
          foreignField: '_id',
          as: 'contestInfo'
        }
      },
      { $unwind: '$contestInfo' },
      {
        $group: {
          _id: { topic: '$contestInfo.topic', contestType: '$contestInfo.contestType', mode: '$contestInfo.mode' },
          totalContests: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.topic',
          contestBreakdown: { $push: { contestType: '$_id.contestType', mode: '$_id.mode', totalContests: '$totalContests' } },
          totalContests: { $sum: '$totalContests' }
        }
      },
      { $sort: { totalContests: -1 } },
      { $limit: Number(limit) },
      { $project: { _id: 0, topic: '$_id', totalContests: 1, contestBreakdown: 1 } }
    ]);

    if (!analytics.length)
      return res.status(404).json({ success: false, message: 'No contest analytics found for the given range' });

    res.status(200).json({ success: true, insights: analytics, summary: { topTopic: analytics[0].topic, totalTopics: analytics.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: `Server error: ${error.message}` });
  }
};

const getNptelPracticeAnalytics = async (req, res) => {
  try {
    const { startTimestamp, endTimestamp, groupBy = 'subject', limit = 5 } = req.query;

    const matchStage = {};
    if (startTimestamp && endTimestamp) {
      matchStage.date = { $gte: new Date(Number(startTimestamp)), $lte: new Date(Number(endTimestamp)) };
    }

    const groupStage =
      groupBy === 'date'
        ? { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } }, totalPractices: { $sum: '$count' } }
        : { _id: '$subject', totalPractices: { $sum: '$count' } };

    const analytics = await NptelPracticeAnalytics.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: { totalPractices: -1 } },
      { $limit: Number(limit) },
      { $project: { _id: 0, [groupBy]: '$_id', totalPractices: 1 } }
    ]);

    if (!analytics.length)
      return res.status(404).json({ success: false, message: 'No NPTEL analytics found' });

    res.status(200).json({
      success: true,
      insights: analytics,
      summary: groupBy === 'subject'
        ? { topSubject: analytics[0].subject, totalSubjects: analytics.length }
        : { totalDays: analytics.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: `Server error: ${error.message}` });
  }
};

export {
  createContestAnalytics,
  createDailyUserAnalytics,
  createNptelPracticeAnalytics,
  createUserContestAnalytics,
  createUserNptelAnalytics,
  getContestAnalytics,
  getDailyActiveUsers,
  getNptelPracticeAnalytics,
  getUserAnalytics
};
