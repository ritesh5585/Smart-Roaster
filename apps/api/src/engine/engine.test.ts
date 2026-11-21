import { describe, it, expect } from "vitest";
import type { EngineInput, RosterEntry, Issue } from "./types";
import { monthDates, weekSegments, weekdayOf } from "./dates";
import { generateRoster } from "./generate";
import { validateRoster } from "./validate";
import { suggestBackups } from "./suggest";

function createFixture(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    year: 2026,
    month: 12,
    employees: [],
    brandProcesses: [],
    assignments: [],
    holidays: [],
    leaves: [],
    ...overrides,
  };
}

describe("Roster Engine", () => {
  // 1. Single employee, ALL_365, minCoverage 1: output has a COVERAGE_GAP on their weekly-off day,
  // with the employee in details.reasons as WEEKOFF, and a SINGLE_POINT_OF_FAILURE warning.
  it("1. Single employee, ALL_365, minCoverage 1: has COVERAGE_GAP on weekly off and SINGLE_POINT_OF_FAILURE", () => {
    const input = createFixture({
      employees: [{ id: "emp1", name: "Rahul", podId: null, preferredOffDay: null }],
      brandProcesses: [
        {
          id: "bp1",
          brandName: "Nike",
          processCode: "CS",
          operatingRule: "ALL_365",
          minCoverage: 1,
        },
      ],
      assignments: [{ employeeId: "emp1", brandProcessId: "bp1" }],
    });

    const { entries, issues } = generateRoster(input);

    const offEntries = entries.filter((e) => e.status === "WEEKOFF");
    expect(offEntries.length).toBeGreaterThan(0);

    const firstOff = offEntries[0];
    const gapOnFirstOff = issues.find(
      (i) => i.type === "COVERAGE_GAP" && i.date === firstOff.date && i.brandProcessId === "bp1"
    );
    expect(gapOnFirstOff).toBeDefined();
    expect(gapOnFirstOff?.details?.reasons).toEqual([
      { employeeId: "emp1", status: "WEEKOFF" },
    ]);

    const spof = issues.find(
      (i) => i.type === "SINGLE_POINT_OF_FAILURE" && i.brandProcessId === "bp1"
    );
    expect(spof).toBeDefined();
    expect(spof?.severity).toBe("WARNING");
  });

  // 2. Two employees on one brand-process, min 1, ALL_365: no COVERAGE_GAP anywhere;
  // their weekly offs never fall on the same day in a week.
  it("2. Two employees on one brand-process, min 1, ALL_365: no COVERAGE_GAP anywhere, offs don't clash", () => {
    const input = createFixture({
      employees: [
        { id: "emp1", name: "Alice", podId: null, preferredOffDay: null },
        { id: "emp2", name: "Bob", podId: null, preferredOffDay: null },
      ],
      brandProcesses: [
        {
          id: "bp1",
          brandName: "Adidas",
          processCode: "CS",
          operatingRule: "ALL_365",
          minCoverage: 1,
        },
      ],
      assignments: [
        { employeeId: "emp1", brandProcessId: "bp1" },
        { employeeId: "emp2", brandProcessId: "bp1" },
      ],
    });

    const { entries, issues } = generateRoster(input);

    const gaps = issues.filter((i) => i.type === "COVERAGE_GAP");
    expect(gaps).toHaveLength(0);

    const dates = monthDates(2026, 12);
    const segments = weekSegments(dates);

    for (const segment of segments) {
      const emp1Offs = entries.filter(
        (e) => e.employeeId === "emp1" && e.status === "WEEKOFF" && segment.includes(e.date)
      );
      const emp2Offs = entries.filter(
        (e) => e.employeeId === "emp2" && e.status === "WEEKOFF" && segment.includes(e.date)
      );

      for (const off1 of emp1Offs) {
        for (const off2 of emp2Offs) {
          expect(off1.date).not.toBe(off2.date);
        }
      }
    }
  });

  // 3. Sole employee has a leave on a required day: COVERAGE_GAP with reason LEAVE on exactly those days.
  it("3. Sole employee has a leave on a required day: COVERAGE_GAP with reason LEAVE on exactly those days", () => {
    const input = createFixture({
      employees: [{ id: "emp1", name: "Rahul", podId: null, preferredOffDay: null }],
      brandProcesses: [
        {
          id: "bp1",
          brandName: "Nike",
          processCode: "CS",
          operatingRule: "ALL_365",
          minCoverage: 1,
        },
      ],
      assignments: [{ employeeId: "emp1", brandProcessId: "bp1" }],
      leaves: [
        {
          employeeId: "emp1",
          startDate: "2026-12-08",
          endDate: "2026-12-09",
          type: "LEAVE",
        },
      ],
    });

    const { entries, issues } = generateRoster(input);

    for (const date of ["2026-12-08", "2026-12-09"]) {
      const entry = entries.find((e) => e.employeeId === "emp1" && e.date === date);
      expect(entry?.status).toBe("LEAVE");

      const gap = issues.find(
        (i) => i.type === "COVERAGE_GAP" && i.date === date && i.brandProcessId === "bp1"
      );
      expect(gap).toBeDefined();
      expect(gap?.details?.reasons).toEqual([{ employeeId: "emp1", status: "LEAVE" }]);
    }
  });

  // 4. NO_SUN_HOLIDAYS brand: no gap on Sundays, employee's Sundays are WEEKOFF, no WEEKLY_OFF_MISSING.
  it("4. NO_SUN_HOLIDAYS brand: no gap on Sundays, employee's Sundays are WEEKOFF, no WEEKLY_OFF_MISSING", () => {
    const input = createFixture({
      employees: [{ id: "emp1", name: "Rahul", podId: null, preferredOffDay: null }],
      brandProcesses: [
        {
          id: "bp1",
          brandName: "Puma",
          processCode: "RET",
          operatingRule: "NO_SUN_HOLIDAYS",
          minCoverage: 1,
        },
      ],
      assignments: [{ employeeId: "emp1", brandProcessId: "bp1" }],
    });

    const { entries, issues } = generateRoster(input);

    const sundays = monthDates(2026, 12).filter((d) => weekdayOf(d) === 0);
    expect(sundays.length).toBeGreaterThan(0);

    for (const sunday of sundays) {
      const entry = entries.find((e) => e.employeeId === "emp1" && e.date === sunday);
      expect(entry?.status).toBe("WEEKOFF");

      const sundayGap = issues.find((i) => i.type === "COVERAGE_GAP" && i.date === sunday);
      expect(sundayGap).toBeUndefined();
    }

    const missingWeeklyOff = issues.find((i) => i.type === "WEEKLY_OFF_MISSING");
    expect(missingWeeklyOff).toBeUndefined();
  });

  // 5. EXCEPT_HOLIDAYS employee on a holiday: status HOLIDAY, no gap. ALL_365 employee on a holiday: stays WORKING.
  it("5. EXCEPT_HOLIDAYS employee on a holiday: status HOLIDAY, no gap. ALL_365 employee stays WORKING", () => {
    const holidayDate = "2026-12-25";
    const input = createFixture({
      employees: [
        { id: "emp1", name: "Alice", podId: null, preferredOffDay: null },
        { id: "emp2", name: "Bob", podId: null, preferredOffDay: null },
      ],
      brandProcesses: [
        {
          id: "bp1",
          brandName: "Puma",
          processCode: "CS",
          operatingRule: "EXCEPT_HOLIDAYS",
          minCoverage: 1,
        },
        {
          id: "bp2",
          brandName: "Nike",
          processCode: "ACC",
          operatingRule: "ALL_365",
          minCoverage: 1,
        },
      ],
      assignments: [
        { employeeId: "emp1", brandProcessId: "bp1" },
        { employeeId: "emp2", brandProcessId: "bp2" },
      ],
      holidays: [holidayDate],
    });

    const { entries, issues } = generateRoster(input);

    const emp1Holiday = entries.find((e) => e.employeeId === "emp1" && e.date === holidayDate);
    expect(emp1Holiday?.status).toBe("HOLIDAY");

    const bp1HolidayGap = issues.find(
      (i) => i.type === "COVERAGE_GAP" && i.brandProcessId === "bp1" && i.date === holidayDate
    );
    expect(bp1HolidayGap).toBeUndefined();

    const emp2Holiday = entries.find((e) => e.employeeId === "emp2" && e.date === holidayDate);
    expect(emp2Holiday?.status).toBe("WORKING");
  });

  // 6. minCoverage 2 with exactly 2 employees: weekly offs create gaps and they are reported.
  it("6. minCoverage 2 with exactly 2 employees: weekly offs create gaps and they are reported", () => {
    const input = createFixture({
      employees: [
        { id: "emp1", name: "Alice", podId: null, preferredOffDay: null },
        { id: "emp2", name: "Bob", podId: null, preferredOffDay: null },
      ],
      brandProcesses: [
        {
          id: "bp1",
          brandName: "Reebok",
          processCode: "CS",
          operatingRule: "ALL_365",
          minCoverage: 2,
        },
      ],
      assignments: [
        { employeeId: "emp1", brandProcessId: "bp1" },
        { employeeId: "emp2", brandProcessId: "bp1" },
      ],
    });

    const { entries, issues } = generateRoster(input);

    const offEntries = entries.filter((e) => e.status === "WEEKOFF");
    expect(offEntries.length).toBeGreaterThan(0);

    for (const off of offEntries) {
      const gap = issues.find(
        (i) => i.type === "COVERAGE_GAP" && i.brandProcessId === "bp1" && i.date === off.date
      );
      expect(gap).toBeDefined();
      expect(gap?.details?.actual).toBe(1);
      expect(gap?.details?.required).toBe(2);
    }
  });

  // 7. Preference honoured when feasible (2 employees, preferred weekday respected) and
  // ignored when it would break coverage (single-employee ALL_365 case), with PREFERENCE_NOT_MET reported.
  it("7. Preference honoured when feasible and ignored when breaking coverage, reporting PREFERENCE_NOT_MET", () => {
    // 7a. Feasible preference: 2 employees, min 1. emp1 prefers Wednesday (3)
    const inputFeasible = createFixture({
      employees: [
        { id: "emp1", name: "Alice", podId: null, preferredOffDay: 3 }, // Wednesday
        { id: "emp2", name: "Bob", podId: null, preferredOffDay: null },
      ],
      brandProcesses: [
        {
          id: "bp1",
          brandName: "Nike",
          processCode: "CS",
          operatingRule: "ALL_365",
          minCoverage: 1,
        },
      ],
      assignments: [
        { employeeId: "emp1", brandProcessId: "bp1" },
        { employeeId: "emp2", brandProcessId: "bp1" },
      ],
    });

    const resFeasible = generateRoster(inputFeasible);
    const emp1PrefIssue = resFeasible.issues.find(
      (i) => i.type === "PREFERENCE_NOT_MET" && i.employeeId === "emp1"
    );
    expect(emp1PrefIssue).toBeUndefined();

    // Check segment 1 (Dec 01 - Dec 06): Dec 02 is Wednesday
    const emp1Wed = resFeasible.entries.find(
      (e) => e.employeeId === "emp1" && e.date === "2026-12-02"
    );
    expect(emp1Wed?.status).toBe("WEEKOFF");

    // 7b. Infeasible preference: single employee ALL_365, prefers Friday (5)
    const inputInfeasible = createFixture({
      employees: [{ id: "emp1", name: "Alice", podId: null, preferredOffDay: 5 }],
      brandProcesses: [
        {
          id: "bp1",
          brandName: "Nike",
          processCode: "CS",
          operatingRule: "ALL_365",
          minCoverage: 1,
        },
      ],
      assignments: [{ employeeId: "emp1", brandProcessId: "bp1" }],
    });

    const resInfeasible = generateRoster(inputInfeasible);
    const prefNotMet = resInfeasible.issues.find(
      (i) => i.type === "PREFERENCE_NOT_MET" && i.employeeId === "emp1"
    );
    expect(prefNotMet).toBeDefined();
    expect(prefNotMet?.severity).toBe("INFO");
    expect(prefNotMet?.category).toBe("PREFERENCE");
  });

  // 8. Brand-process with no assignees: one NO_ASSIGNEE, no per-day gaps.
  it("8. Brand-process with no assignees: one NO_ASSIGNEE, no per-day gaps", () => {
    const input = createFixture({
      employees: [],
      brandProcesses: [
        {
          id: "bp1",
          brandName: "Nike",
          processCode: "CS",
          operatingRule: "ALL_365",
          minCoverage: 1,
        },
      ],
      assignments: [],
    });

    const { issues } = generateRoster(input);

    const noAssignee = issues.filter((i) => i.type === "NO_ASSIGNEE");
    expect(noAssignee).toHaveLength(1);
    expect(noAssignee[0].brandProcessId).toBe("bp1");
    expect(noAssignee[0].date).toBeNull();

    const gaps = issues.filter((i) => i.type === "COVERAGE_GAP");
    expect(gaps).toHaveLength(0);
  });

  // 9. Change handling: generate a clean roster, then add a leave for the sole employee of a required day
  // to the input WITHOUT regenerating: validateRoster reports ENTRY_CONFLICTS_LEAVE and COVERAGE_GAP for that day.
  it("9. Change handling: add leave to clean roster -> reports ENTRY_CONFLICTS_LEAVE and COVERAGE_GAP", () => {
    const input = createFixture({
      employees: [
        { id: "emp1", name: "Alice", podId: null, preferredOffDay: null },
        { id: "emp2", name: "Bob", podId: null, preferredOffDay: null },
      ],
      brandProcesses: [
        {
          id: "bp1",
          brandName: "Nike",
          processCode: "CS",
          operatingRule: "ALL_365",
          minCoverage: 1,
        },
      ],
      assignments: [
        { employeeId: "emp1", brandProcessId: "bp1" },
        { employeeId: "emp2", brandProcessId: "bp1" },
      ],
    });

    const { entries } = generateRoster(input);

    // Find a date where emp1 is WEEKOFF, meaning emp2 is the sole working employee
    const emp1OffEntry = entries.find((e) => e.employeeId === "emp1" && e.status === "WEEKOFF");
    expect(emp1OffEntry).toBeDefined();
    const targetDate = emp1OffEntry!.date;

    // Verify emp2 was WORKING on targetDate
    const emp2Entry = entries.find((e) => e.employeeId === "emp2" && e.date === targetDate);
    expect(emp2Entry?.status).toBe("WORKING");

    // Add leave for emp2 without regenerating entries
    const modifiedInput: EngineInput = {
      ...input,
      leaves: [
        {
          employeeId: "emp2",
          startDate: targetDate,
          endDate: targetDate,
          type: "LEAVE",
        },
      ],
    };

    const validatedIssues = validateRoster(modifiedInput, entries);

    const conflict = validatedIssues.find(
      (i) => i.type === "ENTRY_CONFLICTS_LEAVE" && i.employeeId === "emp2" && i.date === targetDate
    );
    expect(conflict).toBeDefined();

    const gap = validatedIssues.find(
      (i) => i.type === "COVERAGE_GAP" && i.brandProcessId === "bp1" && i.date === targetDate
    );
    expect(gap).toBeDefined();
  });

  // 10. Manual edit: flip one WORKING entry of one of two employees to WEEKOFF on a day when
  // the other is already off -> gap appears; flip back -> gap disappears.
  it("10. Manual edit: flip WORKING to WEEKOFF creates gap; flip back removes gap", () => {
    const input = createFixture({
      employees: [
        { id: "emp1", name: "Alice", podId: null, preferredOffDay: null },
        { id: "emp2", name: "Bob", podId: null, preferredOffDay: null },
      ],
      brandProcesses: [
        {
          id: "bp1",
          brandName: "Nike",
          processCode: "CS",
          operatingRule: "ALL_365",
          minCoverage: 1,
        },
      ],
      assignments: [
        { employeeId: "emp1", brandProcessId: "bp1" },
        { employeeId: "emp2", brandProcessId: "bp1" },
      ],
    });

    const { entries } = generateRoster(input);

    const emp1Off = entries.find((e) => e.employeeId === "emp1" && e.status === "WEEKOFF")!;
    const targetDate = emp1Off.date;

    // Initial validation has no gap
    const initialIssues = validateRoster(input, entries);
    expect(initialIssues.filter((i) => i.type === "COVERAGE_GAP" && i.date === targetDate)).toHaveLength(0);

    // Flip emp2 to WEEKOFF
    const modifiedEntries: RosterEntry[] = entries.map((e) =>
      e.employeeId === "emp2" && e.date === targetDate ? { ...e, status: "WEEKOFF", source: "MANUAL" } : e
    );

    const gapIssues = validateRoster(input, modifiedEntries);
    const gap = gapIssues.find((i) => i.type === "COVERAGE_GAP" && i.date === targetDate);
    expect(gap).toBeDefined();

    // Flip emp2 back to WORKING
    const revertedEntries: RosterEntry[] = entries.map((e) =>
      e.employeeId === "emp2" && e.date === targetDate ? { ...e, status: "WORKING", source: "MANUAL" } : e
    );

    const revertedIssues = validateRoster(input, revertedEntries);
    expect(revertedIssues.filter((i) => i.type === "COVERAGE_GAP" && i.date === targetDate)).toHaveLength(0);
  });

  // 11. suggestBackups: for a gap, a same-processCode, same-pod WORKING employee ranks first;
  // a LEAVE employee is never suggested.
  it("11. suggestBackups: same-processCode, same-pod WORKING employee ranks first; LEAVE employee never suggested", () => {
    const gapDate = "2026-12-06";
    const input = createFixture({
      employees: [
        { id: "emp1", name: "Alice", podId: "pod-1", preferredOffDay: null }, // assigned to BP1
        { id: "emp2", name: "Bob", podId: "pod-1", preferredOffDay: null }, // same process, same pod, WORKING
        { id: "emp3", name: "Charlie", podId: "pod-1", preferredOffDay: null }, // on LEAVE
        { id: "emp4", name: "Diana", podId: "pod-2", preferredOffDay: null }, // different process, WEEKOFF
      ],
      brandProcesses: [
        { id: "bp1", brandName: "Nike", processCode: "CS", operatingRule: "ALL_365", minCoverage: 1 },
        { id: "bp2", brandName: "Puma", processCode: "CS", operatingRule: "ALL_365", minCoverage: 1 },
        { id: "bp3", brandName: "Vans", processCode: "ACC", operatingRule: "ALL_365", minCoverage: 1 },
      ],
      assignments: [
        { employeeId: "emp1", brandProcessId: "bp1" },
        { employeeId: "emp2", brandProcessId: "bp2" },
        { employeeId: "emp4", brandProcessId: "bp3" },
      ],
      leaves: [
        { employeeId: "emp3", startDate: gapDate, endDate: gapDate, type: "LEAVE" },
      ],
    });

    const entries: RosterEntry[] = [
      { employeeId: "emp1", date: gapDate, status: "WEEKOFF", source: "AUTO" },
      { employeeId: "emp2", date: gapDate, status: "WORKING", source: "AUTO" },
      { employeeId: "emp3", date: gapDate, status: "LEAVE", source: "AUTO" },
      { employeeId: "emp4", date: gapDate, status: "WEEKOFF", source: "AUTO" },
    ];

    const issue: Issue = {
      type: "COVERAGE_GAP",
      severity: "ERROR",
      category: "MANDATORY",
      date: gapDate,
      employeeId: null,
      brandProcessId: "bp1",
      message: "Nike / CS needs 1 on 2026-12-06, 0 available",
    };

    const suggestions = suggestBackups(input, entries, issue);

    expect(suggestions.length).toBeGreaterThan(0);
    // Bob ranks first: same process (+2), same pod (+1), WORKING (+1)
    expect(suggestions[0].employeeId).toBe("emp2");
    expect(suggestions[0].kind).toBe("CROSS_COVER");

    // Charlie (LEAVE) is never suggested
    expect(suggestions.some((s) => s.employeeId === "emp3")).toBe(false);
  });

  // 12. Determinism: generateRoster twice with the same input gives deep-equal output.
  // Also February 2027 (28 days) and a month starting mid-week produce exactly one entry per employee per date.
  it("12. Determinism and date coverage: same input produces deep-equal output; Feb 2027 produces 28 days", () => {
    const input = createFixture({
      year: 2026,
      month: 12,
      employees: [
        { id: "emp2", name: "Bob", podId: null, preferredOffDay: 0 },
        { id: "emp1", name: "Alice", podId: null, preferredOffDay: 3 },
      ],
      brandProcesses: [
        { id: "bp1", brandName: "Nike", processCode: "CS", operatingRule: "ALL_365", minCoverage: 1 },
      ],
      assignments: [
        { employeeId: "emp2", brandProcessId: "bp1" },
        { employeeId: "emp1", brandProcessId: "bp1" },
      ],
    });

    const run1 = generateRoster(input);
    const run2 = generateRoster(input);

    expect(run1).toEqual(run2);

    // December 2026 starts on Tuesday (mid-week) and has 31 days
    expect(run1.entries).toHaveLength(31 * 2);

    // February 2027 has 28 days
    const febInput = createFixture({
      year: 2027,
      month: 2,
      employees: [
        { id: "emp1", name: "Alice", podId: null, preferredOffDay: null },
        { id: "emp2", name: "Bob", podId: null, preferredOffDay: null },
      ],
      brandProcesses: [
        { id: "bp1", brandName: "Nike", processCode: "CS", operatingRule: "ALL_365", minCoverage: 1 },
      ],
      assignments: [
        { employeeId: "emp1", brandProcessId: "bp1" },
        { employeeId: "emp2", brandProcessId: "bp1" },
      ],
    });

    const febRun = generateRoster(febInput);
    expect(febRun.entries).toHaveLength(28 * 2);

    // Exactly one entry per employee per date
    const febDates = monthDates(2027, 2);
    expect(febDates).toHaveLength(28);

    for (const emp of febInput.employees) {
      for (const d of febDates) {
        const matching = febRun.entries.filter((e) => e.employeeId === emp.id && e.date === d);
        expect(matching).toHaveLength(1);
      }
    }
  });
});
