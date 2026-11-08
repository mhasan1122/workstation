"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import type { User } from "@/types";

interface AuthContextValue {
  user: User;
  unreadCount: number;
  setUser: (u: User) => void;
  refreshUnread: () => Promise<void>;
  setUnreadCount: (n: number) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/**
 * Client-side auth guard. Renders children only once the session has been
 * verified against GET /api/auth/me.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const redirectToLogin = useCallback(() => {
    clearToken();
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [pathname, router]);

  useEffect(() => {
    if (!getToken()) {
      redirectToLogin();
      return;
    }
    let cancelled = false;
    api
      .get<User>("/api/auth/me")
      .then((res) => {
        if (!cancelled) setUser(res.data);
      })
      .catch(() => {
        if (!cancelled) redirectToLogin();
      });
    return () => {
      cancelled = true;
    };
    // Verify once on mount; the guard re-checks the cookie on navigation below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the cookie disappears (e.g. 401 handler / other tab) bounce to login.
  useEffect(() => {
    if (user && !getToken()) redirectToLogin();
  }, [pathname, user, redirectToLogin]);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await api.get<{ unread_count?: number; count?: number }>(
        "/api/notifications/unread-count",
      );
      setUnreadCount(res.data.unread_count ?? res.data.count ?? 0);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUnread();
    const t = setInterval(refreshUnread, 60_000);
    return () => clearInterval(t);
  }, [user, refreshUnread]);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      /* token is discarded regardless */
    }
    clearToken();
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthContextValue | null>(
    () =>
      user
        ? { user, unreadCount, setUser, refreshUnread, setUnreadCount, logout }
        : null,
    [user, unreadCount, refreshUnread, logout],
  );

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="size-9 animate-spin rounded-full border-2 border-line border-t-gold" />
          <p className="font-display text-sm text-ink-muted">Securing your session…</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
