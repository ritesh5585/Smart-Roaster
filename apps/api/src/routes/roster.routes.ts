import { Router } from "express";
import {
  getRosterByMonth,
  generateRosterHandler,
  getRosterById,
  updateRosterEntry,
  getSuggestions,
  publishRoster,
  unpublishRoster,
} from "../controllers/roster.controller";
import { requireAuth, managerOnly } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);

router.get("/", getRosterByMonth);
router.post("/generate", managerOnly, generateRosterHandler);
router.get("/:id", getRosterById);
router.patch("/:id/entries", managerOnly, updateRosterEntry);
router.get("/:id/suggestions", getSuggestions);
router.post("/:id/publish", managerOnly, publishRoster);
router.post("/:id/unpublish", managerOnly, unpublishRoster);

export default router;
