import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { usersApi } from "../services/users";
import { agentApi } from "../services/agent";
import { localToIso } from "../services/content";
import { AGENT_NAMES, TASK_PRIORITIES } from "../services/tasks";
import { recommendationsApi } from "../services/recommendations";
import type { Recommendation } from "../services/recommendations";
import { Badge, Btn, Card, Field, Loading, Modal, Notice, Select, TextInput, errorText } from "../components/Ui";

const PRIORITY_TONE = { high: "bad", medium: "warn", low: "plain" } as const;

export default function Recommendations() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("new");
  const [days, setDays] = useState("30");
  const [language, setLanguage] = useState<"Arabic" | "English">("Arabic");
  const [runId, setRunId] = useState<number | null>(null);
  const [accepting, setAccepting] = useState<Recommendation | null>(null);

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const list = useQuery({ queryKey: ["recommendations", { clientId, status }], queryFn: () => recommendationsApi.list({ client_id: clientId, status, per_page: 50 }), enabled: !!clientId });
  const items = list.data?.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["recommendations"] });

  const generate = useMutation({ mutationFn: () => recommendationsApi.generate({ client_id: Number(clientId), days: Number(days), language }), onSuccess: (r) => setRunId(r.agent_run_id) });
  // the AI needs about a minute: ask every 3 seconds until it is done
  const run = useQuery({ queryKey: ["agent-run", runId], queryFn: () => agentApi.run(runId as number), enabled: runId !== null, refetchInterval: (s) => (!s.state.data || s.state.data.status === "running" ? 3000 : false) });
  useEffect(() => { if (runId !== null && run.data && run.data.status !== "running") { refresh(); } }, [run.data, runId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useMutation({ mutationFn: (id: number) => recommendationsApi.dismiss(id), onSuccess: refresh });
  const working = generate.isPending || (runId !== null && (!run.data || run.data.status === "running"));
  const failed = run.data?.status === "failed";

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Recommendations</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Recommendations</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: p.muted }}>The AI reads the client's performance numbers and suggests what to do next.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "22px 0 18px", alignItems: "center" }}>
        <div style={{ width: 240 }}>
          <Select aria-label="Client" value={clientId} onChange={(e) => { setClientId(e.target.value); setRunId(null); generate.reset(); }}>
            <option value="">Choose a client…</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div style={{ width: 160 }}>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="new">New</option><option value="accepted">Accepted</option><option value="dismissed">Dismissed</option>
          </Select>
        </div>
      </div>

      {can(user, "agents.run") && clientId && (
        <Card style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ width: 170 }}>
              <Select aria-label="Period" value={days} onChange={(e) => setDays(e.target.value)} disabled={working}>
                <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="180">Last 180 days</option>
              </Select>
            </div>
            <div style={{ width: 140 }}>
              <Select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as "Arabic" | "English")} disabled={working}>
                <option value="Arabic">Arabic</option><option value="English">English</option>
              </Select>
            </div>
            <Btn variant="primary" onClick={() => { setRunId(null); generate.mutate(); }} disabled={working}>{working ? "The AI is working…" : "Generate recommendations"}</Btn>
          </div>
          {working && <div style={{ marginTop: 12, fontSize: 13, color: p.muted }}>This takes about a minute.</div>}
          {generate.isError && <div style={{ marginTop: 12 }}><Notice kind="error">{errorText(generate.error)} If it says there are no numbers, add them first in <Link to="/reports" style={{ fontWeight: 600 }}>Reports → Numbers</Link>.</Notice></div>}
          {failed && <div style={{ marginTop: 12 }}><Notice kind="error">{run.data?.error ?? "The AI could not finish. Try again later."}</Notice></div>}
        </Card>
      )}

      {!clientId && <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>Choose a client first.</div>}
      {clientId && list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && items.length === 0 && <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>Nothing here.</div>}

      <div style={{ display: "grid", gap: 14 }}>
        {items.map((r) => (
          <Card key={r.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <h3 dir="auto" style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500, overflowWrap: "anywhere" }}>{r.based_on?.title ?? "Recommendation"}</h3>
              {r.based_on?.priority && <Badge tone={PRIORITY_TONE[r.based_on.priority]}>{r.based_on.priority}</Badge>}
            </div>
            <div dir="auto" style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.7, overflowWrap: "anywhere" }}>{r.recommendation}</div>
            {r.based_on?.reason && <div dir="auto" style={{ marginTop: 10, fontSize: 13, color: p.muted, lineHeight: 1.6 }}><strong>Why:</strong> {r.based_on.reason}</div>}
            {r.based_on?.period && <div style={{ marginTop: 6, fontSize: 12, color: p.muted }}>Based on {r.based_on.period.start} → {r.based_on.period.end}</div>}
            {r.status === "new" && can(user, "tasks.assign") && (
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <Btn small variant="primary" onClick={() => setAccepting(r)}>Accept as a task</Btn>
                <Btn small onClick={() => dismiss.mutate(r.id)} disabled={dismiss.isPending}>Dismiss</Btn>
              </div>
            )}
            {r.status === "accepted" && <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}><Badge tone="good">Task created</Badge><Link to="/tasks" style={{ color: p.link, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Tasks →</Link></div>}
            {r.status === "dismissed" && <div style={{ marginTop: 12 }}><Badge>Dismissed</Badge></div>}
          </Card>
        ))}
      </div>
      {dismiss.isError && <div style={{ marginTop: 12 }}><Notice kind="error">{errorText(dismiss.error)}</Notice></div>}
      {accepting && <AcceptModal rec={accepting} onClose={() => setAccepting(null)} onDone={() => { setAccepting(null); refresh(); }} />}
    </div>
  );
}

function AcceptModal({ rec, onClose, onDone }: { rec: Recommendation; onClose: () => void; onDone: () => void }) {
  const users = useQuery({ queryKey: ["users", { q: "", role_id: "", status: "active" }], queryFn: () => usersApi.list({ status: "active" }) });
  const staff = (users.data ?? []).filter((u) => u.client_id === null);
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState(rec.based_on?.priority ?? "medium");

  const accept = useMutation({
    mutationFn: () => {
      const [kind, value] = assignee.split(":");
      return recommendationsApi.accept(rec.id, {
        priority,
        ...(due ? { due_at: localToIso(due) } : {}),
        ...(kind === "user" ? { assignee_user_id: Number(value) } : {}),
        ...(kind === "agent" ? { assignee_agent: value } : {}),
      });
    },
    onSuccess: onDone,
  });

  return (
    <Modal title="Accept as a task" onClose={onClose} width={480}>
      <form onSubmit={(e) => { e.preventDefault(); accept.mutate(); }} style={{ display: "grid", gap: 14 }}>
        <div dir="auto" style={{ fontSize: 14, fontWeight: 600 }}>{rec.based_on?.title}</div>
        <Field label="Assign to">
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Nobody yet</option>
            <optgroup label="Team">{staff.map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name}</option>)}</optgroup>
            <optgroup label="AI agent">{AGENT_NAMES.map((a) => <option key={a} value={`agent:${a}`}>AI · {a}</option>)}</optgroup>
          </Select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}>{TASK_PRIORITIES.map((x) => <option key={x} value={x}>{x}</option>)}</Select></Field>
          <Field label="Due"><TextInput type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        {accept.isError && <Notice kind="error">{errorText(accept.error)}</Notice>}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" type="submit" disabled={accept.isPending}>{accept.isPending ? "Creating…" : "Create the task"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}