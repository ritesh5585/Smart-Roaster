import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type ApiUser } from "../lib/api";

interface AuthState {
  user: ApiUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me().then((r) => {
      if (r.data) setUser(r.data.user);
      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api.login({ email, password });
    if (r.error) return r.error;
    setUser(r.data!.user);
    return null;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
