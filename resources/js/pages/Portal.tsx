import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { approvalsApi, fmtDateTime } from "../services/content";
import type { Approval } from "../services/content";
import { reportsApi } from "../services/reports";
import { ReportBody } from "./Reports";
import ClientRequests from "../components/portal/ClientRequests";
import FeedbackForm from "../components/portal/FeedbackForm";
import { Badge, Btn, Loading, Modal, Notice, errorText } from "../components/Ui";

const DECIDED: Record<string, string> = { approved: "You approved", rejected: "You rejected", changes_requested: "You asked for changes" };

// The simple screen of a client's own login (and of the platform admin): its own header, no agency menu.
export function PortalShell({ children }: { children: ReactNode }) {
  const { p, toggle } = usePortalTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const logout = async () => { await signOut(); navigate("/login", { replace: true }); };

  return (
    <div style={{ minHeight: "100vh", background: p.bg, color: p.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "16px 24px", borderBottom: `1px solid ${p.border}` }}>
        <Link to="/" style={{ color: p.text, textDecoration: "none", fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: ".18em", fontWeight: 600 }}>ADMIND</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: p.muted }}>{user?.name}</span>
          <Btn small onClick={toggle}>Theme</Btn>
          <Btn small onClick={logout}>Log out</Btn>
        </div>
      </header>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 64px" }}>{children}</main>
    </div>
  );
}

type Tab = "review" | "done" | "reports" | "requests" | "feedback";

export default function Portal() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("review");
  const [openReport, setOpenReport] = useState<number | null>(null);

  // for a client's login the backend returns only the requests sent to it
  const list = useQuery({ queryKey: ["approvals"], queryFn: approvalsApi.list, refetchInterval: 60000 });
  // only the reports the agency chose to share
  const reports = useQuery({ queryKey: ["reports", "mine"], queryFn: () => reportsApi.list("") });
  const all = (list.data ?? []).filter((a) => a.subject_type === "content_item");
  const review = all.filter((a) => a.status === "pending");
  const done = all.filter((a) => a.status !== "pending");
  const shown = tab === "review" ? review : done;
  const sharedReports = (reports.data ?? []).filter((r) => r.visible_to_client !== false);

  const row = (a: Approval) => {
    const c = a.content;
    return (
      <Link key={a.id} to={`/portal/content/${a.subject_id}`}
        style={{ display: "grid", gap: 8, padding: "18px 20px", borderRadius: 16, border: `1px solid ${p.border}`, background: p.card, color: p.text, textDecoration: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 17, fontWeight: 600, overflowWrap: "anywhere" }}>{c?.title ?? `Content #${a.subject_id}`}</span>
          {a.status === "pending" ? <Badge tone="warn">Waiting for you</Badge> : <Badge tone={a.status === "approved" ? "good" : "bad"}>{DECIDED[a.status] ?? a.status}</Badge>}
        </div>
        <div dir="auto" style={{ fontSize: 14, color: p.muted, lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{c?.current_version?.body ?? ""}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: p.muted }}>
          {c && <Badge>{c.type}</Badge>}
          <span>{fmtDateTime(a.decided_at ?? a.created_at)}</span>
          {a.status === "pending" && <span style={{ marginInlineStart: "auto", color: p.link, fontWeight: 600, fontSize: 13 }}>Review →</span>}
        </div>
      </Link>
    );
  };

  const tabs: [Tab, string][] = [["review", `To review (${review.length})`], ["done", `Decided (${done.length})`], ["reports", `Reports (${sharedReports.length})`]];
  if (can(user, "requests.create")) {
    tabs.push(["requests", "My requests"]);
    tabs.push(["feedback", "Feedback"]);
  }

  return (
    <PortalShell>
      <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Your content</h1>
      <p style={{ margin: "8px 0 0", fontSize: 15, color: p.muted }}>Your agency sends you posts and reels here. Approve them, or tell them what to change.</p>

      <div role="tablist" style={{ display: "flex", gap: 6, margin: "24px 0 20px", borderBottom: `1px solid ${p.border}`, overflowX: "auto" }}>
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
            style={{ padding: "11px 16px", border: 0, borderBottom: `2px solid ${tab === id ? p.pri : "transparent"}`, background: "transparent", color: tab === id ? p.text : p.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      {(tab === "review" || tab === "done") && (
        <>
          {list.isLoading && <Loading />}
          {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
          {list.isSuccess && shown.length === 0 && (
            <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>
              {tab === "review" ? "Nothing to review right now." : "You have not decided on anything yet."}
            </div>
          )}
          <div style={{ display: "grid", gap: 12 }}>{shown.map(row)}</div>
        </>
      )}

      {tab === "reports" && (
        <>
          {reports.isLoading && <Loading />}
          {reports.isError && <Notice kind="error">{errorText(reports.error)}</Notice>}
          {reports.isSuccess && sharedReports.length === 0 && (
            <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>Your agency has not shared a report yet.</div>
          )}
          <div style={{ display: "grid", gap: 10 }}>
            {sharedReports.map((r) => (
              <button key={r.id} type="button" onClick={() => setOpenReport(r.id)}
                style={{ textAlign: "start", padding: "16px 20px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card, color: p.text, fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                Report #{r.id}{r.period_start && r.period_end ? ` · ${r.period_start} → ${r.period_end}` : ""}
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "requests" && <ClientRequests />}
      {tab === "feedback" && <FeedbackForm />}

      {openReport !== null && <SharedReport id={openReport} onClose={() => setOpenReport(null)} />}
    </PortalShell>
  );
}

function SharedReport({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({ queryKey: ["report", id], queryFn: () => reportsApi.get(id) });
  return (
    <Modal title={`Report #${id}`} onClose={onClose} width={820}>
      {q.isLoading && <Loading />}
      {q.isError && <Notice kind="error">{errorText(q.error)}</Notice>}
      {q.data && <ReportBody d={q.data.data} />}
    </Modal>
  );
}