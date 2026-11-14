import { Link, Navigate, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { can, homeFor } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import AgencyLayout from "../layouts/AgencyLayout";

/* The UI guards below are only for convenience (the right screen for the right person).
   The real protection is the backend: it answers 403 / 404 whatever the browser shows. */

export function Splash() {
  const { p } = usePortalTheme();
  return (
    <div
      role="status"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: p.bg,
        color: p.muted,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      Loading…
    </div>
  );
}

// "/" -> wherever this user belongs, or the login page.
export function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return <Navigate to={user ? homeFor(user) : "/login"} replace />;
}

// Login, sign up, forgot password: only for people who are not signed in.
export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

// Agency staff (Owner, Manager, Employee): the agency dashboard.
export function StaffRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.is_platform_admin || user.client_id) return <Navigate to={homeFor(user)} replace />;
  return <AgencyLayout />;
}

// A client's own login: the simple client portal.
export function PortalRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.is_platform_admin || !user.client_id) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

// Platform Admin only.
export function PlatformRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_platform_admin) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

// Inside the dashboard: a page that needs a permission (checked with can(), never with the role name).
export function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { user } = useAuth();
  const { p } = usePortalTheme();
  if (can(user, perm)) return <>{children}</>;
  return (
    <div style={{ maxWidth: 520, color: p.text }}>
      <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 500 }}>No access</h1>
      <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.6, color: p.muted }}>
        You do not have permission to open this page. If you think this is a mistake, ask the owner of your company.
      </p>
      <Link to="/dashboard" style={{ display: "inline-block", marginTop: 16, color: p.link, fontWeight: 600, fontSize: 14 }}>
        Back to home
      </Link>
    </div>
  );
}
