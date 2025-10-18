import User from '../models/user.model.js';
import Contest from '../models/contest.model.js';

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // From auth middleware

    // Fetch user with populated contests
    const user = await User.findById(userId)
      .select('name email profilePicture contests createdAt')
      .populate({
        path: 'contests',
        select: 'code mode isLive duration startTime createdAt standing questions',
        options: { sort: { createdAt: -1 } } // Most recent first
      });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Calculate insights from contest history
    const insights = calculateUserInsights(user, userId);

    // Format contest history
    const contestHistory = user.contests.map(contest => {
      // Calculate user's score in this contest
      const userResults = contest.standing.filter(
        s => s.user.toString() === userId
      );
      const userScore = userResults.reduce((sum, r) => sum + r.result, 0);
      const totalQuestions = contest.questions.length;

      // Calculate rank
      const scores = {};
      contest.standing.forEach(s => {
        const uid = s.user.toString();
        if (!scores[uid]) scores[uid] = 0;
        scores[uid] += s.result;
      });
      const sortedScores = Object.entries(scores)
        .map(([uid, score]) => ({ uid, score }))
        .sort((a, b) => b.score - a.score);
      const rank = sortedScores.findIndex(s => s.uid === userId) + 1;

      return {
        contestId: contest._id,
        code: contest.code,
        mode: contest.mode,
        isLive: contest.isLive,
        duration: contest.duration,
        startTime: contest.startTime,
        createdAt: contest.createdAt,
        userScore,
        totalQuestions,
        rank,
        totalParticipants: Object.keys(scores).length
      };
    });

    return res.status(200).json({
      success: true,
      profile: {
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        memberSince: user.createdAt
      },
      contestHistory,
      insights
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Helper function to calculate user insights
function calculateUserInsights(user, userId) {
  const contests = user.contests;
  
  if (contests.length === 0) {
    return {
      totalContests: 0,
      totalQuestionsAttempted: 0,
      totalCorrectAnswers: 0,
      averageScore: 0,
      accuracyRate: 0,
      bestRank: null,
      contestsByMode: { duel: 0, practice: 0, multiplayer: 0 },
      recentActivity: []
    };
  }

  let totalQuestionsAttempted = 0;
  let totalCorrectAnswers = 0;
  let bestRank = Infinity;
  const contestsByMode = { duel: 0, practice: 0, multiplayer: 0 };
  const recentActivity = [];

  contests.forEach(contest => {
    // Count contests by mode
    contestsByMode[contest.mode] = (contestsByMode[contest.mode] || 0) + 1;

    // Calculate user's performance in this contest
    const userResults = contest.standing.filter(
      s => s.user.toString() === userId
    );
    const userScore = userResults.reduce((sum, r) => sum + r.result, 0);
    totalQuestionsAttempted += userResults.length;
    totalCorrectAnswers += userScore;

    // Calculate rank
    const scores = {};
    contest.standing.forEach(s => {
      const uid = s.user.toString();
      if (!scores[uid]) scores[uid] = 0;
      scores[uid] += s.result;
    });
    const sortedScores = Object.entries(scores)
      .map(([uid, score]) => ({ uid, score }))
      .sort((a, b) => b.score - a.score);
    const rank = sortedScores.findIndex(s => s.uid === userId) + 1;
    
    if (rank > 0 && rank < bestRank) {
      bestRank = rank;
    }

    // Add to recent activity (last 5 contests)
    if (recentActivity.length < 5) {
      recentActivity.push({
        contestCode: contest.code,
        mode: contest.mode,
        score: userScore,
        totalQuestions: contest.questions.length,
        rank,
        date: contest.startTime || contest.createdAt
      });
    }
  });

  const averageScore = totalQuestionsAttempted > 0 
    ? (totalCorrectAnswers / totalQuestionsAttempted) * 100 
    : 0;
  
  const accuracyRate = totalQuestionsAttempted > 0
    ? (totalCorrectAnswers / totalQuestionsAttempted) * 100
    : 0;

  return {
    totalContests: contests.length,
    totalQuestionsAttempted,
    totalCorrectAnswers,
    averageScore: Math.round(averageScore * 100) / 100,
    accuracyRate: Math.round(accuracyRate * 100) / 100,
    bestRank: bestRank === Infinity ? null : bestRank,
    contestsByMode,
    recentActivity
  };
}
