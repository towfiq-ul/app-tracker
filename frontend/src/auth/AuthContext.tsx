import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "../api";
import type { Admin } from "../types";

interface AuthState {
  admin: Admin | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .fetchMe()
      .then(setAdmin)
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const result = await api.login(username, password);
    setAdmin(result);
  }

  async function logout() {
    await api.logout();
    setAdmin(null);
  }

  async function refresh() {
    setAdmin(await api.fetchMe());
  }

  return <AuthContext value={{ admin, loading, login, logout, refresh }}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
