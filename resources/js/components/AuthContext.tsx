import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError, UNAUTHORIZED_EVENT } from "../services/api";
import {
  clearUser,
  getToken,
  getUser,
  saveSession,
  saveUser,
  type AuthUser,
  type LoginResponse,
} from "../services/auth";

type AuthState = {
  user: AuthUser | null;
  // true while we ask GET /api/me after a page load (do not decide where to send the user before that)
  loading: boolean;
  signIn: (res: LoginResponse, remember?: boolean) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const hasToken = !!getToken();
  const [user, setUser] = useState<AuthUser | null>(() => (hasToken ? getUser() : null));
  const [loading, setLoading] = useState<boolean>(hasToken);

  // Restore the session after a page load: ask the server who this is.
  useEffect(() => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    api<AuthUser | { user: AuthUser }>("/me")
      .then((data) => {
        if (cancelled) return;
        // Part B says /me "returns the same user object": accept both a bare user and { user }.
        const u = (data as { user?: AuthUser }).user ?? (data as AuthUser);
        saveUser(u);
        setUser(u);
      })
      .catch((err) => {
        if (cancelled) return;
        // 401 is handled by the api wrapper (session cleared). If the server is just unreachable,
        // keep the cached user: every request will fail anyway, and the backend decides access.
        if (err instanceof ApiError && err.status === 0) return;
        if (!getToken()) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The api wrapper tells us when the token stopped working.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const signIn = useCallback((res: LoginResponse, remember = true) => {
    saveSession(res.token, res.user, remember);
    setUser(res.user);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api("/logout", { method: "POST" });
    } catch {
      /* even if the server cannot be reached, sign out locally */
    }
    clearUser();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}