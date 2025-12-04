import User from "../models/user.model.js";
import Contest from "../models/contest.model.js";

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // From auth middleware

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Validate pagination parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 50); // Max 50 items per page
    const skip = (validatedPage - 1) * validatedLimit;

    // Fetch user basic info
    const user = await User.findById(userId).select(
      "name email profilePicture contests createdAt"
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Get total contest count
    const totalContests = user.contests.length;
    const totalPages = Math.ceil(totalContests / validatedLimit);

    const reversedContests = [...user.contests].reverse();

    // Get paginated contest IDs
    const paginatedContestIds = reversedContests.slice(
      skip,
      skip + validatedLimit
    );

    // Fetch paginated contests with full data
    const contests = await Contest.find({
      _id: { $in: paginatedContestIds },
    })
      .select(
        "code mode isLive duration startTime createdAt standing questions"
      )
      .lean();

    contests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Limit insights to recent 100 contests to prevent performance issues
    // For users with hundreds of contests, calculating all insights is too slow
    const recentContestIds = reversedContests.slice(0, 100);
    // Limit insights to recent 100 contests to prevent performance issues
    // For users with hundreds of contests, calculating all insights is too slow
    const recentContestIds = reversedContests.slice(0, 100);
    const allContestsForInsights = await Contest.find({
// <<<<<<< HEAD
//       _id: { $in: user.contests },
// =======
      _id: { $in: recentContestIds }
// >>>>>>> 3259f2559c93fa83b5aab7de081e95fa21380a96
      _id: { $in: recentContestIds }
    })
      .select("mode standing questions createdAt")
      .lean();

    // Calculate insights from recent contest history (max 100 contests)
    // Calculate insights from recent contest history (max 100 contests)
    const insights = calculateUserInsights(allContestsForInsights, userId);

    // Format paginated contest history
    const contestHistory = contests.map((contest) => {
      const userResults = contest.standing.filter(
        (s) => s.user.toString() === userId
      );
      const userScore = userResults.reduce((sum, r) => sum + r.result, 0);
      const totalQuestions = contest.questions.length;

      // Calculate rank
      const scores = {};
      contest.standing.forEach((s) => {
        const uid = s.user.toString();
        scores[uid] = (scores[uid] || 0) + s.result;
      });
      const sortedScores = Object.entries(scores)
        .map(([uid, score]) => ({ uid, score }))
        .sort((a, b) => b.score - a.score);
      const rank = sortedScores.findIndex((s) => s.uid === userId) + 1;

      // Derive unique non-empty topics from questions
      const topics = Array.from(
        new Set(
          (contest.questions || [])
            .map((q) => q.topic)
            .filter((t) => typeof t === "string" && t.trim().length > 0)
        )
      );

      return {
        contestId: contest._id,
        code: contest.code,
        mode: contest.mode,
        isLive: contest.isLive,
        duration: contest.duration,
        startTime: contest.startTime,
        createdAt: contest.createdAt,
        topic: topics[0] || null,
        topics,
        userScore,
        totalQuestions,
        rank,
        totalParticipants: sortedScores.length,
      };
    });
    return res.status(200).json({
      success: true,
      profile: {
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        memberSince: user.createdAt,
      },
      contestHistory,
      insights,
      pagination: {
        currentPage: validatedPage,
        totalPages: totalPages || 1,
        totalContests,
        hasNextPage: validatedPage < totalPages,
        hasPrevPage: validatedPage > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Helper function to calculate user insights
function calculateUserInsights(contests, userId) {
  if (contests.length === 0) {
    return {
      totalContests: 0,
      totalQuestionsAttempted: 0,
      totalCorrectAnswers: 0,
      averageScore: 0,
      accuracyRate: 0,
      bestRank: null,
      contestsByMode: { duel: 0, practice: 0, multiplayer: 0 },
      recentActivity: [],
    };
  }

  let totalQuestionsAttempted = 0;
  let totalCorrectAnswers = 0;
  let bestRank = Infinity;
  const contestsByMode = { duel: 0, practice: 0, multiplayer: 0 };
  const recentActivity = [];

  contests.forEach((contest) => {
    // Count contests by mode
    contestsByMode[contest.mode] = (contestsByMode[contest.mode] || 0) + 1;

    // Calculate user's performance in this contest
    const userResults = contest.standing.filter(
      (s) => s.user.toString() === userId
    );
    const userScore = userResults.reduce((sum, r) => sum + r.result, 0);
    totalQuestionsAttempted += userResults.length;
    totalCorrectAnswers += userScore;

    // Calculate rank
    const scores = {};
    contest.standing.forEach((s) => {
      const uid = s.user.toString();
      if (!scores[uid]) scores[uid] = 0;
      scores[uid] += s.result;
    });
    const sortedScores = Object.entries(scores)
      .map(([uid, score]) => ({ uid, score }))
      .sort((a, b) => b.score - a.score);
    const rank = sortedScores.findIndex((s) => s.uid === userId) + 1;

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
        date: contest.startTime || contest.createdAt,
      });
    }
  });

  const averageScore =
    totalQuestionsAttempted > 0
      ? (totalCorrectAnswers / totalQuestionsAttempted) * 100
      : 0;

  const accuracyRate =
    totalQuestionsAttempted > 0
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
    recentActivity,
  };
}
