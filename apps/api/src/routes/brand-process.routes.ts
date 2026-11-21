import { Router } from "express";
import {
  createBrandProcess,
  updateBrandProcess,
  deleteBrandProcess,
} from "../controllers/brand-process.controller";
import { requireAuth, managerOnly } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.post("/", managerOnly, createBrandProcess);
router.patch("/:id", managerOnly, updateBrandProcess);
router.delete("/:id", managerOnly, deleteBrandProcess);

export default router;
