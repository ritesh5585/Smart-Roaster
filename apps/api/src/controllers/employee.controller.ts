import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().optional().nullable(),
  podId: z.string().trim().uuid().optional().nullable(),
});

const updateEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional().nullable(),
  podId: z.string().trim().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  preferredOffDay: z.number().int().min(0).max(6).optional().nullable(),
});

export async function getEmployees(req: Request, res: Response) {
  const where = req.query.active === "true" ? { isActive: true } : {};
  const employees = await prisma.employee.findMany({
    where,
    include: {
      pod: true,
      _count: { select: { assignments: true } },
    },
    orderBy: { name: "asc" },
  });
  res.json(employees);
}

export async function createEmployee(req: Request, res: Response) {
  const parsed = createEmployeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { name, email, podId } = parsed.data;
  try {
    const employee = await prisma.employee.create({
      data: {
        name,
        email: email || null,
        podId: podId || null,
      },
      include: {
        pod: true,
        _count: { select: { assignments: true } },
      },
    });
    res.status(201).json(employee);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002")
        return res.status(409).json({ error: "Employee email already exists" });
      if (err.code === "P2003")
        return res.status(400).json({ error: "Referenced pod does not exist" });
    }
    throw err;
  }
}

export async function updateEmployee(req: Request, res: Response) {
  const parsed = updateEmployeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const id = req.params.id as string;
  const data: {
    name?: string;
    email?: string | null;
    podId?: string | null;
    isActive?: boolean;
    preferredOffDay?: number | null;
  } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.email !== undefined) data.email = parsed.data.email;
  if (parsed.data.podId !== undefined) data.podId = parsed.data.podId;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.preferredOffDay !== undefined) data.preferredOffDay = parsed.data.preferredOffDay;

  if (Object.keys(data).length === 0)
    return res.status(400).json({ error: "No fields to update" });

  try {
    const employee = await prisma.employee.update({
      where: { id },
      data,
      include: {
        pod: true,
        _count: { select: { assignments: true } },
      },
    });
    res.json(employee);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025")
        return res.status(404).json({ error: "Employee not found" });
      if (err.code === "P2002")
        return res.status(409).json({ error: "Employee email already exists" });
      if (err.code === "P2003")
        return res.status(400).json({ error: "Referenced pod does not exist" });
    }
    throw err;
  }
}
