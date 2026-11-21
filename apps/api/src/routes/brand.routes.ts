import { Router } from "express";
import {
  getBrands,
  createBrand,
  updateBrand,
} from "../controllers/brand.controller";
import { requireAuth, requireRole } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.get("/", getBrands);
router.post("/", requireRole("ADMIN", "MANAGER"), createBrand);
router.patch("/:id", requireRole("ADMIN", "MANAGER"), updateBrand);

export default router;
