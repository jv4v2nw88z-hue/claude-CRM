import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/resources";
import { UNAUTHORIZED_EVENT } from "../api/apiClient";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  // An expired cookie shouldn't leave the app rendering a shell it can't fill.
  useEffect(() => {
    const handler = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
