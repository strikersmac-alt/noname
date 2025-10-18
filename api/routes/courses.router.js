import { Router } from 'express';
import { addCourse, getAllCourses } from '../controllers/courses.controller.js';

const router = Router();

router.post('/courses', addCourse);
router.get('/courses', getAllCourses);


export default router;