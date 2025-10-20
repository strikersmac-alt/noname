import express from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';

import {
    createUserContestAnalytics,
    createUserNptelAnalytics,
    createDailyUserAnalytics,
    createContestAnalytics,
    createNptelPracticeAnalytics,
    getDailyActiveUsers,
    getUserAnalytics,
    getContestAnalytics,
    getNptelPracticeAnalytics
} from '../controllers/analytics.controller.js'

const router = express.Router();

// create
router.post('/user-contest-analytics', authMiddleware, createUserContestAnalytics);
router.post('/user-nptel-analytics', authMiddleware, createUserNptelAnalytics);

router.post('/daily-user-analytics', authMiddleware, createDailyUserAnalytics);

router.post('/contest-analytics', authMiddleware, createContestAnalytics);

router.post('/nptel-practice-analytics', authMiddleware, createNptelPracticeAnalytics);


// get
router.get('/daily-active-users/:timestamp', getDailyActiveUsers);

router.get('/user-analytics/:userId', authMiddleware, getUserAnalytics);

router.get('/contest-analytics/:contestId', authMiddleware, getContestAnalytics);

router.get('/nptel-practice-analytics/:userId', authMiddleware, getNptelPracticeAnalytics);

export default router;