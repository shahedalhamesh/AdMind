import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { notificationsApi } from "../services/notifications";
import NotificationsPanel from "./NotificationsPanel";

// The bell in the top bar: a number for the unread ones, and a small list that opens under it.
export default function NotificationBell() {
  const { p } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // only the unread number is needed here: ask for one item
  const q = useQuery({
    queryKey: ["notifications", "count"],
    queryFn: () => notificationsApi.list({ per_page: 1 }),
    refetchInterval: 30000,
  });
  const unread = q.data?.unread_count ?? 0;

  // close when the person goes to another page
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // close with a click outside or the Escape key
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ position: "relative", width: 42, height: 42, borderRadius: 10, border: `1px solid ${open ? p.priB : p.border}`, background: p.card, color: p.text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {unread > 0 && (
          <span aria-hidden style={{ position: "absolute", top: -6, insetInlineEnd: -6, minWidth: 20, height: 20, padding: "0 5px", boxSizing: "border-box", borderRadius: 10, background: "#E5484D", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications"
          style={{ position: "absolute", top: 52, insetInlineEnd: 0, width: 420, maxWidth: "calc(100vw - 32px)", padding: 16, boxSizing: "border-box", borderRadius: 16, border: `1px solid ${p.border}`, background: p.bg, boxShadow: "0 18px 50px rgba(0,0,0,.35)", zIndex: 30 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500, marginBottom: 12 }}>Notifications</div>
          <NotificationsPanel limit={8} />
        </div>
      )}
    </div>
  );
}