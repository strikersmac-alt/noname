// MindMuseServer/api/routes/quiz.route.js

import { Router } from "express";
import { createContestController, createNptelContestController } from "../controllers/quiz.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

// This defines the POST endpoint at /api/quiz/generate
// router.post('/generate', createQuiz);
router.post('/createContest', authMiddleware, createContestController)
router.post('/createNptelContest', authMiddleware, createNptelContestController)

export default router;