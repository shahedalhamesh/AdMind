import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { can } from "../services/auth";
import { useAuth } from "../components/AuthContext";
import { usePortalTheme } from "../services/portalTheme";
import LangToggle from "../components/LangToggle";

const ICONS: Record<string, React.ReactNode> = {
  home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16 3.1a4 4 0 0 1 0 7.8" /></>,
  team: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
  ai: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />,
  content: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>,
  ok: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  task: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  mega: <><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>,
  chart: <><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M7 16h8" /><path d="M7 11h12" /><path d="M7 6h3" /></>,
};

// Flip `built` to true (and add the route in app.tsx) when each page exists.
// `perm` decides who sees the item (checked with can(), never with the role name).
type NavItem = { to: string; label: string; icon: string; built: boolean; perm?: string };

const MAIN: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: "home", built: true },
  { to: "/clients", label: "Clients", icon: "users", built: true, perm: "clients.view" },
  { to: "/team", label: "Team", icon: "team", built: true, perm: "users.view" },
  { to: "/assistant", label: "AI Assistant", icon: "ai", built: true, perm: "agents.run" },
  { to: "/content", label: "Content", icon: "content", built: true, perm: "content.view" },
  { to: "/approvals", label: "Approvals", icon: "ok", built: true, perm: "approvals.respond" },
];
const SOON: NavItem[] = [
  { to: "/tasks", label: "Tasks", icon: "task", built: true, perm: "tasks.view" },
  { to: "/campaigns", label: "Campaigns", icon: "mega", built: true, perm: "campaigns.view" },
  { to: "/reports", label: "Reports", icon: "chart", built: true, perm: "reports.view" },
  { to: "/meetings", label: "Meetings", icon: "content", built: true, perm: "clients.view" },
  { to: "/recommendations", label: "Recommendations", icon: "ok", built: true, perm: "clients.view" },
];

export default function AgencyLayout() {
  const { dark, toggle, p } = usePortalTheme();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  let agency = "Your agency";
  try {
    const raw = localStorage.getItem("admind_company_profile");
    if (raw) agency = JSON.parse(raw).name || agency;
  } catch { /* ignore */ }

  const initials = (user?.name ?? "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  // Show only what this person is allowed to use.
  const visible = (it: NavItem) => !it.perm || can(user, it.perm);
  const mainItems = MAIN.filter(visible);
  const soonItems = SOON.filter(visible);

  const Svg = ({ name, size = 19 }: { name: string; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>
  );

  const renderItem = (it: NavItem) => {
    const base: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, fontSize: 14, textDecoration: "none" };
    if (!it.built) {
      return (
        <div key={it.to} aria-disabled title="Coming soon"
          style={{ ...base, color: p.muted, opacity: 0.6, cursor: "default", fontWeight: 500 }}>
          <Svg name={it.icon} />{it.label}
          <span style={{ marginInlineStart: "auto", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase" }}>Soon</span>
        </div>
      );
    }
    return (
      <NavLink key={it.to} to={it.to}
        style={({ isActive }) => ({ ...base, fontWeight: isActive ? 600 : 500, background: isActive ? p.pri : "transparent", color: isActive ? "#fff" : p.text })}>
        <Svg name={it.icon} />{it.label}
      </NavLink>
    );
  };

  const eyebrow: React.CSSProperties = { fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: ".2em", color: p.eyeb, padding: "0 12px 8px" };

  return (
    <div className="pl-shell" style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "268px minmax(0, 1fr)", background: p.bg, color: p.text, fontFamily: "Inter, system-ui, sans-serif", transition: "background .3s" }}>
      <style>{`
        .pl-in::placeholder{color:${p.muted};opacity:.7}
        @media (max-width: 900px){ .pl-shell{grid-template-columns:1fr!important} .pl-side{display:none!important} }
        @media (prefers-reduced-motion: reduce){*{animation:none!important}}
      `}</style>

      {/* Sidebar */}
      <aside className="pl-side" style={{ background: p.side, borderInlineEnd: `1px solid ${p.border}`, padding: "22px 16px", display: "flex", flexDirection: "column", boxSizing: "border-box", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 8px 22px" }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: p.logoBg, boxShadow: "0 0 0 3px #A64B35", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={p.logoIc} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M9 13a4.5 4.5 0 0 0 3-4" /><path d="M12 13h4" /><path d="M12 8h8" /></svg>
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 600, letterSpacing: ".14em" }}>ADMIND</div>
        </div>

        {/* The menu scrolls on small screens; the profile card and Log out stay visible below it. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 12 }}>
          <div style={eyebrow}>WORKSPACE</div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>{mainItems.map(renderItem)}</nav>
          {soonItems.length > 0 && (
            <>
              <div style={{ ...eyebrow, paddingTop: 22 }}>COMING SOON</div>
              <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>{soonItems.map(renderItem)}</nav>
            </>
          )}
        </div>

        <div style={{ flexShrink: 0, padding: 14, borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#C75B41,#A64B35)", color: "#fff", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name ?? "User"}</div>
              <div style={{ fontSize: 12, color: p.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[user?.role, agency].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          <button type="button" onClick={logout}
            style={{ marginTop: 12, width: "100%", height: 36, borderRadius: 8, border: `1px solid ${p.border}`, background: "transparent", color: p.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Log out</button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div aria-hidden style={{ position: "absolute", inset: "0 0 auto 0", height: 400, background: `radial-gradient(ellipse at 85% -20%, ${p.glow} 0%, transparent 60%)`, pointerEvents: "none" }} />
        <header style={{ position: "sticky", top: 0, zIndex: 10, height: 72, boxSizing: "border-box", padding: "0 36px", display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${p.border}`, background: p.hdr, backdropFilter: "blur(10px)" }}>
          <label style={{ width: 380, maxWidth: "50%", height: 42, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 10, padding: "0 14px", borderRadius: 10, border: `1px solid ${p.border}`, background: p.card, color: p.muted, fontSize: 14 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input className="pl-in" placeholder="Search clients, content, requests" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: p.text, fontSize: 14, fontFamily: "inherit" }} />
          </label>
          <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <LangToggle />
            <button type="button" onClick={toggle} aria-label="Toggle theme"
              style={{ width: 42, height: 42, borderRadius: 10, border: `1px solid ${p.border}`, background: p.card, color: p.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {dark
                ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>
                : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>}
            </button>
            <button type="button" aria-label="Notifications"
              style={{ position: "relative", width: 42, height: 42, borderRadius: 10, border: `1px solid ${p.border}`, background: p.card, color: p.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            </button>
          </div>
        </header>
        <main style={{ position: "relative", padding: "30px 36px 70px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}