import { Router } from "express";
import {
  getBrands,
  createBrand,
  updateBrand,
} from "../controllers/brand.controller";
import { requireAuth, managerOnly } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.get("/", getBrands);
router.post("/", managerOnly, createBrand);
router.patch("/:id", managerOnly, updateBrand);

export default router;
