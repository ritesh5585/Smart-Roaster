import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

const createAssignmentSchema = z.object({
  employeeId: z.string().trim().uuid(),
  brandProcessId: z.string().trim().uuid(),
});

export async function createAssignment(req: Request, res: Response) {
  const parsed = createAssignmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { employeeId, brandProcessId } = parsed.data;

  // Check employee exists and is active
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  if (!employee.isActive)
    return res.status(400).json({ error: "Cannot assign inactive employee" });

  // Check brandProcess exists
  const brandProcess = await prisma.brandProcess.findUnique({
    where: { id: brandProcessId },
  });
  if (!brandProcess)
    return res.status(404).json({ error: "BrandProcess not found" });

  try {
    const assignment = await prisma.assignment.create({
      data: {
        employeeId,
        brandProcessId,
      },
      include: {
        employee: true,
        brandProcess: {
          include: {
            brand: true,
            process: true,
          },
        },
      },
    });
    res.status(201).json(assignment);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return res
          .status(409)
          .json({ error: "Employee already assigned to this brand process" });
      }
      if (err.code === "P2003") {
        return res
          .status(400)
          .json({ error: "Referenced record does not exist" });
      }
    }
    throw err;
  }
}

export async function deleteAssignment(req: Request, res: Response) {
  const id = req.params.id as string;
  try {
    await prisma.assignment.delete({
      where: { id },
    });
    res.json({ message: "Assignment deleted" });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025")
        return res.status(404).json({ error: "Assignment not found" });
    }
    throw err;
  }
}
