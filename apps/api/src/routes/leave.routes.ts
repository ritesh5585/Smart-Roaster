import { Router } from "express";
import {
  getLeaves,
  createLeave,
  deleteLeave,
} from "../controllers/leave.controller";
import { requireAuth, requireRole } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.get("/", getLeaves);
router.post("/", requireRole("ADMIN", "MANAGER"), createLeave);
router.delete("/:id", requireRole("ADMIN", "MANAGER"), deleteLeave);

export default router;
