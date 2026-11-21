import { Router } from "express";
import {
  createAssignment,
  deleteAssignment,
} from "../controllers/assignment.controller";
import { requireAuth, managerOnly } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.post("/", managerOnly, createAssignment);
router.delete("/:id", managerOnly, deleteAssignment);

export default router;
