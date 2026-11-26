import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { contentApi } from "../services/content";
import { GOAL_LABEL, GOAL_PERIODS, METRIC_NAMES, goalTone, num, reportsApi, today } from "../services/reports";
import type { Goal, ReportData } from "../services/reports";
import { Badge, Btn, Card, Field, Loading, Modal, Notice, Select, TextInput, errorText, fieldError } from "../components/Ui";

type Tab = "reports" | "numbers" | "goals";

const day = (v?: string | null) => {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

export default function Reports() {
  const { p } = usePortalTheme();
  const [clientId, setClientId] = useState("");
  const [tab, setTab] = useState<Tab>("reports");
  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Reports</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Reports</h1>

      <div style={{ width: 260, margin: "22px 0 8px" }}>
        <Select aria-label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Choose a client…</option>
          {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      <div role="tablist" style={{ display: "flex", gap: 6, margin: "16px 0 20px", borderBottom: `1px solid ${p.border}` }}>
        {([["reports", "Reports"], ["numbers", "Numbers"], ["goals", "Goals"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
            style={{ padding: "11px 16px", border: 0, borderBottom: `2px solid ${tab === id ? p.pri : "transparent"}`, background: "transparent", color: tab === id ? p.text : p.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {!clientId ? (
        <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>Choose a client first.</div>
      ) : tab === "reports" ? <ReportsTab clientId={clientId} /> : tab === "numbers" ? <NumbersTab clientId={clientId} /> : <GoalsTab clientId={clientId} />}
    </div>
  );
}

/* ---------- Reports ---------- */
function ReportsTab({ clientId }: { clientId: string }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today());
  const [topMetric, setTopMetric] = useState("reach");
  const [share, setShare] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const list = useQuery({ queryKey: ["reports", clientId], queryFn: () => reportsApi.list(clientId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["reports", clientId] });
  const generate = useMutation({
    mutationFn: () => reportsApi.generate({ client_id: Number(clientId), period_start: from, period_end: to, top_metric: topMetric, visible_to_client: share }),
    onSuccess: (r) => { refresh(); setOpenId(r.id); },
  });
  const toggle = useMutation({ mutationFn: (v: { id: number; on: boolean }) => reportsApi.setVisibility(v.id, v.on), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => reportsApi.remove(id), onSuccess: refresh });

  return (
    <div style={{ display: "grid", gap: 22 }}>
      {can(user, "reports.create") && (
        <Card>
          <h3 style={{ margin: "0 0 14px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Generate a report</h3>
          <form onSubmit={(e) => { e.preventDefault(); generate.mutate(); }} style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", alignItems: "end" }}>
            <Field label="From *" error={fieldError(generate.error, "period_start")}><TextInput type="date" value={from} max={today()} onChange={(e) => setFrom(e.target.value)} required /></Field>
            <Field label="To *" error={fieldError(generate.error, "period_end")}><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} required /></Field>
            <Field label="Rank content by" error={fieldError(generate.error, "top_metric")}>
              <Select value={topMetric} onChange={(e) => setTopMetric(e.target.value)}>{METRIC_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}</Select>
            </Field>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, paddingBottom: 12 }}>
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Share with the client
            </label>
            <div><Btn variant="primary" type="submit" disabled={generate.isPending || !from || !to}>{generate.isPending ? "Generating…" : "Generate"}</Btn></div>
          </form>
          {generate.isError && <div style={{ marginTop: 12 }}><Notice kind="error">{errorText(generate.error)}</Notice></div>}
        </Card>
      )}

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && (list.data ?? []).length === 0 && <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>No reports yet.</div>}
      <div style={{ display: "grid", gap: 10 }}>
        {(list.data ?? []).map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 18px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
            <button type="button" onClick={() => setOpenId(r.id)} style={{ flex: "1 1 220px", textAlign: "start", border: 0, background: "transparent", color: p.text, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
              Report #{r.id}{r.period_start && r.period_end ? ` · ${day(r.period_start)} → ${day(r.period_end)}` : ""}
            </button>
            <Badge tone={r.visible_to_client ? "good" : "plain"}>{r.visible_to_client ? "Shared with the client" : "Private"}</Badge>
            {can(user, "reports.update") && <Btn small onClick={() => toggle.mutate({ id: r.id, on: !r.visible_to_client })} disabled={toggle.isPending}>{r.visible_to_client ? "Stop sharing" : "Share with the client"}</Btn>}
            {can(user, "reports.delete") && <Btn small variant="danger" onClick={() => { if (window.confirm("Delete this report?")) remove.mutate(r.id); }} disabled={remove.isPending}>Delete</Btn>}
          </div>
        ))}
      </div>
      {(toggle.isError || remove.isError) && <Notice kind="error">{errorText(toggle.error ?? remove.error)}</Notice>}
      {openId !== null && <ReportView id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ReportView({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({ queryKey: ["report", id], queryFn: () => reportsApi.get(id) });
  return (
    <Modal title={`Report #${id}`} onClose={onClose} width={820}>
      {q.isLoading && <Loading />}
      {q.isError && <Notice kind="error">{errorText(q.error)}</Notice>}
      {q.data && <ReportBody d={q.data.data} />}
    </Modal>
  );
}

export function ReportBody({ d }: { d: ReportData }) {
  const { p } = usePortalTheme();
  const h = (t: string) => <h3 style={{ margin: "22px 0 10px", fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500 }}>{t}</h3>;
  const totals = Object.entries(d.totals ?? {});
  const platforms = Object.entries(d.by_platform ?? {});
  const metrics = Array.from(new Set(platforms.flatMap(([, m]) => Object.keys(m))));
  const max = Math.max(1, ...totals.map(([, v]) => Number(v)));

  return (
    <div>
      <div style={{ fontSize: 14, color: p.muted }}>{d.client?.name} · {day(d.period?.start)} → {day(d.period?.end)}</div>
      {!d.has_metrics && <div style={{ marginTop: 14 }}><Notice kind="warning">There are no numbers for this period. Add them in the Numbers tab, then generate again.</Notice></div>}

      {totals.length > 0 && <>
        {h("Totals")}
        <div style={{ display: "grid", gap: 10 }}>
          {totals.map(([k, v]) => (
            <div key={k}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{k}</span><strong>{num(v)}</strong></div>
              <div style={{ height: 8, borderRadius: 4, background: p.border, marginTop: 4 }}><div style={{ height: 8, borderRadius: 4, width: `${(Number(v) / max) * 100}%`, background: p.pri }} /></div>
            </div>
          ))}
        </div>
      </>}

      {platforms.length > 0 && <>
        {h("By platform")}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr><th style={{ textAlign: "start", padding: 6 }}>Platform</th>{metrics.map((m) => <th key={m} style={{ textAlign: "end", padding: 6 }}>{m}</th>)}</tr></thead>
            <tbody>{platforms.map(([pl, vals]) => <tr key={pl} style={{ borderTop: `1px solid ${p.border}` }}><td style={{ padding: 6 }}>{pl}</td>{metrics.map((m) => <td key={m} style={{ textAlign: "end", padding: 6 }}>{vals[m] !== undefined ? num(vals[m]) : "–"}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </>}

      {h(`Content (${d.content?.published_count ?? 0} published)`)}
      {(d.content?.top ?? []).length === 0 ? <span style={{ fontSize: 14, color: p.muted }}>No ranked content.</span> : (
        <div style={{ display: "grid", gap: 8 }}>
          {d.content.top.map((t, i) => <div key={t.content_id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}><span dir="auto">{i + 1}. {t.title}</span><strong>{num(t.value)} {d.content.top_by}</strong></div>)}
        </div>
      )}

      {(d.goals ?? []).length > 0 && <>{h("Goals")}<GoalList goals={d.goals} /></>}

      {(d.campaigns ?? []).length > 0 && <>
        {h("Campaigns")}
        <div style={{ display: "grid", gap: 8 }}>
          {d.campaigns.map((c) => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}><span>{c.name} <Badge>{c.status}</Badge></span><span>{c.spent} / {c.budget} {c.currency}</span></div>)}
        </div>
      </>}
    </div>
  );
}

function GoalList({ goals, onDelete }: { goals: Goal[]; onDelete?: (g: Goal) => void }) {
  const { p } = usePortalTheme();
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {goals.map((g) => (
        <div key={g.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 14 }}>
            <span><strong>{g.metric}</strong> · {num(g.current)} / {num(g.target_value)} ({g.period})</span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge tone={goalTone(g.status)}>{GOAL_LABEL[g.status] ?? g.status}</Badge>
              {onDelete && <Btn small variant="danger" onClick={() => onDelete(g)}>Delete</Btn>}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: p.border, margin: "6px 0 4px" }}><div style={{ height: 8, borderRadius: 4, width: `${Math.min(100, Math.max(0, g.progress_pct))}%`, background: p.pri }} /></div>
          <div style={{ fontSize: 12, color: p.muted }}>{Math.round(g.progress_pct)}% · {day(g.starts_on)} → {day(g.ends_on)}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Numbers ---------- */
function NumbersTab({ clientId }: { clientId: string }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subject, setSubject] = useState(""); // "account:3" | "content:5"
  const [metric, setMetric] = useState("reach");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today());

  const accounts = useQuery({ queryKey: ["client-social", Number(clientId)], queryFn: () => clientsApi.accounts(Number(clientId)) });
  const content = useQuery({ queryKey: ["content-list", { clientId, forNumbers: true }], queryFn: () => contentApi.list({ client_id: clientId, status: "published", per_page: 100 }) });
  const saved = useQuery({ queryKey: ["metrics", clientId], queryFn: () => reportsApi.metrics({ client_id: clientId, per_page: 30 }) });

  // a readable name for a saved number: the post title or the account name
    const subjectName = (type?: string, id?: number): string | undefined =>
    type === "content" ? content.data?.data.find((c) => c.id === Number(id))?.title
      : type === "account" ? accounts.data?.find((a) => a.id === Number(id))?.account_name
        : undefined;

  const save = useMutation({
    mutationFn: () => {
      const [type, sid] = subject.split(":");
      const platform = type === "account" ? accounts.data?.find((a) => a.id === Number(sid))?.platform : content.data?.data.find((c) => c.id === Number(sid))?.platform;
      return reportsApi.saveMetrics(Number(clientId), [{ subject_type: type as "account" | "content", subject_id: Number(sid), platform: platform ?? "instagram", metric: metric.trim().toLowerCase(), value: Number(value), metric_date: date }]);
    },
    onSuccess: () => { setValue(""); qc.invalidateQueries({ queryKey: ["metrics", clientId] }); },
  });

  if (!can(user, "reports.create")) return <Notice>Only managers and owners can enter numbers.</Notice>;

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <Card>
        <h3 style={{ margin: "0 0 6px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Add a number</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: p.muted }}>For now the numbers are typed by hand (for example, the reach of a post as shown in Instagram). The same date and metric again replaces the old value.</p>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", alignItems: "end" }}>
          <Field label="What is it about? *">
            <Select value={subject} onChange={(e) => setSubject(e.target.value)} required>
              <option value="">Choose…</option>
              <optgroup label="Account">{(accounts.data ?? []).map((a) => <option key={a.id} value={`account:${a.id}`}>{a.platform} · {a.account_name}</option>)}</optgroup>
              <optgroup label="Published content">{(content.data?.data ?? []).map((c) => <option key={c.id} value={`content:${c.id}`}>{c.title}</option>)}</optgroup>
            </Select>
          </Field>
          <Field label="Metric *">
            <TextInput list="metric-names" value={metric} onChange={(e) => setMetric(e.target.value)} required />
            <datalist id="metric-names">{METRIC_NAMES.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <Field label="Value *"><TextInput type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} required /></Field>
          <Field label="Date *"><TextInput type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required /></Field>
          <div><Btn variant="primary" type="submit" disabled={save.isPending || !subject || value === ""}>{save.isPending ? "Saving…" : "Save"}</Btn></div>
        </form>
        {save.isError && <div style={{ marginTop: 12 }}><Notice kind="error">{errorText(save.error)}</Notice></div>}
        {save.isSuccess && <div style={{ marginTop: 12 }}><Notice kind="success">Saved.</Notice></div>}
      </Card>

      <div>
        <h3 style={{ margin: "0 0 10px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Latest numbers</h3>
        {saved.isLoading && <Loading />}
        {saved.isError && <Notice kind="error">{errorText(saved.error)}</Notice>}
        {saved.isSuccess && (saved.data?.data ?? []).length === 0 && <span style={{ fontSize: 14, color: p.muted }}>No numbers yet.</span>}
        <div style={{ display: "grid", gap: 8 }}>
          {(saved.data?.data ?? []).map((m, i) => (
            <div key={m.id ?? i} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: 10, border: `1px solid ${p.border}`, fontSize: 13 }}>
              <span dir="auto">{m.metric} · {m.platform} · {subjectName(m.subject_type, m.subject_id) ?? `${m.subject_type} #${m.subject_id}`}</span>
              <span><strong>{m.value !== undefined ? num(m.value) : ""}</strong> <span style={{ color: p.muted }}>{day(m.metric_date)}</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Goals ---------- */
function GoalsTab({ clientId }: { clientId: string }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const goals = useQuery({ queryKey: ["goals", clientId], queryFn: () => reportsApi.goals(clientId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["goals", clientId] });
  const remove = useMutation({ mutationFn: (g: Goal) => reportsApi.deleteGoal(g.id), onSuccess: refresh });

  return (
    <div>
      {can(user, "reports.create") && <div style={{ marginBottom: 18 }}><Btn variant="primary" onClick={() => setAdding(true)}>+ New goal</Btn></div>}
      {goals.isLoading && <Loading />}
      {goals.isError && <Notice kind="error">{errorText(goals.error)}</Notice>}
      {goals.isSuccess && (goals.data ?? []).length === 0 && <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>No goals yet. Example: reach 10,000 this month.</div>}
      <GoalList goals={goals.data ?? []} onDelete={can(user, "reports.delete") ? (g) => { if (window.confirm("Delete this goal?")) remove.mutate(g); } : undefined} />
      {remove.isError && <div style={{ marginTop: 12 }}><Notice kind="error">{errorText(remove.error)}</Notice></div>}
      {adding && <GoalForm clientId={Number(clientId)} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); refresh(); }} />}
    </div>
  );
}

function GoalForm({ clientId, onClose, onSaved }: { clientId: number; onClose: () => void; onSaved: () => void }) {
  const [metric, setMetric] = useState("reach");
  const [target, setTarget] = useState("");
  const [period, setPeriod] = useState<string>("monthly");
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState("");
  const create = useMutation({ mutationFn: () => reportsApi.createGoal({ client_id: clientId, metric: metric.trim().toLowerCase(), target_value: Number(target), period, starts_on: from, ends_on: to }), onSuccess: onSaved });

  return (
    <Modal title="New goal" onClose={onClose} width={520}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} style={{ display: "grid", gap: 14 }}>
        <Field label="Metric *" error={fieldError(create.error, "metric")}>
          <TextInput list="goal-metrics" value={metric} onChange={(e) => setMetric(e.target.value)} required />
          <datalist id="goal-metrics">{METRIC_NAMES.map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
        <Field label="Target *" error={fieldError(create.error, "target_value")}><TextInput type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} required /></Field>
        <Field label="Period *" error={fieldError(create.error, "period")}>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>{GOAL_PERIODS.map((x) => <option key={x} value={x}>{x}</option>)}</Select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Starts *" error={fieldError(create.error, "starts_on")}><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} required /></Field>
          <Field label="Ends *" error={fieldError(create.error, "ends_on")}><TextInput type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required /></Field>
        </div>
        {create.isError && <Notice kind="error">{errorText(create.error)}</Notice>}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" type="submit" disabled={create.isPending || !target || !to}>{create.isPending ? "Saving…" : "Save goal"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}