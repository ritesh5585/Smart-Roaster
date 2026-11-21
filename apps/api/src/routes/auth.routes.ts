import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  googleLogin,
  login,
  logout,
  me,
  register,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/requireAuth";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, try again later" },
});

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/google", authLimiter, googleLogin);
router.get("/me", requireAuth, me);
router.post("/logout", logout);

export default router;
