import type { EngineInput, RosterEntry, Issue, DayStatus } from "./types";
import { monthDates, weekSegments, weekdayOf, isInRange } from "./dates";
import { isOperating } from "./generate";

export function validateRoster(
  input: EngineInput,
  entries: RosterEntry[],
): Issue[] {
  const issues: Issue[] = [];

  // Filter & index valid employees
  const validEmployees = [...input.employees].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const validEmpIds = new Set(validEmployees.map((e) => e.id));
  const empMap = new Map(validEmployees.map((e) => [e.id, e]));

  // Brand processes & assignments
  const brandProcesses = [...input.brandProcesses].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const bpMap = new Map(brandProcesses.map((bp) => [bp.id, bp]));

  const assignedEmployeesByBp = new Map<string, typeof validEmployees>();
  for (const bp of brandProcesses) {
    assignedEmployeesByBp.set(bp.id, []);
  }

  const sortedAssignments = [...input.assignments]
    .filter((a) => validEmpIds.has(a.employeeId) && bpMap.has(a.brandProcessId))
    .sort(
      (a, b) =>
        a.employeeId.localeCompare(b.employeeId) ||
        a.brandProcessId.localeCompare(b.brandProcessId),
    );

  for (const a of sortedAssignments) {
    const emp = empMap.get(a.employeeId);
    if (emp) {
      assignedEmployeesByBp.get(a.brandProcessId)?.push(emp);
    }
  }

  const holidays = [...input.holidays].sort();
  const holidaySet = new Set(holidays);

  const leaves = [...input.leaves]
    .filter((l) => validEmpIds.has(l.employeeId))
    .sort(
      (a, b) =>
        a.employeeId.localeCompare(b.employeeId) ||
        a.startDate.localeCompare(b.startDate),
    );

  const dates = monthDates(input.year, input.month);
  const segments = weekSegments(dates);

  // Index entries for valid employees: `${employeeId}:${date}` -> status
  const entryMap = new Map<string, DayStatus>();
  for (const entry of entries) {
    if (validEmpIds.has(entry.employeeId)) {
      entryMap.set(`${entry.employeeId}:${entry.date}`, entry.status);
    }
  }

  // Helper: compute effective status per employee and date
  // if a leave in input covers the date -> LEAVE/COMP_OFF regardless of the entry; else entry status (missing = WORKING).
  const getEffectiveStatus = (empId: string, date: string): DayStatus => {
    const leave = leaves.find(
      (l) => l.employeeId === empId && isInRange(date, l.startDate, l.endDate),
    );
    if (leave) {
      return leave.type;
    }
    return entryMap.get(`${empId}:${date}`) ?? "WORKING";
  };

  // 1. ENTRY_CONFLICTS_LEAVE
  // "entry status is WORKING (or WEEKOFF is fine, do not flag) but a leave covers the date. Message names the employee, date and leave type."
  for (const entry of entries) {
    if (!validEmpIds.has(entry.employeeId)) continue;
    if (entry.status === "WORKING") {
      const leave = leaves.find(
        (l) =>
          l.employeeId === entry.employeeId &&
          isInRange(entry.date, l.startDate, l.endDate),
      );
      if (leave) {
        const emp = empMap.get(entry.employeeId);
        issues.push({
          type: "ENTRY_CONFLICTS_LEAVE",
          severity: "ERROR",
          category: "MANDATORY",
          date: entry.date,
          employeeId: entry.employeeId,
          brandProcessId: null,
          message: `${emp ? emp.name : entry.employeeId} has a WORKING entry on ${entry.date} conflicting with ${leave.type}`,
        });
      }
    }
  }

  // 2. NO_ASSIGNEE & SINGLE_POINT_OF_FAILURE (once per brandProcess, date null)
  for (const bp of brandProcesses) {
    const assigned = assignedEmployeesByBp.get(bp.id) ?? [];
    if (assigned.length === 0) {
      issues.push({
        type: "NO_ASSIGNEE",
        severity: "ERROR",
        category: "MANDATORY",
        date: null,
        employeeId: null,
        brandProcessId: bp.id,
        message: `${bp.brandName} / ${bp.processCode} has no assigned employees`,
      });
    } else {
      // SINGLE_POINT_OF_FAILURE
      // "number of assigned employees <= minCoverage, i.e. any single absence on an operating day creates a gap. Skip when NO_ASSIGNEE."
      if (assigned.length <= bp.minCoverage) {
        issues.push({
          type: "SINGLE_POINT_OF_FAILURE",
          severity: "WARNING",
          category: "RISK",
          date: null,
          employeeId: null,
          brandProcessId: bp.id,
          message: `${bp.brandName} / ${bp.processCode} has ${assigned.length} assignee(s) for min coverage ${bp.minCoverage} (single point of failure)`,
        });
      }
    }
  }

  // 3. COVERAGE_GAP (per brandProcess + date)
  // "operating that day and number of assigned employees with effective status WORKING < minCoverage. Skip brandProcesses with no assignees (covered by NO_ASSIGNEE). details = required, actual, reasons (every assigned employee with their effective status)."
  for (const bp of brandProcesses) {
    const assigned = assignedEmployeesByBp.get(bp.id) ?? [];
    if (assigned.length === 0) continue; // Skip brandProcesses with no assignees

    for (const date of dates) {
      if (!isOperating(bp.operatingRule, date, holidaySet)) continue;

      const reasons = assigned.map((emp) => ({
        employeeId: emp.id,
        status: getEffectiveStatus(emp.id, date),
      }));

      const workingCount = reasons.filter((r) => r.status === "WORKING").length;

      if (workingCount < bp.minCoverage) {
        const reasonsStr = reasons
          .map(
            (r) =>
              `${empMap.get(r.employeeId)?.name || r.employeeId}: ${r.status}`,
          )
          .join(", ");
        issues.push({
          type: "COVERAGE_GAP",
          severity: "ERROR",
          category: "MANDATORY",
          date,
          employeeId: null,
          brandProcessId: bp.id,
          message: `${bp.brandName} / ${bp.processCode} needs ${bp.minCoverage} on ${date}, ${workingCount} available (${reasonsStr})`,
          details: {
            required: bp.minCoverage,
            actual: workingCount,
            reasons,
          },
        });
      }
    }
  }

  // 4. WEEKLY_OFF_MISSING (employee + first date of segment)
  // "segment >= 4 days where the employee has no non-WORKING effective day."
  for (const emp of validEmployees) {
    for (const segment of segments) {
      if (segment.length >= 4) {
        const hasNonWorking = segment.some(
          (date) => getEffectiveStatus(emp.id, date) !== "WORKING",
        );
        if (!hasNonWorking) {
          issues.push({
            type: "WEEKLY_OFF_MISSING",
            severity: "ERROR",
            category: "MANDATORY",
            date: segment[0],
            employeeId: emp.id,
            brandProcessId: null,
            message: `${emp.name} has no weekly off in week starting ${segment[0]}`,
          });
        }
      }
    }
  }

  // 5. PREFERENCE_NOT_MET (once per employee)
  // "employee has preferredOffDay and in at least one week segment has an off day but none on that weekday. Message states how many weeks."
  for (const emp of validEmployees) {
    if (emp.preferredOffDay !== null) {
      let unmetWeeks = 0;
      for (const segment of segments) {
        const offDates = segment.filter(
          (date) => getEffectiveStatus(emp.id, date) !== "WORKING",
        );
        if (offDates.length > 0) {
          const hasPreferredOffDay = offDates.some(
            (date) => weekdayOf(date) === emp.preferredOffDay,
          );
          if (!hasPreferredOffDay) {
            unmetWeeks++;
          }
        }
      }
      if (unmetWeeks > 0) {
        issues.push({
          type: "PREFERENCE_NOT_MET",
          severity: "INFO",
          category: "PREFERENCE",
          date: null,
          employeeId: emp.id,
          brandProcessId: null,
          message: `${emp.name} preferred weekly off not met in ${unmetWeeks} week(s)`,
        });
      }
    }
  }

  // Sort issues: severity (ERROR first), then date, then brandProcessId
  const severityOrder: Record<Issue["severity"], number> = {
    ERROR: 0,
    WARNING: 1,
    INFO: 2,
  };

  issues.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;

    const dateA = a.date ?? "";
    const dateB = b.date ?? "";
    const dateDiff = dateA.localeCompare(dateB);
    if (dateDiff !== 0) return dateDiff;

    const bpA = a.brandProcessId ?? "";
    const bpB = b.brandProcessId ?? "";
    const bpDiff = bpA.localeCompare(bpB);
    if (bpDiff !== 0) return bpDiff;

    const empA = a.employeeId ?? "";
    const empB = b.employeeId ?? "";
    const empDiff = empA.localeCompare(empB);
    if (empDiff !== 0) return empDiff;

    return a.type.localeCompare(b.type);
  });

  return issues;
}
