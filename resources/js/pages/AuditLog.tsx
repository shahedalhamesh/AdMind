import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { auditApi } from "../services/audit";
import type { AuditEntry, AuditFilters } from "../services/audit";
import { fmtDateTime } from "../services/content";
import { Badge, Btn, Loading, Notice, Select, TextInput, errorText } from "../components/Ui";

const EMPTY: AuditFilters = { actor_id: "", action: "", subject_type: "", result: "", from: "", to: "", page: 1 };

export default function AuditLog() {
  const { p } = usePortalTheme();
  const [f, setF] = useState<AuditFilters>(EMPTY);
  const [openId, setOpenId] = useState<number | null>(null);

  const staff = useQuery({ queryKey: ["staff-list"], queryFn: clientsApi.staff });
  const list = useQuery({ queryKey: ["audit", f], queryFn: () => auditApi.list(f) });
  const rows = list.data?.data ?? [];

  const set = (patch: Partial<AuditFilters>) => setF((old) => ({ ...old, page: 1, ...patch }));

  const th: React.CSSProperties = { textAlign: "start", padding: "10px 12px", fontSize: 12, color: p.muted, fontWeight: 600, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 14, verticalAlign: "top" };

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Settings</p>
      <h1 style={{ margin: "10px 0 6px", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Activity log</h1>
      <p style={{ margin: "0 0 22px", color: p.muted, fontSize: 15, maxWidth: 640, lineHeight: 1.6 }}>
        Every change made by your team is saved here: who did it, what it was, and when. Only the owner can see this page.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div style={{ width: 200 }}>
          <Select aria-label="Person" value={f.actor_id} onChange={(e) => set({ actor_id: e.target.value })}>
            <option value="">Everyone</option>
            {(staff.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </div>
        <div style={{ width: 160 }}>
          <TextInput aria-label="Action" placeholder="Action (e.g. create)" value={f.action} onChange={(e) => set({ action: e.target.value })} />
        </div>
        <div style={{ width: 160 }}>
          <TextInput aria-label="Type" placeholder="Type (e.g. content)" value={f.subject_type} onChange={(e) => set({ subject_type: e.target.value })} />
        </div>
        <div style={{ width: 150 }}>
          <Select aria-label="Result" value={f.result} onChange={(e) => set({ result: e.target.value })}>
            <option value="">Any result</option>
            <option value="success">Success</option>
            <option value="denied">Denied</option>
            <option value="failed">Failed</option>
          </Select>
        </div>
        <div style={{ width: 160 }}>
          <TextInput aria-label="From" type="date" lang="en-US" value={f.from} onChange={(e) => set({ from: e.target.value })} />
        </div>
        <div style={{ width: 160 }}>
          <TextInput aria-label="To" type="date" lang="en-US" value={f.to} onChange={(e) => set({ to: e.target.value })} />
        </div>
        <Btn onClick={() => setF(EMPTY)}>Clear</Btn>
      </div>

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && rows.length === 0 && (
        <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>Nothing found.</div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${p.border}` }}>
                <th style={th}>When</th>
                <th style={th}>Person</th>
                <th style={th}>Action</th>
                <th style={th}>On</th>
                <th style={th}>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: AuditEntry) => (
                <Row key={r.id} r={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} td={td} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.data && list.data.last_page > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 22, fontSize: 13, color: p.muted }}>
          <Btn small onClick={() => setF((o) => ({ ...o, page: o.page - 1 }))} disabled={f.page <= 1}>← Previous</Btn>
          <span>Page {list.data.current_page} of {list.data.last_page}</span>
          <Btn small onClick={() => setF((o) => ({ ...o, page: o.page + 1 }))} disabled={f.page >= list.data.last_page}>Next →</Btn>
        </div>
      )}
    </div>
  );
}

function Row({ r, open, onToggle, td }: { r: AuditEntry; open: boolean; onToggle: () => void; td: React.CSSProperties }) {
  const { p } = usePortalTheme();
  const tone = r.result === "success" ? undefined : r.result === "denied" ? "warn" : "bad";
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer", borderBottom: `1px solid ${p.border}` }}>
        <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDateTime(r.created_at)}</td>
        <td style={td}>{r.actor?.name ?? "—"}</td>
        <td style={td}>{r.action}</td>
        <td style={td}>{r.subject_type ? `${r.subject_type}${r.subject_id ? ` #${r.subject_id}` : ""}` : "—"}</td>
        <td style={td}><Badge tone={tone}>{r.result}</Badge></td>
      </tr>
      {open && (
        <tr style={{ borderBottom: `1px solid ${p.border}` }}>
          <td colSpan={5} style={{ ...td, background: p.field }}>
            <div style={{ fontSize: 12, color: p.muted, marginBottom: 6 }}>
              {r.changes?.method} {r.changes?.path} {r.changes?.status ? `· status ${r.changes.status}` : ""} {r.ip_address ? `· ${r.ip_address}` : ""}
            </div>
            <pre dir="ltr" style={{ margin: 0, fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(r.changes?.input ?? {}, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}