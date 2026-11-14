import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { fmtDateTime } from "../services/content";
import { SUBSCRIPTION_STATUSES, platformApi } from "../services/platform";
import type { Company, SubscriptionStatus } from "../services/platform";
import { PortalShell } from "./Portal";
import { Badge, Btn, Loading, Notice, Select, TextInput, errorText } from "../components/Ui";

const tone = (s: SubscriptionStatus) => (s === "active" ? "good" : s === "trial" ? "warn" : "bad") as "good" | "warn" | "bad";

// The platform owner's page: every agency using AdMind, and its subscription status.
export default function Platform() {
  const { p } = usePortalTheme();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const list = useQuery({ queryKey: ["admin-companies", { status, q, page }], queryFn: () => platformApi.list({ status, q, page, per_page: 20 }) });
  const rows = list.data?.data ?? [];

  const change = useMutation({
    mutationFn: (v: { c: Company; s: SubscriptionStatus }) => platformApi.setStatus(v.c.id, v.s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-companies"] }),
  });

  const onChange = (c: Company, s: SubscriptionStatus) => {
    if (s === c.subscription_status) return;
    if ((s === "suspended" || s === "cancelled") && !window.confirm(`Set ${c.name} to ${s}? Everyone in this company is signed out at once.`)) return;
    change.mutate({ c, s });
  };

  return (
    <PortalShell>
      <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Agencies</h1>
      <p style={{ margin: "8px 0 0", fontSize: 15, color: p.muted }}>Every agency that uses AdMind, and its subscription.</p>

      <form onSubmit={(e) => { e.preventDefault(); setQ(search.trim()); setPage(1); }} style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "22px 0 18px" }}>
        <div style={{ width: 240 }}><TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" aria-label="Search" /></div>
        <div style={{ width: 180 }}>
          <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        <Btn type="submit">Search</Btn>
      </form>

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {change.isError && <div style={{ marginBottom: 14 }}><Notice kind="error">{errorText(change.error)}</Notice></div>}
      {list.isSuccess && rows.length === 0 && <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>No agencies found.</div>}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "16px 18px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div dir="auto" style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{c.name}</div>
              <div style={{ marginTop: 4, fontSize: 13, color: p.muted }}>
                {[c.plan ? `Plan: ${c.plan}` : "", `${c.staff_count} staff`, `${c.clients_count} clients`, `Joined ${fmtDateTime(c.created_at)}`].filter(Boolean).join(" · ")}
              </div>
              {c.subscription_ends_at && <div style={{ marginTop: 2, fontSize: 12, color: p.muted }}>Ends {fmtDateTime(c.subscription_ends_at)}</div>}
            </div>
            <Badge tone={tone(c.subscription_status)}>{c.subscription_status}</Badge>
            <div style={{ width: 150 }}>
              <Select aria-label={`Status of ${c.name}`} value={c.subscription_status} onChange={(e) => onChange(c, e.target.value as SubscriptionStatus)} disabled={change.isPending}>
                {SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>
        ))}
      </div>

      {list.data && list.data.last_page > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 22, fontSize: 13, color: p.muted }}>
          <Btn small onClick={() => setPage((n) => n - 1)} disabled={page <= 1}>← Previous</Btn>
          <span>Page {list.data.current_page} of {list.data.last_page}</span>
          <Btn small onClick={() => setPage((n) => n + 1)} disabled={page >= list.data.last_page}>Next →</Btn>
        </div>
      )}
    </PortalShell>
  );
}