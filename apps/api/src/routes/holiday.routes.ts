import { Router } from "express";
import {
  getHolidays,
  createHoliday,
  deleteHoliday,
} from "../controllers/holiday.controller";
import { requireAuth, requireRole } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.get("/", getHolidays);
router.post("/", requireRole("ADMIN", "MANAGER"), createHoliday);
router.delete("/:id", requireRole("ADMIN", "MANAGER"), deleteHoliday);

export default router;
