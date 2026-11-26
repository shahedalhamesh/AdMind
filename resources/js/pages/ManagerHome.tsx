import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { usePortalTheme } from "../services/portalTheme";
import { approvalsApi, contentApi, fmtDateTime, isInternalStage, isOverdue, publishApi } from "../services/content";
import { Badge, Card, Loading, Notice, RED, errorText } from "../components/Ui";
import NotificationsPanel from "../components/NotificationsPanel";
import AtRiskCard from "../components/AtRiskCard";
// How many content items have a given status (one small request each: only the total is read).
function useTotal(status: string) {
  return useQuery({ queryKey: ["content-total", status], queryFn: async () => (await contentApi.list({ status, per_page: 1 })).total });
}

// Home for a manager: where every piece of content is right now, and what waits for the manager.
export default function ManagerHome() {
  const { p } = usePortalTheme();
  const { user } = useAuth();

  const approvals = useQuery({ queryKey: ["approvals"], queryFn: approvalsApi.list });
  const jobs = useQuery({ queryKey: ["publish-jobs", { filter: "pending", clientId: "" }], queryFn: () => publishApi.list({ status: "pending", per_page: 100 }) });
  const draft = useTotal("draft");
  const approved = useTotal("approved");
  const scheduled = useTotal("scheduled");
  const published = useTotal("published");

  const pendingContent = (approvals.data ?? []).filter((a) => a.status === "pending" && a.subject_type === "content_item");
  const waiting = pendingContent.filter(isInternalStage);
  const withClient = pendingContent.filter((a) => !isInternalStage(a));
  const nextPosts = (jobs.data?.data ?? []).slice(0, 5);
  const overdue = (jobs.data?.data ?? []).filter(isOverdue).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = user?.name?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const steps: { label: string; value: number | undefined; to: string; hot?: boolean }[] = [
    { label: "Draft", value: draft.data, to: "/content" },
    { label: "Waiting for you", value: approvals.isSuccess ? waiting.length : undefined, to: "/approvals", hot: true },
    { label: "With the client", value: approvals.isSuccess ? withClient.length : undefined, to: "/approvals" },
    { label: "Approved", value: approved.data, to: "/content" },
    { label: "Scheduled", value: scheduled.data, to: "/content" },
    { label: "Published", value: published.data, to: "/content" },
  ];

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>{today}</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 40, fontWeight: 500 }}>{greeting}, {first}.</h1>
      <p style={{ margin: "8px 0 0", fontSize: 15, color: p.muted }}>
        {approvals.isSuccess ? (waiting.length === 0 ? "Nothing is waiting for your review." : `${waiting.length} ${waiting.length === 1 ? "item is" : "items are"} waiting for your review.`) : " "}
      </p>

      <Card style={{ marginTop: 26 }}>
        <h2 style={{ margin: "0 0 16px", fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 500 }}>Where the content is right now</h2>
             <div style={{ marginTop: 26 }}><AtRiskCard /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {steps.map((s) => (
            <Link key={s.label} to={s.to}
              style={{ padding: "16px 18px", borderRadius: 14, border: `1px solid ${s.hot ? "transparent" : p.border}`, background: s.hot ? p.pri : "transparent", color: s.hot ? "#fff" : p.text, textDecoration: "none" }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 500, lineHeight: 1 }}>{s.value ?? "–"}</div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: s.hot ? 1 : 0.75 }}>{s.label}</div>
            </Link>
          ))}
        </div>
        
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 22, marginTop: 26 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>Waiting for your review</h2>
            <Link to="/approvals" style={{ color: p.link, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>See all</Link>
          </div>
          <Card>
            {approvals.isLoading && <Loading />}
            {approvals.isError && <Notice kind="error">{errorText(approvals.error)}</Notice>}
            {approvals.isSuccess && waiting.length === 0 && <p style={{ margin: 0, fontSize: 14, color: p.muted }}>When an employee sends a reel, it appears here with a link for you to review.</p>}
            <div style={{ display: "grid", gap: 14 }}>
              {waiting.slice(0, 5).map((a) => (
                <Link key={a.id} to={`/content/${a.subject_id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, color: p.text, textDecoration: "none" }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{a.content?.title ?? `Content #${a.subject_id}`}</span>
                    <span style={{ display: "block", marginTop: 3, fontSize: 12, color: p.muted }}>{[a.content?.client?.name, a.content?.type].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span style={{ color: p.link, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>Review →</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
              <div style={{ marginTop: 26 }}>
        <h2 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>Notifications</h2>
        <NotificationsPanel limit={10} />
      </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>Next posts</h2>
            <Link to="/content" style={{ color: p.link, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Scheduled posts</Link>
          </div>
          <Card>
            {jobs.isLoading && <Loading />}
            {jobs.isError && <Notice kind="error">{errorText(jobs.error)}</Notice>}
            {overdue > 0 && <div style={{ marginBottom: 12 }}><Notice kind="warning"><span style={{ color: RED, fontWeight: 600 }}>{overdue} overdue</span>: the time passed and nobody marked it as published.</Notice></div>}
            {jobs.isSuccess && nextPosts.length === 0 && <p style={{ margin: 0, fontSize: 14, color: p.muted }}>Nothing is scheduled.</p>}
            <div style={{ display: "grid", gap: 14 }}>
              {nextPosts.map((j) => (
                <Link key={j.id} to={`/content/${j.content_id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, color: p.text, textDecoration: "none" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{j.content?.title ?? `Content #${j.content_id}`}</span>
                  <span style={{ fontSize: 12, color: isOverdue(j) ? RED : p.muted, whiteSpace: "nowrap" }}>{fmtDateTime(j.scheduled_at)}</span>
                </Link>
              ))}
            </div>
            {jobs.isSuccess && (jobs.data?.data ?? []).some(isOverdue) && <div style={{ marginTop: 12 }}><Badge tone="bad">Overdue</Badge></div>}
          </Card>
        </div>
      </div>
    </div>
  );
}