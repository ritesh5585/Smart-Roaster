export type DayStatus = "WORKING" | "WEEKOFF" | "LEAVE" | "COMP_OFF" | "HOLIDAY";

export type OperatingRule = "ALL_365" | "EXCEPT_HOLIDAYS" | "NO_SUN_HOLIDAYS";

export interface EngineInput {
  year: number;
  month: number; // 1-12
  employees: {
    id: string;
    name: string;
    podId: string | null;
    preferredOffDay: number | null; // 0=Sunday ... 6=Saturday
  }[]; // active only
  brandProcesses: {
    id: string;
    brandName: string;
    processCode: string;
    operatingRule: OperatingRule;
    minCoverage: number;
  }[]; // active brands only
  assignments: {
    employeeId: string;
    brandProcessId: string;
  }[];
  holidays: string[]; // "YYYY-MM-DD"
  leaves: {
    employeeId: string;
    startDate: string; // "YYYY-MM-DD"
    endDate: string; // "YYYY-MM-DD"
    type: "LEAVE" | "COMP_OFF";
  }[];
}

export interface RosterEntry {
  employeeId: string;
  date: string; // "YYYY-MM-DD"
  status: DayStatus;
  source: "AUTO" | "MANUAL";
}

export type IssueType =
  | "COVERAGE_GAP"
  | "NO_ASSIGNEE"
  | "WEEKLY_OFF_MISSING"
  | "ENTRY_CONFLICTS_LEAVE"
  | "SINGLE_POINT_OF_FAILURE"
  | "PREFERENCE_NOT_MET";

export interface Issue {
  type: IssueType;
  severity: "ERROR" | "WARNING" | "INFO";
  category: "MANDATORY" | "RISK" | "PREFERENCE";
  date: string | null;
  employeeId: string | null;
  brandProcessId: string | null;
  message: string;
  details?: {
    required?: number;
    actual?: number;
    reasons?: { employeeId: string; status: DayStatus }[];
  };
}

export interface Suggestion {
  employeeId: string;
  kind: "CROSS_COVER" | "SWAP_WEEKOFF";
  reason: string;
  score: number;
}
