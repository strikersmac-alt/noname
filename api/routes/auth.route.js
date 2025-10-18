import { Router } from "express";
import { google, logout, verifyAuth } from "../controllers/auth.controller.js";

const router = Router();

router.post('/google', google);
router.post('/logout', logout);
router.get('/verify', verifyAuth);
export default router;