import { Router } from "express";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
} from "../controllers/employee.controller";
import { requireAuth, requireRole } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.get("/", getEmployees);
router.post("/", requireRole("ADMIN", "MANAGER"), createEmployee);
router.patch("/:id", requireRole("ADMIN", "MANAGER"), updateEmployee);

export default router;
