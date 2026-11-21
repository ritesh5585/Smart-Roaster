const API = import.meta.env.VITE_API_URL;

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "POD_LEAD" | "EMPLOYEE";
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
  register: (body: { name: string; email: string; password: string }) =>
    request<{ user: ApiUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ user: ApiUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  googleLogin: (credential: string) =>
    request<{ user: ApiUser }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
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
};
