import { Router } from "express";
import {
  createBrandProcess,
  updateBrandProcess,
  deleteBrandProcess,
} from "../controllers/brand-process.controller";
import { requireAuth, requireRole } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.post("/", requireRole("ADMIN", "MANAGER"), createBrandProcess);
router.patch("/:id", requireRole("ADMIN", "MANAGER"), updateBrandProcess);
router.delete("/:id", requireRole("ADMIN", "MANAGER"), deleteBrandProcess);

export default router;
