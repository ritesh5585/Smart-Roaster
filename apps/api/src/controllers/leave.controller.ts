import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Prisma, LeaveType } from "@prisma/client";
import { dateStringSchema, formatDate, parseDate } from "../lib/date";

const createLeaveSchema = z.object({
  employeeId: z.string().trim().uuid(),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  type: z.nativeEnum(LeaveType).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function getLeaves(req: Request, res: Response) {
  const { employeeId, from, to } = req.query;

  const where: Prisma.LeaveWhereInput = {};

  if (typeof employeeId === "string" && employeeId.trim()) {
    where.employeeId = employeeId.trim();
  }

  const fromStr = typeof from === "string" ? from.trim() : undefined;
  const toStr = typeof to === "string" ? to.trim() : undefined;

  if (fromStr && !dateStringSchema.safeParse(fromStr).success) {
    return res.status(400).json({ error: "Invalid from date" });
  }
  if (toStr && !dateStringSchema.safeParse(toStr).success) {
    return res.status(400).json({ error: "Invalid to date" });
  }

  if (fromStr && toStr) {
    const fromDate = parseDate(fromStr);
    const toDate = parseDate(toStr);
    if (toDate < fromDate) {
      return res
        .status(400)
        .json({ error: "to date must be greater than or equal to from date" });
    }
    where.AND = [
      { startDate: { lte: toDate } },
      { endDate: { gte: fromDate } },
    ];
  } else if (fromStr) {
    where.endDate = { gte: parseDate(fromStr) };
  } else if (toStr) {
    where.startDate = { lte: parseDate(toStr) };
  }

  const leaves = await prisma.leave.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { startDate: "asc" },
  });

  res.json(
    leaves.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      employeeName: l.employee.name,
      employee: l.employee,
      startDate: formatDate(l.startDate),
      endDate: formatDate(l.endDate),
      type: l.type,
      note: l.note,
      createdAt: l.createdAt,
    })),
  );
}

export async function createLeave(req: Request, res: Response) {
  const parsed = createLeaveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { employeeId, startDate, endDate, type, note } = parsed.data;

  // Rule 1: endDate >= startDate (400)
  if (endDate < startDate) {
    return res
      .status(400)
      .json({ error: "endDate must be greater than or equal to startDate" });
  }

  // Rule 2: employee must exist and be active (400)
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });
  if (!employee) {
    return res.status(400).json({ error: "Employee does not exist" });
  }
  if (!employee.isActive) {
    return res
      .status(400)
      .json({ error: "Cannot create leave for an inactive employee" });
  }

  const startParsed = parseDate(startDate);
  const endParsed = parseDate(endDate);

  // Rule 3: reject overlap with an existing leave of the same employee with 409 and a clear message
  const overlapping = await prisma.leave.findFirst({
    where: {
      employeeId,
      startDate: { lte: endParsed },
      endDate: { gte: startParsed },
    },
    orderBy: { startDate: "asc" },
  });

  if (overlapping) {
    return res.status(409).json({
      error: `Leave overlaps with existing leave (${formatDate(overlapping.startDate)} to ${formatDate(overlapping.endDate)})`,
    });
  }

  try {
    const leave = await prisma.leave.create({
      data: {
        employeeId,
        startDate: startParsed,
        endDate: endParsed,
        type: type || LeaveType.LEAVE,
        note: note || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      id: leave.id,
      employeeId: leave.employeeId,
      employeeName: leave.employee.name,
      employee: leave.employee,
      startDate: formatDate(leave.startDate),
      endDate: formatDate(leave.endDate),
      type: leave.type,
      note: leave.note,
      createdAt: leave.createdAt,
    });
  } catch (err) {
    throw err;
  }
}

export async function deleteLeave(req: Request, res: Response) {
  const id = req.params.id as string;
  try {
    await prisma.leave.delete({
      where: { id },
    });
    res.json({ message: "Leave deleted" });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return res.status(404).json({ error: "Leave not found" });
      }
    }
    throw err;
  }
}
