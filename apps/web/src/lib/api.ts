const API = (import.meta.env.VITE_API_URL || "/app").replace(/\/+$/, "");

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "MANAGER" | "VIEWER";
}

export type OperatingRule = "ALL_365" | "EXCEPT_HOLIDAYS" | "NO_SUN_HOLIDAYS";

export interface Pod {
  id: string;
  name: string;
  leadId?: string | null;
  lead?: Employee | null;
  members?: Employee[];
  _count?: { members: number };
}

export interface Employee {
  id: string;
  name: string;
  email?: string | null;
  isActive: boolean;
  podId?: string | null;
  pod?: Pod | null;
  preferredOffDay?: number | null;
  _count?: { assignments: number };
}

export interface Process {
  id: string;
  code: string;
  name: string;
}

export interface Assignment {
  id: string;
  employeeId: string;
  brandProcessId: string;
  employee?: Employee;
}

export interface BrandProcess {
  id: string;
  brandId: string;
  processId: string;
  operatingRule: OperatingRule;
  minCoverage: number;
  process: Process;
  assignments: Assignment[];
}

export interface Brand {
  id: string;
  name: string;
  isActive: boolean;
  brandProcesses: BrandProcess[];
}

export type DayStatus = "WORKING" | "WEEKOFF" | "LEAVE" | "COMP_OFF" | "HOLIDAY";
export type EntrySource = "AUTO" | "MANUAL";
export type RosterStatus = "DRAFT" | "PUBLISHED";
export type IssueSeverity = "ERROR" | "WARNING" | "INFO";
export type IssueType =
  | "COVERAGE_GAP"
  | "NO_ASSIGNEE"
  | "WEEKLY_OFF_MISSING"
  | "ENTRY_CONFLICTS_LEAVE"
  | "SINGLE_POINT_OF_FAILURE"
  | "PREFERENCE_NOT_MET";

export interface RosterEntry {
  employeeId: string;
  date: string;
  status: DayStatus;
  source: EntrySource;
}

export interface RosterIssue {
  type: IssueType;
  severity: IssueSeverity;
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

export interface RosterCoverage {
  brandProcessId: string;
  date: string;
  required: number;
  actual: number;
}

export interface RosterSummary {
  errors: number;
  warnings: number;
  infos: number;
  coveragePercent: number;
}

export interface RosterHeader {
  id: string;
  year: number;
  month: number;
  status: RosterStatus;
  version: number;
  updatedAt?: string;
}

export interface RosterView {
  roster: RosterHeader;
  entries: RosterEntry[];
  issues: RosterIssue[];
  coverage: RosterCoverage[];
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
  summary: RosterSummary;
}

export type LeaveType = "LEAVE" | "COMP_OFF";

export interface Leave {
  id: string;
  employeeId: string;
  employeeName?: string;
  employee?: { id: string; name: string; email?: string | null };
  startDate: string;
  endDate: string;
  type: LeaveType;
  note?: string | null;
  createdAt: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface Suggestion {
  employeeId: string;
  employeeName: string;
  kind: "CROSS_COVER" | "SWAP_WEEKOFF";
  reason: string;
  score: number;
}

interface ApiResult<T> {
  data?: T;
  error?: string;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const body = await res.json();
    if (!res.ok) return { error: body.error || "Something went wrong" };
    return { data: body as T };
  } catch {
    return { error: "Network error" };
  }
}

export const api = {
  // Auth
  login: (body: { email: string; password: string }) =>
    request<{ user: ApiUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () => request<{ user: ApiUser }>("/auth/me"),

  logout: () =>
    request<{ message: string }>("/auth/logout", { method: "POST" }),

  // Pods
  getPods: () => request<Pod[]>("/pods"),
  createPod: (body: { name: string; leadId?: string | null }) =>
    request<Pod>("/pods", { method: "POST", body: JSON.stringify(body) }),
  updatePod: (id: string, body: { name?: string; leadId?: string | null }) =>
    request<Pod>(`/pods/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // Employees
  getEmployees: (params?: { active?: boolean }) =>
    request<Employee[]>(`/employees${params?.active ? "?active=true" : ""}`),
  createEmployee: (body: {
    name: string;
    email?: string | null;
    podId?: string | null;
  }) =>
    request<Employee>("/employees", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateEmployee: (
    id: string,
    body: {
      name?: string;
      email?: string | null;
      podId?: string | null;
      isActive?: boolean;
      preferredOffDay?: number | null;
    },
  ) =>
    request<Employee>(`/employees/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // Processes
  getProcesses: () => request<Process[]>("/processes"),

  // Brands
  getBrands: () => request<Brand[]>("/brands"),
  createBrand: (body: { name: string }) =>
    request<Brand>("/brands", { method: "POST", body: JSON.stringify(body) }),
  updateBrand: (id: string, body: { name?: string; isActive?: boolean }) =>
    request<Brand>(`/brands/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  // Brand Processes
  createBrandProcess: (body: {
    brandId: string;
    processId: string;
    operatingRule?: OperatingRule;
    minCoverage?: number;
  }) =>
    request<BrandProcess>("/brand-processes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBrandProcess: (
    id: string,
    body: { operatingRule?: OperatingRule; minCoverage?: number },
  ) =>
    request<BrandProcess>(`/brand-processes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteBrandProcess: (id: string) =>
    request<{ message: string }>(`/brand-processes/${id}`, {
      method: "DELETE",
    }),

  // Assignments
  createAssignment: (body: { employeeId: string; brandProcessId: string }) =>
    request<Assignment>("/assignments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteAssignment: (id: string) =>
    request<{ message: string }>(`/assignments/${id}`, { method: "DELETE" }),

  // Rosters
  getRosterByMonth: (year: number, month: number) =>
    request<{ roster: RosterHeader | null }>(`/rosters?year=${year}&month=${month}`),
  generateRoster: (body: { year: number; month: number; overwrite?: boolean }) =>
    request<RosterView>("/rosters/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getRoster: (id: string) => request<RosterView>(`/rosters/${id}`),
  updateRosterEntry: (
    id: string,
    body: {
      employeeId: string;
      date: string;
      status: "WORKING" | "WEEKOFF";
      version: number;
    }
  ) =>
    request<{
      version: number;
      issues: RosterIssue[];
      summary: RosterSummary;
    }>(`/rosters/${id}/entries`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getSuggestions: (id: string, params: { brandProcessId: string; date: string }) =>
    request<Suggestion[]>(
      `/rosters/${id}/suggestions?brandProcessId=${encodeURIComponent(
        params.brandProcessId
      )}&date=${encodeURIComponent(params.date)}`
    ),
  publishRoster: (id: string, body?: { acknowledgeErrors?: boolean }) =>
    request<{ roster: RosterHeader }>(`/rosters/${id}/publish`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    }),
  unpublishRoster: (id: string) =>
    request<{ roster: RosterHeader }>(`/rosters/${id}/unpublish`, {
      method: "POST",
    }),

  // Leaves
  getLeaves: (params?: { employeeId?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.employeeId) q.set("employeeId", params.employeeId);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return request<Leave[]>(`/leaves${qs ? `?${qs}` : ""}`);
  },
  createLeave: (body: {
    employeeId: string;
    startDate: string;
    endDate: string;
    type?: LeaveType;
    note?: string | null;
  }) =>
    request<Leave>("/leaves", { method: "POST", body: JSON.stringify(body) }),
  deleteLeave: (id: string) =>
    request<{ message: string }>(`/leaves/${id}`, { method: "DELETE" }),

  // Holidays
  getHolidays: (params?: { year?: number }) =>
    request<Holiday[]>(`/holidays${params?.year ? `?year=${params.year}` : ""}`),
  createHoliday: (body: { date: string; name: string }) =>
    request<Holiday>("/holidays", { method: "POST", body: JSON.stringify(body) }),
  deleteHoliday: (id: string) =>
    request<{ message: string }>(`/holidays/${id}`, { method: "DELETE" }),
};
