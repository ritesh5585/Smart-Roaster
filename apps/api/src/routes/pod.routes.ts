import { Router } from "express";
import { getPods, createPod, updatePod } from "../controllers/pod.controller";
import { requireAuth, managerOnly } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.get("/", getPods);
router.post("/", managerOnly, createPod);
router.patch("/:id", managerOnly, updatePod);

export default router;
