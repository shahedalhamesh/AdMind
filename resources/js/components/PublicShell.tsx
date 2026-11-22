import type { ReactNode } from "react";
import { usePortalTheme } from "../services/portalTheme";

export default function PublicShell({ children }: { children: ReactNode }) {
  const { p } = usePortalTheme();
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: p.bg, color: p.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 460, padding: 28, borderRadius: 18, border: `1px solid ${p.border}`, background: p.card }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: ".18em", fontWeight: 600, marginBottom: 20 }}>ADMIND</div>
        {children}
      </div>
    </div>
  );
}