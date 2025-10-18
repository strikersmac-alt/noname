import { Router } from 'express';
import { addMultipleQuestions, getQuestionsByCourseAndWeeks } from '../controllers/nptel.controller.js';

const router = Router();

router.post('/questions', addMultipleQuestions);
router.get('/questions/:courseCode', getQuestionsByCourseAndWeeks);

export default router;