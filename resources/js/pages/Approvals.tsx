import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { STATUS_LABEL, approvalsApi, contentTone, fmtDateTime, isInternalStage } from "../services/content";
import type { Approval } from "../services/content";
import { Badge, Btn, Loading, Notice, errorText } from "../components/Ui";

type Tab = "mine" | "client" | "done";

const DECIDED: Record<string, string> = { approved: "Approved", rejected: "Rejected", changes_requested: "Changes requested" };

// Stage 1 (internal review) is decided here. Stage 2 is the client's own decision, shown as "With the client".
export default function Approvals() {
  const { p } = usePortalTheme();
  const [tab, setTab] = useState<Tab>("mine");

  const list = useQuery({ queryKey: ["approvals"], queryFn: approvalsApi.list });
  const all = (list.data ?? []).filter((a) => a.subject_type === "content_item");

  const mine = all.filter((a) => a.status === "pending" && isInternalStage(a));
  const withClient = all.filter((a) => a.status === "pending" && !isInternalStage(a));
  const done = all.filter((a) => a.status !== "pending");

  const shown = tab === "mine" ? mine : tab === "client" ? withClient : done;
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "mine", label: "Waiting for you", count: mine.length },
    { id: "client", label: "With the client", count: withClient.length },
    { id: "done", label: "Decided", count: done.length },
  ];

  const row = (a: Approval) => {
    const c = a.content;
    return (
      <Link key={a.id} to={`/content/${a.subject_id}`}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card, color: p.text, textDecoration: "none", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{c?.title ?? `Content #${a.subject_id}`}</div>
          <div dir="auto" style={{ marginTop: 4, fontSize: 13, color: p.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 560 }}>
            {c?.current_version?.body ?? ""}
          </div>
          {a.status !== "pending" && a.comment && <div dir="auto" style={{ marginTop: 6, fontSize: 13, color: p.muted }}>&ldquo;{a.comment}&rdquo;</div>}
        </div>
        <div style={{ fontSize: 13, color: p.muted }}>{c?.client?.name ?? ""}</div>
        {c && <Badge>{c.type}</Badge>}
        {c && <Badge>{c.platform}</Badge>}
        {a.status === "pending"
          ? <Badge tone="warn">{isInternalStage(a) ? "Needs your review" : "With the client"}</Badge>
          : <Badge tone={a.status === "approved" ? "good" : "bad"}>{(isInternalStage(a) ? "Manager: " : "Client: ") + (DECIDED[a.status] ?? a.status)}</Badge>}
        <span style={{ fontSize: 12, color: p.muted, whiteSpace: "nowrap" }}>{fmtDateTime(a.decided_at ?? a.created_at)}</span>
        {c && <Badge tone={contentTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>}
      </Link>
    );
  };

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Approvals</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Approvals</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: p.muted }}>Content goes to a manager first, then to the client.</p>

      <div role="tablist" style={{ display: "flex", gap: 6, margin: "24px 0 20px", borderBottom: `1px solid ${p.border}`, overflowX: "auto" }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)}
            style={{ padding: "11px 16px", border: 0, borderBottom: `2px solid ${tab === t.id ? p.pri : "transparent"}`, background: "transparent", color: tab === t.id ? p.text : p.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {t.label} <span style={{ opacity: 0.7 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)} <Btn small onClick={() => list.refetch()}>Try again</Btn></Notice>}
      {list.isSuccess && shown.length === 0 && (
        <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>
          {tab === "mine" ? "Nothing is waiting for your review." : tab === "client" ? "Nothing is with the client right now." : "No decisions yet."}
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>{shown.map(row)}</div>
    </div>
  );
}