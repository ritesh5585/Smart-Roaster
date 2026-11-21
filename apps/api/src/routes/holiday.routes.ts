import { Router } from "express";
import {
  getHolidays,
  createHoliday,
  deleteHoliday,
} from "../controllers/holiday.controller";
import { requireAuth, managerOnly } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.get("/", getHolidays);
router.post("/", managerOnly, createHoliday);
router.delete("/:id", managerOnly, deleteHoliday);

export default router;
