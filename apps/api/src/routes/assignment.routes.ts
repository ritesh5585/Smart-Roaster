import { Router } from "express";
import {
  createAssignment,
  deleteAssignment,
} from "../controllers/assignment.controller";
import { requireAuth, requireRole } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.post("/", requireRole("ADMIN", "MANAGER"), createAssignment);
router.delete("/:id", requireRole("ADMIN", "MANAGER"), deleteAssignment);

export default router;
