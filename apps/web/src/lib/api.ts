const API = import.meta.env.VITE_API_URL;

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "POD_LEAD" | "EMPLOYEE";
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
};
