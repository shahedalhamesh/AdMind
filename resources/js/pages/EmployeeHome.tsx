import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { STATUS_LABEL, contentApi, contentTone, fmtDateTime } from "../services/content";
import { isTaskOverdue, priorityTone, tasksApi } from "../services/tasks";
import NotificationsPanel from "../components/NotificationsPanel";
import { Badge, Card, Loading, Notice, RED, errorText } from "../components/Ui";

// Home for an employee: what to work on, what came back with notes, and what the AI can do.
export default function EmployeeHome() {
  const { p } = usePortalTheme();
  const { user } = useAuth();

  // an employee only receives their own tasks from the backend
  const tasks = useQuery({
    queryKey: ["tasks", { clientId: "", priority: "", mine: true }],
    queryFn: () => tasksApi.list({ mine: "1", top_level: "1", per_page: 100 }),
    enabled: can(user, "tasks.view"),
  });
  const revisions = useQuery({ queryKey: ["content-list", { home: "revision_requested" }], queryFn: () => contentApi.list({ status: "revision_requested", per_page: 5 }) });
  const drafts = useQuery({ queryKey: ["content-list", { home: "draft" }], queryFn: () => contentApi.list({ status: "draft", per_page: 5 }) });

  const open = (tasks.data?.data ?? []).filter((t) => t.status !== "completed");
  const overdue = open.filter(isTaskOverdue).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = user?.name?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const list = (items: { id: number; title: string; status: string; client?: { name: string } | null }[]) => (
    <div style={{ display: "grid", gap: 14 }}>
      {items.map((c) => (
        <Link key={c.id} to={`/content/${c.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, color: p.text, textDecoration: "none" }}>
          <span style={{ minWidth: 0 }}>
            <span dir="auto" style={{ display: "block", fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{c.title}</span>
            {c.client && <span style={{ display: "block", marginTop: 3, fontSize: 12, color: p.muted }}>{c.client.name}</span>}
          </span>
          <Badge tone={contentTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
        </Link>
      ))}
    </div>
  );

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>{today}</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 40, fontWeight: 500 }}>{greeting}, {first}.</h1>

      {can(user, "agents.run") && (
        <Link to="/assistant" style={{ display: "inline-block", marginTop: 18, padding: "12px 20px", borderRadius: 12, background: p.pri, color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          Ask the AI to write content →
        </Link>
      )}

      <div style={{ marginTop: 28 }}>
        <h2 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>Notifications</h2>
        <NotificationsPanel limit={10} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 22, marginTop: 28 }}>
        <div>
          <h2 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>Changes requested</h2>
          <Card>
            {revisions.isLoading && <Loading />}
            {revisions.isError && <Notice kind="error">{errorText(revisions.error)}</Notice>}
            {revisions.isSuccess && (revisions.data?.data.length ?? 0) === 0 && <p style={{ margin: 0, fontSize: 14, color: p.muted }}>Nothing came back with notes.</p>}
            {list(revisions.data?.data ?? [])}
          </Card>
        </div>

        <div>
          <h2 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>My drafts</h2>
          <Card>
            {drafts.isLoading && <Loading />}
            {drafts.isError && <Notice kind="error">{errorText(drafts.error)}</Notice>}
            {drafts.isSuccess && (drafts.data?.data.length ?? 0) === 0 && <p style={{ margin: 0, fontSize: 14, color: p.muted }}>No drafts. Start one with the AI Assistant.</p>}
            {list(drafts.data?.data ?? [])}
          </Card>
        </div>
      </div>

      {can(user, "tasks.view") && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>My tasks</h2>
            <Link to="/tasks" style={{ color: p.link, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>See all</Link>
          </div>
          <Card>
            {tasks.isLoading && <Loading />}
            {tasks.isError && <Notice kind="error">{errorText(tasks.error)}</Notice>}
            {overdue > 0 && <div style={{ marginBottom: 12 }}><Notice kind="warning"><span style={{ color: RED, fontWeight: 600 }}>{overdue} overdue</span></Notice></div>}
            {tasks.isSuccess && open.length === 0 && <p style={{ margin: 0, fontSize: 14, color: p.muted }}>No open tasks.</p>}
            <div style={{ display: "grid", gap: 14 }}>
              {open.slice(0, 6).map((t) => (
                <Link key={t.id} to="/tasks" style={{ display: "flex", justifyContent: "space-between", gap: 10, color: p.text, textDecoration: "none" }}>
                  <span style={{ minWidth: 0 }}>
                    <span dir="auto" style={{ display: "block", fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{t.title}</span>
                    <span style={{ display: "block", marginTop: 3, fontSize: 12, color: isTaskOverdue(t) ? RED : p.muted }}>
                      {[t.client?.name, t.due_at ? `Due ${fmtDateTime(t.due_at)}` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}