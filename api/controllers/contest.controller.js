import Contest from "../models/contest.model.js";
import mongoose from "mongoose";

// ================= In-memory cache (FIFO eviction) =================
const CONTEST_CACHE_LIMIT = 10;
// contestId -> { adminId: string, userIds: Set<string>, answerKey: Map<string, string> } // questionId -> correctAnswerText
const contestCache = new Map();

export const normalize = (str) => (str ?? "").toString().trim();

// Helper to normalize array of answers for comparison
export const normalizeAnswerArray = (answers) => {
  if (!Array.isArray(answers)) {
    return [normalize(answers)];
  }
  return answers.map((a) => normalize(a)).sort();
};

const buildAndCacheContest = async (contestId, useMongoId = false) => {
  const query = useMongoId ? { _id: contestId } : { code: contestId };

  const contest = await Contest.findOne(query)
    .select("code admin users questions._id questions.correctAnswer")
    .lean();

  if (!contest) return null;

  const answerKey = new Map();
  for (const q of contest.questions || []) {
    // Store correctAnswer as normalized array
    answerKey.set(String(q._id), normalizeAnswerArray(q.correctAnswer));
  }

  const entry = {
    adminId: String(contest.admin),
    userIds: new Set((contest.users || []).map((u) => String(u))),
    answerKey,
    code: contest.code,
  };

  // Cache by both code and _id for flexible lookup
  const cacheKey = useMongoId ? String(contestId) : contest.code;

  // Evict oldest if over limit (FIFO)
  if (contestCache.size >= CONTEST_CACHE_LIMIT) {
    const oldestKey = contestCache.keys().next().value;
    contestCache.delete(oldestKey);
  }
  contestCache.set(cacheKey, entry);

  // Also cache by the other key for dual access
  if (useMongoId) {
    contestCache.set(contest.code, entry);
  } else {
    contestCache.set(String(contest._id), entry);
  }

  return entry;
};

export const getContestEntry = async (contestId) => {
  const key = String(contestId);
  if (contestCache.has(key)) return contestCache.get(key);

  // Check if it's a MongoDB ObjectId (24 hex chars) or a contest code (6 digits)
  const isMongoId =
    mongoose.Types.ObjectId.isValid(contestId) && contestId.length === 24;
  return await buildAndCacheContest(key, isMongoId);
};

// ================= Controllers =================

// GET /api/contest/:id/questions
// Returns the questions for a specific contest by MongoDB _id without answers
export const getContestQuestionsById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid contest id" });
    }

    const contest = await Contest.findById(id).select(
      "code mode contestType isLive duration startTime timeZone admin questions._id questions.statement questions.options questions.topic questions.correctAnswer questions.week"
    );

    if (!contest) {
      return res
        .status(404)
        .json({ success: false, message: "Contest not found" });
    }

    return res.status(200).json({
      success: true,
      questions: contest.questions.map((q) => ({
        _id: q._id,
        statement: q.statement,
        options: q.options,
        topic: q.topic,
        week: q.week,
        correctAnswerCount: Array.isArray(q.correctAnswer)
          ? q.correctAnswer.length
          : 1,
      })),
      meta: {
        code: contest.code,
        mode: contest.mode,
        contestType: contest.contestType,
        isLive: contest.isLive,
        duration: contest.duration,
        startTime: contest.startTime,
        timeZone: contest.timeZone,
        id: contest._id,
        adminId: contest.admin,
      },
    });
  } catch (error) {
    console.error("Error fetching contest questions by id:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// GET /api/contest/code/:code/questions
// Convenience endpoint if you want to fetch using the human-readable contest code without answers
export const getContestQuestionsByCode = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: "Contest code is required" });
    }

    const contest = await Contest.findOne({ code }).select(
      "code mode contestType isLive duration startTime timeZone admin questions._id questions.statement questions.options questions.topic questions.correctAnswer questions.week"
    );

    if (!contest) {
      return res
        .status(404)
        .json({ success: false, message: "Contest not found" });
    }

    return res.status(200).json({
      success: true,
      questions: contest.questions.map((q) => ({
        _id: q._id,
        statement: q.statement,
        options: q.options,
        topic: q.topic,
        week: q.week,
        correctAnswerCount: Array.isArray(q.correctAnswer)
          ? q.correctAnswer.length
          : 1,
      })),
      meta: {
        code: contest.code,
        mode: contest.mode,
        contestType: contest.contestType,
        isLive: contest.isLive,
        duration: contest.duration,
        startTime: contest.startTime,
        timeZone: contest.timeZone,
        id: contest._id,
        adminId: contest.admin,
      },
    });
  } catch (error) {
    console.error("Error fetching contest questions by code:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// POST /api/contest/:id/validate
// Here :id is the roomId (contest code), not the MongoDB _id
// Body: { userId: string, questionId: string, response: string }
// Validates the user's answer without revealing the correct answer.
export const validateContestAnswer = async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { userId, questionId, response } = req.body || {};

    if (!roomId) {
      return res
        .status(400)
        .json({ success: false, message: "roomId is required in path" });
    }
    if (!userId || !questionId || response === undefined || response === null) {
      return res
        .status(400)
        .json({
          success: false,
          message: "userId, questionId and response are required",
        });
    }

    const entry = await getContestEntry(roomId);
    if (!entry) {
      return res
        .status(404)
        .json({ success: false, message: "Contest not found" });
    }

    const enrolled =
      String(entry.adminId) === String(userId) ||
      entry.userIds.has(String(userId));
    if (!enrolled) {
      return res
        .status(403)
        .json({ success: false, message: "User not enrolled in contest" });
    }

    const ans = entry.answerKey.get(String(questionId));
    if (!ans) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid question for this contest" });
    }

    let correct = false;
    if (typeof response === "string") {
      correct = normalize(response) === normalize(ans);
    }

    return res.status(200).json({ success: true, correct });
  } catch (error) {
    console.error("Error validating contest answer:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// GET /api/contest/:id/standings
// Returns the standings for a contest (works for both live and completed contests)
export const getContestStandings = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid contest id" });
    }

    const contest = await Contest.findById(id)
      .select("code mode isLive standing users startTime") // Include startTime
      .populate("users", "name profilePicture")
      .lean();

    if (!contest) {
      return res
        .status(404)
        .json({ success: false, message: "Contest not found" });
    }

    // Compute scores from standing array
    const scores = {};
    (contest.standing || []).forEach((entry) => {
      const userId = String(entry.user);
      scores[userId] = (scores[userId] || 0) + (entry.result || 0);
    });

    // NEW: Declare startTime here (MISSING LINE - add this!)
    const startTime = contest.startTime || 0;

    // Compute timeTaken and attempted per user
    const standings = Object.entries(scores).map(([userId, score]) => {
      const userEntries = contest.standing.filter(
        (s) => String(s.user) === userId
      );
      let timeTaken = 999999999; // Sentinel for unfinished
      if (userEntries.length > 0) {
        const timestamps = userEntries
          .map((e) => (e.timestamp ? new Date(e.timestamp).getTime() : 0))
          .filter((t) => t > 0);
        if (timestamps.length > 0) {
          const maxTimestamp = Math.max(...timestamps);
          timeTaken = maxTimestamp - startTime;  // Now defined!
          if (timeTaken < 0) timeTaken = 0;
        }
      }

      const user = contest.users.find((u) => String(u._id) === userId);
      return {
        userId,
        name: user?.name || "Unknown",
        score,
        timeTaken,
        attempted: userEntries.length, // Number of questions attempted by this user
      };
    });

    // Sort by score DESC, then timeTaken ASC (faster first)
    standings.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.timeTaken - b.timeTaken;
    });

    return res.status(200).json({
      success: true,
      standings, // Now includes timeTaken & attempted
      isLive: contest.isLive,
      contestCode: contest.code,
      mode: contest.mode,
    });
  } catch (error) {
    console.error("Error fetching contest standings:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
// GET /api/contest/:id/summary
// Returns contest summary with questions, correct answers, and user's responses
export const getContestSummary = async (req, res) => {
  try {
    const { id } = req.params;
    // JWT payload contains userId field, not _id
    const userId = req.user?.userId || req.user?._id;

    // console.log('Contest summary request - User:', req.user, 'UserId:', userId);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid contest id" });
    }

    const contest = await Contest.findById(id)
      .select(
        "code mode isLive duration startTime timeZone admin questions standing users"
      )
      .lean();

    if (!contest) {
      return res
        .status(404)
        .json({ success: false, message: "Contest not found" });
    }

    // console.log('Contest found:', id, 'Users:', contest.users.length, 'Standing entries:', contest.standing.length);

    // Check if user participated in the contest
    const isParticipant =
      contest.users.some((u) => String(u) === String(userId)) ||
      String(contest.admin) === String(userId);

    if (!isParticipant) {
      // console.log('User not participant. UserId:', userId, 'Contest users:', contest.users.map(u => String(u)));
      return res
        .status(403)
        .json({
          success: false,
          message: "You did not participate in this contest",
        });
    }

    // Get user's answers from standing
    const userAnswers = contest.standing
      .filter((s) => String(s.user) === String(userId))
      .map((s) => ({
        questionId: String(s.question),
        isCorrect: s.result === 1,
        answer: s.answer || [], // Store the actual answer if available
      }));

    // console.log('User answers found:', userAnswers.length);

    // Return questions with correct answers
    const questions = contest.questions.map((q) => ({
      _id: q._id,
      statement: q.statement,
      options: q.options,
      correctAnswer: q.correctAnswer,
      topic: q.topic,
      week: q.week,
    }));

    return res.status(200).json({
      success: true,
      questions,
      userAnswers,
      meta: {
        code: contest.code,
        mode: contest.mode,
        isLive: contest.isLive,
        duration: contest.duration,
        startTime: contest.startTime,
        timeZone: contest.timeZone,
        id: contest._id,
        adminId: contest.admin,
      },
    });
  } catch (error) {
    console.error("Error fetching contest summary:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
