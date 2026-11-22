import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { STATUS_LABEL, approvalsApi, contentApi, contentTone, fmtDateTime, isInternalStage } from "../services/content";
import { Badge, Btn, Loading, Notice, Select, errorText } from "../components/Ui";

type Tab = "review" | "changes" | "approved" | "all";

const TABS: { id: Tab; label: string; status: string }[] = [
  { id: "review", label: "To review", status: "in_review" },
  { id: "changes", label: "Changes requested", status: "revision_requested" },
  { id: "approved", label: "Approved", status: "approved" },
  { id: "all", label: "All posts", status: "" },
];

const EMPTY: Record<Tab, string> = {
  review: "Nothing is waiting for review.",
  changes: "No post has changes requested.",
  approved: "No approved posts yet.",
  all: "No posts yet.",
};

// The manager's place for content: choose a client, see their posts by status, open one to decide.
// Content goes to a manager first, then to the client.
export default function Approvals() {
  const { p } = usePortalTheme();
  const [tab, setTab] = useState<Tab>("review");
  const [clientId, setClientId] = useState("");
  const [page, setPage] = useState(1);
  const status = TABS.find((t) => t.id === tab)?.status ?? "";

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.name])), [clients.data]);

  const list = useQuery({
    queryKey: ["approvals-content", { clientId, status, page }],
    queryFn: () => contentApi.list({ client_id: clientId, status, type: "", platform: "", page, per_page: 20 }),
  });
  const items = list.data?.data ?? [];

  // which posts are waiting for a manager, and which are with the client (from the approvals themselves)
  const approvals = useQuery({ queryKey: ["approvals"], queryFn: approvalsApi.list });
  const stage = useMemo(() => {
    const m = new Map<number, "internal" | "client">();
    for (const a of approvals.data ?? []) {
      if (a.subject_type === "content_item" && a.status === "pending") m.set(a.subject_id, isInternalStage(a) ? "internal" : "client");
    }
    return m;
  }, [approvals.data]);

  const chooseTab = (t: Tab) => { setTab(t); setPage(1); };
  const chooseClient = (v: string) => { setClientId(v); setPage(1); };

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Approvals</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Approvals</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: p.muted }}>Choose a client to see their posts. Content goes to a manager first, then to the client.</p>

      <div style={{ width: 260, margin: "22px 0 0" }}>
        <Select aria-label="Client" value={clientId} onChange={(e) => chooseClient(e.target.value)}>
          <option value="">All clients</option>
          {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      <div role="tablist" style={{ display: "flex", gap: 6, margin: "20px 0 20px", borderBottom: `1px solid ${p.border}`, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => chooseTab(t.id)}
            style={{ padding: "11px 16px", border: 0, borderBottom: `2px solid ${tab === t.id ? p.pri : "transparent"}`, background: "transparent", color: tab === t.id ? p.text : p.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)} <Btn small onClick={() => list.refetch()}>Try again</Btn></Notice>}
      {list.isSuccess && items.length === 0 && (
        <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>{EMPTY[tab]}</div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((c) => {
          const s = stage.get(c.id);
          return (
            <Link key={c.id} to={`/content/${c.id}`}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card, color: p.text, textDecoration: "none", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{c.title}</div>
                <div dir="auto" style={{ marginTop: 4, fontSize: 13, color: p.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 560 }}>
                  {c.current_version?.body ?? ""}
                </div>
              </div>
              <div style={{ fontSize: 13, color: p.muted }}>{clientName.get(c.client_id) ?? `Client #${c.client_id}`}</div>
              <Badge>{c.type}</Badge>
              <Badge>{c.platform}</Badge>
              {s === "internal" && <Badge tone="warn">Needs your review</Badge>}
              {s === "client" && <Badge tone="warn">With the client</Badge>}
              <Badge tone={contentTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>

            </Link>
          );
        })}
      </div>

      {list.data && list.data.last_page > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 22, fontSize: 13, color: p.muted }}>
          <Btn small onClick={() => setPage((n) => n - 1)} disabled={page <= 1}>← Previous</Btn>
          <span>Page {list.data.current_page} of {list.data.last_page}</span>
          <Btn small onClick={() => setPage((n) => n + 1)} disabled={page >= list.data.last_page}>Next →</Btn>
        </div>
      )}
    </div>
  );
}