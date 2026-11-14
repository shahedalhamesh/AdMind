import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import { usePortalTheme } from "../services/portalTheme";

// Temporary page for areas we have not built yet (client portal, platform admin).
export default function Placeholder({ title, note }: { title: string; note: string }) {
  const { p } = usePortalTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: p.bg,
        color: p.text,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520, padding: 32, borderRadius: 18, border: `1px solid ${p.border}`, background: p.card }}>
        <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>
          {user?.role ?? "Account"}
        </p>
        <h1 style={{ margin: "12px 0 0", fontFamily: "Georgia, serif", fontSize: 34, fontWeight: 500 }}>{title}</h1>
        <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.6, color: p.muted }}>{note}</p>
        <p style={{ margin: "16px 0 0", fontSize: 13, color: p.muted }}>Signed in as {user?.email}</p>
        <button
          type="button"
          onClick={logout}
          style={{ marginTop: 20, height: 44, padding: "0 22px", borderRadius: 10, border: `1px solid ${p.border}`, background: "transparent", color: p.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
