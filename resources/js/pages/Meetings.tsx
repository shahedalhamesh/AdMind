import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { fmtDateTime, localToIso } from "../services/content";
import { MEETING_STATUS_LABEL, meetingsApi } from "../services/meetings";
import QuickRecordMeeting from "../components/QuickRecordMeeting";
import { Badge, Btn, Field, Loading, Modal, Notice, Select, TextArea, TextInput, errorText, fieldError } from "../components/Ui";

export default function Meetings() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [params, setParams] = useSearchParams();
  const [recording, setRecording] = useState(params.get("record") === "1");
  const closeRecord = () => {
    setRecording(false);
    if (params.get("record")) {
      params.delete("record");
      setParams(params, { replace: true });
    }
  };

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const name = new Map((clients.data ?? []).map((c) => [c.id, c.name]));
  const list = useQuery({ queryKey: ["meetings", { clientId, status, page }], queryFn: () => meetingsApi.list({ client_id: clientId, status, page, per_page: 20 }) });
  const items = list.data?.data ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Meetings</p>
          <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Meetings</h1>
        </div>
        {can(user, "agents.run") && (
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={() => setRecording(true)}>● Record a meeting</Btn>
            <Btn variant="primary" onClick={() => setCreating(true)}>+ New meeting</Btn>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "22px 0 18px" }}>
        <div style={{ width: 220 }}>
          <Select aria-label="Filter by client" value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }}>
            <option value="">All clients</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div style={{ width: 180 }}>
          <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {Object.entries(MEETING_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      </div>

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && items.length === 0 && <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>No meetings yet.</div>}

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((m) => (
          <Link key={m.id} to={`/meetings/${m.id}`} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "16px 18px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card, color: p.text, textDecoration: "none" }}>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <div dir="auto" style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{m.title}</div>
              <div style={{ marginTop: 4, fontSize: 13, color: p.muted }}>{[name.get(m.client_id), m.held_at ? fmtDateTime(m.held_at) : ""].filter(Boolean).join(" · ")}</div>
            </div>
            {m.proposed_count > 0 && <Badge tone="warn">{m.proposed_count} to decide</Badge>}
            <Badge tone={m.status === "summarized" ? "good" : m.status === "failed" ? "bad" : "plain"}>{MEETING_STATUS_LABEL[m.status] ?? m.status}</Badge>
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

      {creating && <NewMeeting defaultClient={clientId} onClose={() => setCreating(false)} />}
      {recording && <QuickRecordMeeting defaultClient={clientId} onClose={closeRecord} />}
    </div>
  );
}

function NewMeeting({ defaultClient, onClose }: { defaultClient: string; onClose: () => void }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const [clientId, setClientId] = useState(defaultClient);
  const [title, setTitle] = useState("");
  const [heldAt, setHeldAt] = useState("");
  const [transcript, setTranscript] = useState("");

  const create = useMutation({
    mutationFn: () => meetingsApi.create({ client_id: Number(clientId), title: title.trim(), ...(heldAt ? { held_at: localToIso(heldAt) } : {}), ...(transcript.trim() ? { transcript } : {}) }),
    onSuccess: (m) => { qc.invalidateQueries({ queryKey: ["meetings"] }); nav(`/meetings/${m.id}`); },
  });

  return (
    <Modal title="New meeting" onClose={onClose} width={620}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} style={{ display: "grid", gap: 14 }}>
        <Field label="Client *" error={fieldError(create.error, "client_id")}>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Choose…</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Title *" error={fieldError(create.error, "title")}><TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} dir="auto" required /></Field>
        <Field label="When" error={fieldError(create.error, "held_at")}><TextInput type="datetime-local" value={heldAt} onChange={(e) => setHeldAt(e.target.value)} /></Field>
        <Field label="Transcript" hint="Paste the text of the meeting, or leave it empty and record or upload audio on the next page." error={fieldError(create.error, "transcript")}>
          <TextArea value={transcript} onChange={(e) => setTranscript(e.target.value)} maxLength={50000} dir="auto" rows={6} />
        </Field>
        {create.isError && <Notice kind="error">{errorText(create.error)}</Notice>}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" type="submit" disabled={create.isPending || !clientId || !title.trim()}>{create.isPending ? "Creating…" : "Create"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}