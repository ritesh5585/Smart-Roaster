import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { parseDate, dateStringSchema } from "../lib/date";
import { generateRoster } from "../engine/generate";
import { suggestBackups } from "../engine/suggest";
import { loadEngineInput, getRosterView } from "../services/roster.service";

const generateSchema = z.object({
  year: z.number().int().min(2024).max(2100),
  month: z.number().int().min(1).max(12),
  overwrite: z.boolean().optional(),
});

const updateEntrySchema = z.object({
  employeeId: z.string().trim().uuid(),
  date: dateStringSchema,
  status: z.enum(["WORKING", "WEEKOFF"]),
  version: z.number().int(),
});

const publishSchema = z.object({
  acknowledgeErrors: z.boolean().optional(),
});

export async function getRosterByMonth(req: Request, res: Response) {
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (
    !year ||
    isNaN(year) ||
    !month ||
    isNaN(month) ||
    month < 1 ||
    month > 12
  ) {
    return res.status(400).json({ error: "Invalid year or month" });
  }

  const roster = await prisma.roster.findUnique({
    where: {
      year_month: { year, month },
    },
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      version: true,
      updatedAt: true,
    },
  });

  return res.json({ roster });
}

export async function generateRosterHandler(req: Request, res: Response) {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const { year, month, overwrite } = parsed.data;

  const existing = await prisma.roster.findUnique({
    where: { year_month: { year, month } },
    select: { id: true, status: true },
  });

  if (existing) {
    if (existing.status === "PUBLISHED") {
      return res.status(409).json({ error: "Unpublish first" });
    }
    if (existing.status === "DRAFT" && !overwrite) {
      return res.status(409).json({
        error:
          "Roster already exists as draft, set overwrite to true to regenerate",
      });
    }
  }

  const input = await loadEngineInput(year, month);
  const { entries } = generateRoster(input);

  const roster = await prisma.$transaction(
    async (tx) => {
      const r = await tx.roster.upsert({
        where: { year_month: { year, month } },
        create: { year, month, status: "DRAFT", version: 1 },
        update: { status: "DRAFT", version: 1 },
      });

      await tx.rosterEntry.deleteMany({
        where: { rosterId: r.id },
      });

      await tx.rosterEntry.createMany({
        data: entries.map((e) => ({
          rosterId: r.id,
          employeeId: e.employeeId,
          date: parseDate(e.date),
          status: e.status,
          source: e.source,
        })),
      });

      return r;
    },
    { timeout: 20000 },
  );

  const view = await getRosterView(roster.id);
  return res.json(view);
}

export async function getRosterById(req: Request, res: Response) {
  const id = req.params.id as string;
  const view = await getRosterView(id);
  if (!view) {
    return res.status(404).json({ error: "Roster not found" });
  }
  return res.json(view);
}

export async function updateRosterEntry(req: Request, res: Response) {
  const id = req.params.id as string;
  const parsed = updateEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const { employeeId, date, status, version } = parsed.data;

  const roster = await prisma.roster.findUnique({
    where: { id },
    select: { id: true, year: true, month: true, status: true, version: true },
  });
  if (!roster) {
    return res.status(404).json({ error: "Roster not found" });
  }

  if (roster.status !== "DRAFT") {
    return res.status(409).json({ error: "Only DRAFT rosters can be edited" });
  }

  if (version !== roster.version) {
    return res
      .status(409)
      .json({ error: "Roster was changed by someone else, reload" });
  }

  const [y, m] = date.split("-").map(Number);
  if (y !== roster.year || m !== roster.month) {
    return res
      .status(400)
      .json({ error: "Date must be inside the roster's month" });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, isActive: true },
  });
  if (!employee || !employee.isActive) {
    return res.status(400).json({ error: "Employee must exist and be active" });
  }

  const entryDate = parseDate(date);

  const updatedRoster = await prisma.$transaction(async (tx) => {
    await tx.rosterEntry.upsert({
      where: {
        rosterId_employeeId_date: {
          rosterId: id,
          employeeId,
          date: entryDate,
        },
      },
      create: {
        rosterId: id,
        employeeId,
        date: entryDate,
        status,
        source: "MANUAL",
      },
      update: {
        status,
        source: "MANUAL",
      },
    });

    return tx.roster.update({
      where: { id },
      data: { version: { increment: 1 } },
      select: { version: true },
    });
  });

  const view = await getRosterView(id);
  if (!view) {
    return res.status(404).json({ error: "Roster not found" });
  }

  return res.json({
    version: updatedRoster.version,
    issues: view.issues,
    summary: view.summary,
  });
}

export async function getSuggestions(req: Request, res: Response) {
  const id = req.params.id as string;
  const brandProcessId =
    typeof req.query.brandProcessId === "string"
      ? req.query.brandProcessId.trim()
      : "";
  const date = typeof req.query.date === "string" ? req.query.date.trim() : "";

  if (!brandProcessId || !date || !dateStringSchema.safeParse(date).success) {
    return res.status(400).json({ error: "Invalid brandProcessId or date" });
  }

  const view = await getRosterView(id);
  if (!view) {
    return res.status(404).json({ error: "Roster not found" });
  }

  const matchingGap = view.issues.find(
    (i) =>
      i.type === "COVERAGE_GAP" &&
      i.brandProcessId === brandProcessId &&
      i.date === date,
  );
  if (!matchingGap) {
    return res.status(404).json({ error: "No matching coverage gap found" });
  }

  const input = await loadEngineInput(view.roster.year, view.roster.month);
  const suggestions = suggestBackups(input, view.entries, matchingGap);

  const empMap = new Map(view.meta.employees.map((e) => [e.id, e.name]));
  const enriched = suggestions.map((s) => ({
    ...s,
    employeeName: empMap.get(s.employeeId) ?? s.employeeId,
  }));

  return res.json(enriched);
}

export async function publishRoster(req: Request, res: Response) {
  const id = req.params.id as string;
  const parsed = publishSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const { acknowledgeErrors } = parsed.data;

  const view = await getRosterView(id);
  if (!view) {
    return res.status(404).json({ error: "Roster not found" });
  }

  const errorCount = view.summary.errors;
  if (errorCount > 0 && !acknowledgeErrors) {
    return res.status(409).json({
      error: `Roster has ${errorCount} error(s)`,
      errorCount,
    });
  }

  const updated = await prisma.roster.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      version: { increment: 1 },
    },
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      version: true,
      updatedAt: true,
    },
  });

  return res.json({ roster: updated });
}

export async function unpublishRoster(req: Request, res: Response) {
  const id = req.params.id as string;
  const roster = await prisma.roster.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!roster) {
    return res.status(404).json({ error: "Roster not found" });
  }

  const updated = await prisma.roster.update({
    where: { id },
    data: {
      status: "DRAFT",
      version: { increment: 1 },
    },
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      version: true,
      updatedAt: true,
    },
  });

  return res.json({ roster: updated });
}
