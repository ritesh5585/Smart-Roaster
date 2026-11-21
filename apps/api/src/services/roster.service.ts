import { prisma } from "../lib/prisma";
import { parseDate, formatDate } from "../lib/date";
import { monthDates } from "../engine/dates";
import { validateRoster } from "../engine/validate";
import { isOperating } from "../engine/generate";
import type {
  EngineInput,
  RosterEntry as EngineRosterEntry,
  Issue,
  OperatingRule,
  DayStatus,
} from "../engine/types";

export interface RosterView {
  roster: {
    id: string;
    year: number;
    month: number;
    status: string;
    version: number;
    updatedAt: Date;
  };
  entries: EngineRosterEntry[];
  issues: Issue[];
  coverage: {
    brandProcessId: string;
    date: string;
    required: number;
    actual: number;
  }[];
  meta: {
    employees: { id: string; name: string; podId: string | null }[];
    pods: { id: string; name: string; leadId: string | null }[];
    brandProcesses: {
      id: string;
      brandName: string;
      processCode: string;
      operatingRule: OperatingRule;
      minCoverage: number;
    }[];
    assignments: { employeeId: string; brandProcessId: string }[];
    holidays: string[];
  };
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    coveragePercent: number;
  };
}

export async function loadEngineInput(year: number, month: number): Promise<EngineInput> {
  const dates = monthDates(year, month);
  const firstDate = parseDate(dates[0]);
  const lastDate = parseDate(dates[dates.length - 1]);

  const [employees, brandProcesses, assignments, holidays, leaves] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        podId: true,
        preferredOffDay: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.brandProcess.findMany({
      where: { brand: { isActive: true } },
      select: {
        id: true,
        operatingRule: true,
        minCoverage: true,
        brand: { select: { name: true } },
        process: { select: { code: true } },
      },
      orderBy: { id: "asc" },
    }),
    prisma.assignment.findMany({
      where: {
        employee: { isActive: true },
        brandProcess: { brand: { isActive: true } },
      },
      select: {
        employeeId: true,
        brandProcessId: true,
      },
      orderBy: [{ employeeId: "asc" }, { brandProcessId: "asc" }],
    }),
    prisma.holiday.findMany({
      where: {
        date: {
          gte: firstDate,
          lte: lastDate,
        },
      },
      select: { date: true },
      orderBy: { date: "asc" },
    }),
    prisma.leave.findMany({
      where: {
        employee: { isActive: true },
        startDate: { lte: lastDate },
        endDate: { gte: firstDate },
      },
      select: {
        employeeId: true,
        startDate: true,
        endDate: true,
        type: true,
      },
      orderBy: [{ employeeId: "asc" }, { startDate: "asc" }],
    }),
  ]);

  return {
    year,
    month,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      podId: e.podId,
      preferredOffDay: e.preferredOffDay,
    })),
    brandProcesses: brandProcesses.map((bp) => ({
      id: bp.id,
      brandName: bp.brand.name,
      processCode: bp.process.code,
      operatingRule: bp.operatingRule as OperatingRule,
      minCoverage: bp.minCoverage,
    })),
    assignments: assignments.map((a) => ({
      employeeId: a.employeeId,
      brandProcessId: a.brandProcessId,
    })),
    holidays: holidays.map((h) => formatDate(h.date)),
    leaves: leaves.map((l) => ({
      employeeId: l.employeeId,
      startDate: formatDate(l.startDate),
      endDate: formatDate(l.endDate),
      type: l.type as "LEAVE" | "COMP_OFF",
    })),
  };
}

export async function loadRosterEntries(rosterId: string): Promise<EngineRosterEntry[]> {
  const dbEntries = await prisma.rosterEntry.findMany({
    where: { rosterId },
    select: {
      employeeId: true,
      date: true,
      status: true,
      source: true,
    },
    orderBy: [{ employeeId: "asc" }, { date: "asc" }],
  });

  return dbEntries.map((e) => ({
    employeeId: e.employeeId,
    date: formatDate(e.date),
    status: e.status as DayStatus,
    source: e.source as "AUTO" | "MANUAL",
  }));
}

export async function getRosterView(rosterId: string): Promise<RosterView | null> {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: {
      id: true,
      year: true,
      month: true,
      status: true,
      version: true,
      updatedAt: true,
    },
  });

  if (!roster) return null;

  const [entries, input, pods] = await Promise.all([
    loadRosterEntries(rosterId),
    loadEngineInput(roster.year, roster.month),
    prisma.pod.findMany({
      select: { id: true, name: true, leadId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const issues = validateRoster(input, entries);

  const dates = monthDates(roster.year, roster.month);
  const holidaySet = new Set(input.holidays);
  const assignedBpIds = new Set(input.assignments.map((a) => a.brandProcessId));
  const activeBpsWithAssignees = input.brandProcesses.filter((bp) => assignedBpIds.has(bp.id));

  const entryMap = new Map<string, DayStatus>();
  for (const entry of entries) {
    entryMap.set(`${entry.employeeId}:${entry.date}`, entry.status);
  }

  const getEffectiveStatus = (empId: string, date: string): DayStatus => {
    const leave = input.leaves.find(
      (l) => l.employeeId === empId && l.startDate <= date && l.endDate >= date
    );
    if (leave) {
      return leave.type;
    }
    return entryMap.get(`${empId}:${date}`) ?? "WORKING";
  };

  const assignedEmpIdsByBp = new Map<string, string[]>();
  for (const bp of input.brandProcesses) {
    assignedEmpIdsByBp.set(bp.id, []);
  }
  for (const a of input.assignments) {
    assignedEmpIdsByBp.get(a.brandProcessId)?.push(a.employeeId);
  }

  const coverage: {
    brandProcessId: string;
    date: string;
    required: number;
    actual: number;
  }[] = [];

  let totalOperatingBpDays = 0;
  let operatingBpDaysNoGap = 0;

  for (const bp of activeBpsWithAssignees) {
    const assignedEmpIds = assignedEmpIdsByBp.get(bp.id) ?? [];
    for (const date of dates) {
      if (isOperating(bp.operatingRule, date, holidaySet)) {
        totalOperatingBpDays++;
        const actual = assignedEmpIds.filter(
          (empId) => getEffectiveStatus(empId, date) === "WORKING"
        ).length;

        coverage.push({
          brandProcessId: bp.id,
          date,
          required: bp.minCoverage,
          actual,
        });

        if (actual >= bp.minCoverage) {
          operatingBpDaysNoGap++;
        }
      }
    }
  }

  const coveragePercent =
    totalOperatingBpDays === 0
      ? 100
      : Math.round((100 * operatingBpDaysNoGap) / totalOperatingBpDays);

  const errors = issues.filter((i) => i.severity === "ERROR").length;
  const warnings = issues.filter((i) => i.severity === "WARNING").length;
  const infos = issues.filter((i) => i.severity === "INFO").length;

  return {
    roster: {
      id: roster.id,
      year: roster.year,
      month: roster.month,
      status: roster.status,
      version: roster.version,
      updatedAt: roster.updatedAt,
    },
    entries,
    issues,
    coverage,
    meta: {
      employees: input.employees.map((e) => ({
        id: e.id,
        name: e.name,
        podId: e.podId,
      })),
      pods,
      brandProcesses: input.brandProcesses,
      assignments: input.assignments,
      holidays: input.holidays,
    },
    summary: {
      errors,
      warnings,
      infos,
      coveragePercent,
    },
  };
}
