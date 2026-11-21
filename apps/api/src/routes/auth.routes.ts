import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, me } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/requireAuth";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, try again later" },
});

const router = Router();

router.post("/login", loginLimiter, login);
router.get("/me", requireAuth, me);
router.post("/logout", logout);

export default router;
