import { Router } from "express";
import { getProcesses } from "../controllers/process.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.get("/", getProcesses);

export default router;
