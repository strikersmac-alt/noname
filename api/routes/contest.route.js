import { Router } from 'express';
import { getContestQuestionsById, getContestQuestionsByCode, getContestSummary } from '../controllers/contest.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// Fetch questions by MongoDB _id
router.get('/:id/questions', getContestQuestionsById);

// Optional: Fetch questions by contest code
router.get('/code/:code/questions', getContestQuestionsByCode);

// Get contest summary with correct answers and user responses (requires authentication)
router.get('/:id/summary', authMiddleware, getContestSummary);

// Validate a specific answer - DEPRECATED: Now using socket events for validation
// router.post('/:id/validate', validateContestAnswer);

export default router;
