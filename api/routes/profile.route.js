import { Router } from "express";
import { getUserProfile } from "../controllers/profile.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.get('/', authMiddleware, getUserProfile);

export default router;
