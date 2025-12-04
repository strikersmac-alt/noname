// MindMuseServer/api/routes/quiz.route.js

import { Router } from "express";
import { createContestController, createNptelContestController } from "../controllers/quiz.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import multer from 'multer';
const upload =  multer({dest : 'uploads/'});

const router = Router();

// This defines the POST endpoint at /api/quiz/generate
// router.post('/generate', createQuiz);
router.post('/createContest', authMiddleware, upload.single('pdf') , createContestController)
router.post('/createNptelContest', authMiddleware, createNptelContestController)


export default router;