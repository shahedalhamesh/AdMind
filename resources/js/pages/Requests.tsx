import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { usersApi } from "../services/users";
import { fmtDateTime, localToIso } from "../services/content";
import { AGENT_NAMES } from "../services/tasks";
import { REQUEST_PRIORITIES, STAFF_LABEL, cap, clientRequestsApi, requestTone } from "../services/clientRequests";
import type { ClientRequest, RequestStatus } from "../services/clientRequests";
import { Badge, Btn, Field, Loading, Modal, Notice, Select, TextArea, TextInput, errorText, fieldError } from "../components/Ui";

const STATUSES: RequestStatus[] = ["new", "in_progress", "completed", "rejected"];

export default function Requests() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const [status, setStatus] = useState<string>("new");
  const [clientId, setClientId] = useState("");
  const [page, setPage] = useState(1);
  const [converting, setConverting] = useState<ClientRequest | null>(null);
  const [declining, setDeclining] = useState<ClientRequest | null>(null);

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const list = useQuery({
    queryKey: ["client-requests", { status, clientId, page }],
    queryFn: () => clientRequestsApi.list({ status, client_id: clientId, page, per_page: 20 }),
    refetchInterval: 30000,
  });
  const items = list.data?.data ?? [];
  const canHandle = can(user, "tasks.assign");

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Requests</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Client requests</h1>
      <p style={{ margin: "8px 0 0", fontSize: 15, color: p.muted, maxWidth: 640 }}>What your clients ask for from their portal. Turn a request into a task, or decline it with a reason.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "22px 0 18px" }}>
        <div style={{ width: 200 }}>
          <Select aria-label="Filter by client" value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }}>
            <option value="">All clients</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div style={{ width: 170 }}>
          <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STAFF_LABEL[s]}</option>)}
          </Select>
        </div>
      </div>

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && items.length === 0 && <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>No requests here.</div>}

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((r) => (
          <div key={r.id} style={{ display: "grid", gap: 10, padding: "16px 18px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span dir="auto" style={{ fontSize: 17, fontWeight: 600, overflowWrap: "anywhere" }}>{r.subject}</span>
              <Badge tone={requestTone(r.status)}>{STAFF_LABEL[r.status] ?? r.status}</Badge>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 13, color: p.muted }}>
              {r.client && <Link to={`/clients/${r.client.id}`} style={{ color: p.link, fontWeight: 600, textDecoration: "none" }}>{r.client.name}</Link>}
              <Badge>{cap(r.type)}</Badge>
              <Badge tone={r.priority === "urgent" || r.priority === "high" ? "bad" : "plain"}>{cap(r.priority)}</Badge>
              <span>{fmtDateTime(r.created_at)}</span>
            </div>
            {r.description && <div dir="auto" style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, overflowWrap: "anywhere" }}>{r.description}</div>}
            {r.task && <div style={{ fontSize: 13, color: p.muted }}>Task: <Link to="/tasks" style={{ color: p.link, fontWeight: 600, textDecoration: "none" }}>{r.task.title}</Link> ({r.task.status.replace(/_/g, " ")})</div>}
            {r.status === "new" && canHandle && (
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small variant="primary" onClick={() => setConverting(r)}>Turn into a task</Btn>
                <Btn small variant="danger" onClick={() => setDeclining(r)}>Decline</Btn>
              </div>
            )}
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

      {converting && <ConvertModal r={converting} onClose={() => setConverting(null)} />}
      {declining && <DeclineModal r={declining} onClose={() => setDeclining(null)} />}
    </div>
  );
}

function ConvertModal({ r, onClose }: { r: ClientRequest; onClose: () => void }) {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users", { q: "", role_id: "", status: "active" }], queryFn: () => usersApi.list({ status: "active" }) });
  const staff = (users.data ?? []).filter((u) => u.client_id === null);

  const [title, setTitle] = useState(r.subject);
  const [assignee, setAssignee] = useState(""); // "user:5" | "agent:content" | ""
  const [priority, setPriority] = useState(r.priority);
  const [due, setDue] = useState("");

  const convert = useMutation({
    mutationFn: () => {
      const [kind, value] = assignee.split(":");
      return clientRequestsApi.convert(r.id, {
        ...(title.trim() && title.trim() !== r.subject ? { title: title.trim() } : {}),
        priority,
        ...(due ? { due_at: localToIso(due) } : {}),
        ...(kind === "user" ? { assignee_user_id: Number(value) } : {}),
        ...(kind === "agent" ? { assignee_agent: value } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-requests"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      onClose();
    },
  });

  return (
    <Modal title="Turn this request into a task" onClose={onClose} width={520}>
      <form onSubmit={(e) => { e.preventDefault(); convert.mutate(); }} style={{ display: "grid", gap: 14 }}>
        <Field label="Task title" error={fieldError(convert.error, "title")}><TextInput value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" maxLength={255} /></Field>
        <Field label="Assign to" hint="You can leave it empty and assign later." error={fieldError(convert.error, "assignee_user_id") || fieldError(convert.error, "assignee_agent")}>
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Nobody yet</option>
            <optgroup label="Team">{staff.map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name}</option>)}</optgroup>
            <optgroup label="AI agent">{AGENT_NAMES.map((a) => <option key={a} value={`agent:${a}`}>AI · {a}</option>)}</optgroup>
          </Select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Priority" error={fieldError(convert.error, "priority")}>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>{REQUEST_PRIORITIES.map((x) => <option key={x} value={x}>{cap(x)}</option>)}</Select>
          </Field>
          <Field label="Due" error={fieldError(convert.error, "due_at")}><TextInput type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        {convert.isError && <Notice kind="error">{errorText(convert.error)}</Notice>}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" type="submit" disabled={convert.isPending}>{convert.isPending ? "Creating…" : "Create task"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}

function DeclineModal({ r, onClose }: { r: ClientRequest; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const reject = useMutation({
    mutationFn: () => clientRequestsApi.reject(r.id, reason.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-requests"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      onClose();
    },
  });
  return (
    <Modal title="Decline this request" onClose={onClose} width={500}>
      <form onSubmit={(e) => { e.preventDefault(); reject.mutate(); }} style={{ display: "grid", gap: 14 }}>
        <Field label="Reason (the client will see it)" error={fieldError(reject.error, "reason")}><TextArea value={reason} onChange={(e) => setReason(e.target.value)} dir="auto" /></Field>
        {reject.isError && <Notice kind="error">{errorText(reject.error)}</Notice>}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="danger" type="submit" disabled={reject.isPending}>{reject.isPending ? "Declining…" : "Decline"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}