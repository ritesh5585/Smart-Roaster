import { Router } from "express";
import { getPods, createPod, updatePod } from "../controllers/pod.controller";
import { requireAuth, requireRole } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.get("/", getPods);
router.post("/", requireRole("ADMIN", "MANAGER"), createPod);
router.patch("/:id", requireRole("ADMIN", "MANAGER"), updatePod);

export default router;
