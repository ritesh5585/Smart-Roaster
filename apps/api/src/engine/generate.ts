import type {
  EngineInput,
  RosterEntry,
  Issue,
  OperatingRule,
  DayStatus,
} from "./types";
import { monthDates, weekSegments, weekdayOf, isInRange } from "./dates";
import { validateRoster } from "./validate";

export function isOperating(
  rule: OperatingRule,
  date: string,
  holidaySet: Set<string>,
): boolean {
  if (rule === "ALL_365") return true;
  if (rule === "EXCEPT_HOLIDAYS") return !holidaySet.has(date);
  if (rule === "NO_SUN_HOLIDAYS")
    return weekdayOf(date) !== 0 && !holidaySet.has(date);
  return true;
}

export function generateRoster(input: EngineInput): {
  entries: RosterEntry[];
  issues: Issue[];
} {
  // Deterministic sorting of inputs
  const employees = [...input.employees].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const validEmpIds = new Set(employees.map((e) => e.id));

  const brandProcesses = [...input.brandProcesses].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const bpMap = new Map(brandProcesses.map((bp) => [bp.id, bp]));

  // Assigned brand-processes per employee
  const assignedBpsByEmployee = new Map<string, typeof brandProcesses>();
  for (const emp of employees) {
    assignedBpsByEmployee.set(emp.id, []);
  }

  const sortedAssignments = [...input.assignments]
    .filter((a) => validEmpIds.has(a.employeeId) && bpMap.has(a.brandProcessId))
    .sort(
      (a, b) =>
        a.employeeId.localeCompare(b.employeeId) ||
        a.brandProcessId.localeCompare(b.brandProcessId),
    );

  for (const a of sortedAssignments) {
    const bp = bpMap.get(a.brandProcessId);
    if (bp) {
      assignedBpsByEmployee.get(a.employeeId)?.push(bp);
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

  // Step 1: Hard statuses per employee/date
  // inside a leave range -> "LEAVE" or "COMP_OFF" (by leave type).
  // Else if none of the employee's assigned brand-processes operate that date -> "HOLIDAY" if the date is a holiday, otherwise "WEEKOFF".
  // Employees with zero assignments: "HOLIDAY" on holidays, else "WORKING".
  // Everything else is tentatively "WORKING".
  const statusMap = new Map<string, DayStatus>();

  for (const emp of employees) {
    const assignedBps = assignedBpsByEmployee.get(emp.id) ?? [];

    for (const date of dates) {
      const key = `${emp.id}:${date}`;
      const leave = leaves.find(
        (l) =>
          l.employeeId === emp.id && isInRange(date, l.startDate, l.endDate),
      );

      if (leave) {
        statusMap.set(key, leave.type);
      } else if (assignedBps.length === 0) {
        if (holidaySet.has(date)) {
          statusMap.set(key, "HOLIDAY");
        } else {
          statusMap.set(key, "WORKING");
        }
      } else {
        const anyOperates = assignedBps.some((bp) =>
          isOperating(bp.operatingRule, date, holidaySet),
        );
        if (!anyOperates) {
          if (holidaySet.has(date)) {
            statusMap.set(key, "HOLIDAY");
          } else {
            statusMap.set(key, "WEEKOFF");
          }
        } else {
          statusMap.set(key, "WORKING");
        }
      }
    }
  }

  // Step 2: Coverage counts: for each (brandProcess, date) where operating, count assigned employees currently "WORKING"
  const coverageCounts = new Map<string, number>();

  for (const bp of brandProcesses) {
    for (const date of dates) {
      if (isOperating(bp.operatingRule, date, holidaySet)) {
        let count = 0;
        for (const emp of employees) {
          const isAssigned = sortedAssignments.some(
            (a) => a.employeeId === emp.id && a.brandProcessId === bp.id,
          );
          if (isAssigned && statusMap.get(`${emp.id}:${date}`) === "WORKING") {
            count++;
          }
        }
        coverageCounts.set(`${bp.id}:${date}`, count);
      }
    }
  }

  // Step 3: A week segment with >= 4 days needs a weekly off.
  // It is already satisfied if the employee has ANY non-WORKING day in it (any reason).
  // Collect unsatisfied (employee, segment) needs.
  interface OffNeed {
    employee: (typeof employees)[number];
    segment: string[];
    feasibleCount: number;
  }

  const needs: OffNeed[] = [];

  for (const emp of employees) {
    const assignedBps = assignedBpsByEmployee.get(emp.id) ?? [];

    for (const segment of segments) {
      if (segment.length >= 4) {
        const hasNonWorking = segment.some(
          (date) => statusMap.get(`${emp.id}:${date}`) !== "WORKING",
        );
        if (!hasNonWorking) {
          // Count initial feasible days in segment
          let feasibleCount = 0;
          for (const date of segment) {
            const opBps = assignedBps.filter((bp) =>
              isOperating(bp.operatingRule, date, holidaySet),
            );
            const isFeasible = opBps.every((bp) => {
              const current = coverageCounts.get(`${bp.id}:${date}`) ?? 0;
              return current - 1 >= bp.minCoverage;
            });
            if (isFeasible) {
              feasibleCount++;
            }
          }

          needs.push({
            employee: emp,
            segment,
            feasibleCount,
          });
        }
      }
    }
  }

  // Step 4: Place weekly offs greedily.
  // Order needs by number of feasible days ascending, then by employeeId, then segment start.
  needs.sort((a, b) => {
    const diff = a.feasibleCount - b.feasibleCount;
    if (diff !== 0) return diff;
    const empDiff = a.employee.id.localeCompare(b.employee.id);
    if (empDiff !== 0) return empDiff;
    return a.segment[0].localeCompare(b.segment[0]);
  });

  for (const need of needs) {
    const emp = need.employee;
    const assignedBps = assignedBpsByEmployee.get(emp.id) ?? [];

    // Candidate days = days in the segment where the employee is "WORKING"
    const candidateDays = need.segment.filter(
      (date) => statusMap.get(`${emp.id}:${date}`) === "WORKING",
    );
    if (candidateDays.length === 0) continue;

    interface DayEvaluation {
      date: string;
      isFeasible: boolean;
      slack: number;
      pushedBelowCount: number;
    }

    const evaluations: DayEvaluation[] = [];

    for (const date of candidateDays) {
      const opBps = assignedBps.filter((bp) =>
        isOperating(bp.operatingRule, date, holidaySet),
      );

      if (opBps.length === 0) {
        evaluations.push({
          date,
          isFeasible: true,
          slack: Number.MAX_SAFE_INTEGER,
          pushedBelowCount: 0,
        });
      } else {
        let pushedBelow = 0;
        let minSlack = Number.MAX_SAFE_INTEGER;

        for (const bp of opBps) {
          const current = coverageCounts.get(`${bp.id}:${date}`) ?? 0;
          const s = current - 1 - bp.minCoverage;
          if (s < minSlack) minSlack = s;
          if (current - 1 < bp.minCoverage) {
            pushedBelow++;
          }
        }

        evaluations.push({
          date,
          isFeasible: pushedBelow === 0,
          slack: minSlack,
          pushedBelowCount: pushedBelow,
        });
      }
    }

    const feasibleDays = evaluations.filter((e) => e.isFeasible);
    let chosenDate: string;

    if (feasibleDays.length > 0) {
      // a) among feasible days: preferredOffDay weekday if present, else highest slack, tie -> earliest date
      let prefMatch: DayEvaluation | undefined;
      if (emp.preferredOffDay !== null) {
        prefMatch = feasibleDays.find(
          (e) => weekdayOf(e.date) === emp.preferredOffDay,
        );
      }

      if (prefMatch) {
        chosenDate = prefMatch.date;
      } else {
        feasibleDays.sort((a, b) => {
          const slackDiff = b.slack - a.slack;
          if (slackDiff !== 0) return slackDiff;
          return a.date.localeCompare(b.date);
        });
        chosenDate = feasibleDays[0].date;
      }
    } else {
      // b) if no feasible day: fewest brand-processes pushed below minCoverage, then highest slack, then earliest date
      evaluations.sort((a, b) => {
        const belowDiff = a.pushedBelowCount - b.pushedBelowCount;
        if (belowDiff !== 0) return belowDiff;
        const slackDiff = b.slack - a.slack;
        if (slackDiff !== 0) return slackDiff;
        return a.date.localeCompare(b.date);
      });
      chosenDate = evaluations[0].date;
    }

    // Set status "WEEKOFF" and decrement the affected coverage counts
    statusMap.set(`${emp.id}:${chosenDate}`, "WEEKOFF");

    const affectedOpBps = assignedBps.filter((bp) =>
      isOperating(bp.operatingRule, chosenDate, holidaySet),
    );
    for (const bp of affectedOpBps) {
      const current = coverageCounts.get(`${bp.id}:${chosenDate}`) ?? 0;
      coverageCounts.set(`${bp.id}:${chosenDate}`, current - 1);
    }
  }

  // Construct entries
  const entries: RosterEntry[] = [];
  for (const emp of employees) {
    for (const date of dates) {
      entries.push({
        employeeId: emp.id,
        date,
        status: statusMap.get(`${emp.id}:${date}`)!,
        source: "AUTO",
      });
    }
  }

  // Step 5: Run validateRoster on the result and return its issues
  const issues = validateRoster(input, entries);

  return { entries, issues };
}
