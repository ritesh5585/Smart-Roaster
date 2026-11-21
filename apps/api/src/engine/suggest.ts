import type { EngineInput, RosterEntry, Issue, Suggestion, DayStatus } from "./types";
import { isInRange } from "./dates";

export function suggestBackups(
  input: EngineInput,
  entries: RosterEntry[],
  issue: Issue
): Suggestion[] {
  if (issue.type !== "COVERAGE_GAP" || !issue.date || !issue.brandProcessId) {
    return [];
  }

  const gapDate = issue.date;
  const targetBpId = issue.brandProcessId;
  const targetBp = input.brandProcesses.find((bp) => bp.id === targetBpId);
  if (!targetBp) return [];

  // Index valid employees
  const validEmployees = [...input.employees].sort((a, b) => a.id.localeCompare(b.id));
  const validEmpIds = new Set(validEmployees.map((e) => e.id));

  // Assigned employees to target brandProcess
  const assignedToTarget = new Set(
    input.assignments
      .filter((a) => a.brandProcessId === targetBpId && validEmpIds.has(a.employeeId))
      .map((a) => a.employeeId)
  );

  // Pods of assigned employees
  const assignedPods = new Set(
    validEmployees
      .filter((e) => assignedToTarget.has(e.id) && e.podId !== null)
      .map((e) => e.podId!)
  );

  // Assignments for each employee
  const bpMap = new Map(input.brandProcesses.map((bp) => [bp.id, bp]));
  const empAssignedBps = new Map<string, typeof input.brandProcesses>();
  for (const emp of validEmployees) {
    empAssignedBps.set(emp.id, []);
  }
  for (const a of input.assignments) {
    if (validEmpIds.has(a.employeeId) && bpMap.has(a.brandProcessId)) {
      empAssignedBps.get(a.employeeId)?.push(bpMap.get(a.brandProcessId)!);
    }
  }

  // Leaves
  const leaves = input.leaves.filter((l) => validEmpIds.has(l.employeeId));

  // Entries map
  const entryMap = new Map<string, DayStatus>();
  for (const entry of entries) {
    if (validEmpIds.has(entry.employeeId)) {
      entryMap.set(`${entry.employeeId}:${entry.date}`, entry.status);
    }
  }

  const getEffectiveStatus = (empId: string, date: string): DayStatus => {
    const leave = leaves.find((l) => l.employeeId === empId && isInRange(date, l.startDate, l.endDate));
    if (leave) {
      return leave.type;
    }
    return entryMap.get(`${empId}:${date}`) ?? "WORKING";
  };

  // Candidates: employees NOT assigned to issue.brandProcessId
  const candidates = validEmployees.filter((emp) => !assignedToTarget.has(emp.id));

  const suggestions: Suggestion[] = [];

  for (const candidate of candidates) {
    const status = getEffectiveStatus(candidate.id, gapDate);
    // Exclude LEAVE, COMP_OFF, HOLIDAY
    if (status !== "WORKING" && status !== "WEEKOFF") {
      continue;
    }

    const kind: Suggestion["kind"] = status === "WORKING" ? "CROSS_COVER" : "SWAP_WEEKOFF";

    let score = 0;
    const reasons: string[] = [];

    // CROSS_COVER +1 over SWAP_WEEKOFF
    if (kind === "CROSS_COVER") {
      score += 1;
      reasons.push("Working today (cross-cover)");
    } else {
      reasons.push("On weekly off (can swap)");
    }

    const candidateBps = empAssignedBps.get(candidate.id) ?? [];

    // +2 if the employee is assigned to any brand-process with the same processCode
    const hasSameProcess = candidateBps.some((bp) => bp.processCode === targetBp.processCode);
    if (hasSameProcess) {
      score += 2;
      reasons.push(`same process (${targetBp.processCode})`);
    }

    // +1 if same podId as any employee assigned to the gap's brand-process
    const hasSamePod = candidate.podId !== null && assignedPods.has(candidate.podId);
    if (hasSamePod) {
      score += 1;
      reasons.push("shared pod");
    }

    // -1 per extra brand-process they are already assigned to
    const extraBps = Math.max(0, candidateBps.length - 1);
    if (extraBps > 0) {
      score -= extraBps;
      reasons.push(`${extraBps} extra assignment(s)`);
    }

    suggestions.push({
      employeeId: candidate.id,
      kind,
      reason: reasons.join(", "),
      score,
    });
  }

  // Sort by score desc then employeeId
  suggestions.sort((a, b) => b.score - a.score || a.employeeId.localeCompare(b.employeeId));

  // Max 5
  return suggestions.slice(0, 5);
}
