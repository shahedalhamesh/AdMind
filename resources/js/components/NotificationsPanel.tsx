import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { NOTIFICATION_LABEL, notificationTarget, notificationsApi } from "../services/notifications";
import type { AppNotification } from "../services/notifications";
import { fmtDateTime } from "../services/content";
import { Badge, Btn, Loading, Notice, errorText } from "./Ui";

// Notifications shown inside the page (no bell). Refreshes by itself every 30 seconds while the page is open.
export default function NotificationsPanel({ limit = 5, unreadOnly = false }: { limit?: number; unreadOnly?: boolean }) {
  const { p } = usePortalTheme();
  const nav = useNavigate();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["notifications", { limit, unreadOnly }],
    queryFn: () => notificationsApi.list({ per_page: limit, ...(unreadOnly ? { unread: "1" } : {}) }),
    refetchInterval: 30000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({ mutationFn: (id: number) => notificationsApi.read(id), onSuccess: refresh });
  const markAll = useMutation({ mutationFn: notificationsApi.readAll, onSuccess: refresh });

  const items = list.data?.notifications.data ?? [];
  const unread = list.data?.unread_count ?? 0;

  const open = (n: AppNotification) => {
    if (!n.read_at) markRead.mutate(n.id);
    const to = notificationTarget(n);
    if (to) nav(to);
  };

  return (
    <div>
      {unread > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, fontSize: 13, color: p.muted }}>
          <span>{unread} unread</span>
          <Btn small onClick={() => markAll.mutate()} disabled={markAll.isPending}>Mark all as read</Btn>
        </div>
      )}
      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
     {list.isSuccess && items.length === 0 && <p style={{ margin: 0, fontSize: 14, color: p.muted }}>Nothing here.</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((n) => {
          const unreadItem = !n.read_at;
          const clickable = !!notificationTarget(n);
          return (
            <button key={n.id} type="button" onClick={() => open(n)}
              style={{ textAlign: "start", display: "grid", gap: 6, padding: "14px 16px", borderRadius: 14, border: `1px solid ${unreadItem ? p.pri : p.border}`, background: p.card, color: p.text, cursor: clickable || unreadItem ? "pointer" : "default", fontFamily: "inherit" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Badge tone={n.type === "failure" ? "bad" : unreadItem ? "warn" : "plain"}>{NOTIFICATION_LABEL[n.type] ?? n.type}</Badge>
                <span style={{ fontSize: 12, color: p.muted }}>{fmtDateTime(n.created_at)}</span>
                {unreadItem && <span style={{ fontSize: 12, fontWeight: 600, color: p.link }}>New</span>}
              </span>
              <span dir="auto" style={{ fontSize: 15, fontWeight: unreadItem ? 700 : 600, overflowWrap: "anywhere" }}>{n.title}</span>
              {n.body && <span dir="auto" style={{ fontSize: 13, color: p.muted, lineHeight: 1.5, overflowWrap: "anywhere" }}>{n.body}</span>}
              {clickable && <span style={{ fontSize: 13, fontWeight: 600, color: p.link }}>Open →</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}