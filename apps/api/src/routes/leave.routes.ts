import { Router } from "express";
import {
  getLeaves,
  createLeave,
  deleteLeave,
} from "../controllers/leave.controller";
import { requireAuth, managerOnly } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.get("/", getLeaves);
router.post("/", managerOnly, createLeave);
router.delete("/:id", managerOnly, deleteLeave);

export default router;
