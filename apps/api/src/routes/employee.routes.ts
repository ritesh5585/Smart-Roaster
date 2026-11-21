import { Router } from "express";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
} from "../controllers/employee.controller";
import { requireAuth, managerOnly } from "../middleware/requireAuth";

const router = Router();

router.use(requireAuth);
router.get("/", getEmployees);
router.post("/", managerOnly, createEmployee);
router.patch("/:id", managerOnly, updateEmployee);

export default router;
