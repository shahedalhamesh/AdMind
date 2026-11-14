import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { CONTENT_PLATFORMS, CONTENT_STATUSES, CONTENT_TYPES, STATUS_LABEL, contentApi, contentTone, publishApi } from "../services/content";
import PublishJobCard from "../components/content/PublishJobCard";
import { Badge, Btn, Loading, Notice, Select, errorText } from "../components/Ui";

type Tab = "content" | "scheduled";
const JOB_FILTERS = [
  { id: "pending", label: "Waiting to be posted" },
  { id: "overdue", label: "Overdue" },
  { id: "published", label: "Posted" },
  { id: "cancelled", label: "Cancelled" },
];

export default function Content() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("content");

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}), enabled: can(user, "clients.view") });
  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.name])), [clients.data]);

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Content</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Content</h1>

      <div role="tablist" style={{ display: "flex", gap: 6, margin: "24px 0 20px", borderBottom: `1px solid ${p.border}` }}>
        {([["content", "All content"], ["scheduled", "Scheduled posts"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
            style={{ padding: "11px 16px", border: 0, borderBottom: `2px solid ${tab === id ? p.pri : "transparent"}`, background: "transparent", color: tab === id ? p.text : p.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "content" ? <ContentList clientName={clientName} clients={clients.data ?? []} /> : <ScheduledList clientName={clientName} clients={clients.data ?? []} />}
    </div>
  );
}

function ContentList({ clientName, clients }: { clientName: Map<number, string>; clients: { id: number; name: string }[] }) {
  const { p } = usePortalTheme();
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [platform, setPlatform] = useState("");
  const [page, setPage] = useState(1);

  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const list = useQuery({
    queryKey: ["content-list", { clientId, status, type, platform, page }],
    queryFn: () => contentApi.list({ client_id: clientId, status, type, platform, page, per_page: 20 }),
  });
  const items = list.data?.data ?? [];

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ width: 200 }}>
          <Select aria-label="Filter by client" value={clientId} onChange={(e) => reset(setClientId)(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div style={{ width: 180 }}>
          <Select aria-label="Filter by status" value={status} onChange={(e) => reset(setStatus)(e.target.value)}>
            <option value="">All statuses</option>
            {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
        </div>
        <div style={{ width: 150 }}>
          <Select aria-label="Filter by type" value={type} onChange={(e) => reset(setType)(e.target.value)}>
            <option value="">All types</option>
            {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </Select>
        </div>
        <div style={{ width: 160 }}>
          <Select aria-label="Filter by platform" value={platform} onChange={(e) => reset(setPlatform)(e.target.value)}>
            <option value="">All platforms</option>
            {CONTENT_PLATFORMS.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </Select>
        </div>
      </div>

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && items.length === 0 && (
        <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>No content found.</div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((c) => (
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
            <Badge tone={contentTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
          </Link>
        ))}
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

function ScheduledList({ clientName, clients }: { clientName: Map<number, string>; clients: { id: number; name: string }[] }) {
  const { p } = usePortalTheme();
  const [filter, setFilter] = useState("pending");
  const [clientId, setClientId] = useState("");

  const list = useQuery({
    queryKey: ["publish-jobs", { filter, clientId }],
    queryFn: () =>
      publishApi.list({
        client_id: clientId,
        per_page: 100,
        ...(filter === "overdue" ? { overdue: "1" } : { status: filter }),
      }),
  });
  const jobs = list.data?.data ?? [];

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ width: 220 }}>
          <Select aria-label="Filter posts" value={filter} onChange={(e) => setFilter(e.target.value)}>
            {JOB_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </Select>
        </div>
        <div style={{ width: 200 }}>
          <Select aria-label="Filter by client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </div>

      <p style={{ margin: "0 0 16px", fontSize: 13, color: p.muted, lineHeight: 1.5 }}>
        Posting is done by hand for now: at the scheduled time the team posts the content, then marks it as published here. Late posts are marked in red.
      </p>

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && jobs.length === 0 && (
        <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>Nothing here.</div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {jobs.map((j) => <PublishJobCard key={j.id} job={j} clientName={j.content ? clientName.get(j.content.client_id) : undefined} />)}
      </div>
    </div>
  );
}