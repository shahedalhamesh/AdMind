import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { CONTENT_PLATFORMS, STATUS_LABEL, contentTone } from "../services/content";
import { CAMPAIGN_STATUSES, campaignTone, campaignsApi, pct } from "../services/campaigns";
import type { Campaign } from "../services/campaigns";
import { Badge, Btn, Field, Loading, Modal, Notice, RED, Select, TextArea, TextInput, errorText, fieldError } from "../components/Ui";

const money = (v: string | number, cur: string) => `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${cur}`;

export default function Campaigns() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const list = useQuery({ queryKey: ["campaigns", { clientId, status, page }], queryFn: () => campaignsApi.list({ client_id: clientId, status, page, per_page: 20 }) });
  const items = list.data?.data ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Campaigns</p>
          <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Campaigns</h1>
        </div>
        {can(user, "campaigns.create") && <Btn variant="primary" onClick={() => setCreating(true)}>+ New campaign</Btn>}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "22px 0 18px" }}>
        <div style={{ width: 220 }}>
          <Select aria-label="Filter by client" value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }}>
            <option value="">All clients</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div style={{ width: 170 }}>
          <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </Select>
        </div>
      </div>

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && items.length === 0 && <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>No campaigns yet.</div>}

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((c) => (
          <button key={c.id} type="button" onClick={() => setOpenId(c.id)}
            style={{ textAlign: "start", display: "grid", gap: 10, padding: "16px 18px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card, color: p.text, cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span dir="auto" style={{ fontSize: 17, fontWeight: 600, overflowWrap: "anywhere" }}>{c.name}</span>
              <Badge tone={campaignTone(c.status)}>{c.status}</Badge>
            </span>
            <span style={{ fontSize: 13, color: p.muted }}>{[c.client?.name, c.starts_on && c.ends_on ? `${c.starts_on} → ${c.ends_on}` : "", `${c.content_items_count ?? 0} content`].filter(Boolean).join(" · ")}</span>
            <BudgetBar c={c} />
          </button>
        ))}
      </div>

      {list.data && list.data.last_page > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 22, fontSize: 13, color: p.muted }}>
          <Btn small onClick={() => setPage((n) => n - 1)} disabled={page <= 1}>← Previous</Btn>
          <span>Page {list.data.current_page} of {list.data.last_page}</span>
          <Btn small onClick={() => setPage((n) => n + 1)} disabled={page >= list.data.last_page}>Next →</Btn>
        </div>
      )}

      {creating && <CampaignForm defaultClient={clientId} onClose={() => setCreating(false)} />}
      {openId !== null && <CampaignDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function BudgetBar({ c }: { c: Pick<Campaign, "spent" | "budget" | "currency"> }) {
  const { p } = usePortalTheme();
  const over = Number(c.spent) > Number(c.budget);
  return (
    <span style={{ display: "grid", gap: 4 }}>
      <span style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: over ? RED : p.muted }}>
        <span>Spent {money(c.spent, c.currency)}</span><span>Budget {money(c.budget, c.currency)}</span>
      </span>
      <span style={{ display: "block", height: 8, borderRadius: 4, background: p.border }}><span style={{ display: "block", height: 8, borderRadius: 4, width: `${pct(c.spent, c.budget)}%`, background: over ? RED : p.pri }} /></span>
    </span>
  );
}

function CampaignDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["campaign", id], queryFn: () => campaignsApi.get(id) });
  const [editing, setEditing] = useState(false);
  const done = () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); qc.invalidateQueries({ queryKey: ["campaign", id] }); };
  const remove = useMutation({ mutationFn: () => campaignsApi.remove(id), onSuccess: () => { done(); onClose(); } });

  const d = q.data;
  return (
    <Modal title={d?.campaign.name ?? "Campaign"} onClose={onClose} width={680}>
      {q.isLoading && <Loading />}
      {q.isError && <Notice kind="error">{errorText(q.error)}</Notice>}
      {d && (editing ? (
        <CampaignEdit c={d.campaign} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); done(); }} />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Badge tone={campaignTone(d.campaign.status)}>{d.campaign.status}</Badge>
            {d.campaign.client && <Link to={`/clients/${d.campaign.client.id}`} style={{ color: p.link, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>{d.campaign.client.name}</Link>}
            {d.campaign.channels.map((ch) => <Badge key={ch}>{ch}</Badge>)}
          </div>
          <div dir="auto" style={{ fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{d.campaign.objective}</div>
          {d.campaign.starts_on && <div style={{ fontSize: 13, color: p.muted }}>{d.campaign.starts_on} → {d.campaign.ends_on}</div>}
          <BudgetBar c={d.campaign} />
          <div style={{ fontSize: 14 }}>
            {d.over_budget ? <span style={{ color: RED, fontWeight: 600 }}>Over budget by {money(Math.abs(d.remaining), d.campaign.currency)}</span> : <span>Remaining: <strong>{money(d.remaining, d.campaign.currency)}</strong></span>}
          </div>

          <div>
            <h3 style={{ margin: "6px 0 10px", fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500 }}>Content in this campaign</h3>
            {d.content.length === 0 && <span style={{ fontSize: 14, color: p.muted }}>None yet. Link content to a campaign from its own page.</span>}
            <div style={{ display: "grid", gap: 8 }}>
              {d.content.map((c) => (
                <Link key={c.id} to={`/content/${c.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, color: p.text, textDecoration: "none", fontSize: 14 }}>
                  <span dir="auto" style={{ overflowWrap: "anywhere" }}>{c.title}</span>
                  <Badge tone={contentTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
                </Link>
              ))}
            </div>
          </div>

          {remove.isError && <Notice kind="error">{errorText(remove.error)}</Notice>}
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              {can(user, "campaigns.update") && <Btn variant="primary" onClick={() => setEditing(true)}>Edit</Btn>}
              <Btn onClick={onClose}>Close</Btn>
            </div>
            {can(user, "campaigns.delete") && d.campaign.status === "draft" && (
              <Btn variant="danger" onClick={() => { if (window.confirm("Delete this campaign?")) remove.mutate(); }} disabled={remove.isPending}>Delete</Btn>
            )}
          </div>
          {can(user, "campaigns.delete") && d.campaign.status !== "draft" && <span style={{ fontSize: 12, color: p.muted }}>Only a draft can be deleted. To close this campaign, set it to Completed.</span>}
        </div>
      ))}
    </Modal>
  );
}

function CampaignEdit({ c, onCancel, onSaved }: { c: Campaign; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(c.name);
  const [objective, setObjective] = useState(c.objective);
  const [budget, setBudget] = useState(String(Number(c.budget)));
  const [spent, setSpent] = useState(String(Number(c.spent)));
  const [status, setStatus] = useState(c.status);
  const [from, setFrom] = useState(c.starts_on ?? "");
  const [to, setTo] = useState(c.ends_on ?? "");

  const save = useMutation({
    mutationFn: () => {
      // send only what changed
      const body: Record<string, unknown> = {};
      if (name.trim() !== c.name) body.name = name.trim();
      if (objective !== c.objective) body.objective = objective;
      if (Number(budget) !== Number(c.budget)) body.budget = Number(budget);
      if (Number(spent) !== Number(c.spent)) body.spent = Number(spent);
      if (status !== c.status) body.status = status;
      if (from && from !== c.starts_on) body.starts_on = from;
      if (to && to !== c.ends_on) body.ends_on = to;
      return campaignsApi.update(c.id, body);
    },
    onSuccess: onSaved,
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} style={{ display: "grid", gap: 14 }}>
      <Field label="Name *" error={fieldError(save.error, "name")}><TextInput value={name} onChange={(e) => setName(e.target.value)} dir="auto" required /></Field>
      <Field label="Objective" error={fieldError(save.error, "objective")}><TextArea value={objective} onChange={(e) => setObjective(e.target.value)} dir="auto" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label={`Budget (${c.currency})`} error={fieldError(save.error, "budget")}><TextInput type="number" step="any" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} /></Field>
        <Field label={`Spent (${c.currency})`} hint="Updated by hand for now." error={fieldError(save.error, "spent")}><TextInput type="number" step="any" min="0" value={spent} onChange={(e) => setSpent(e.target.value)} /></Field>
      </div>
      <Field label="Status" error={fieldError(save.error, "status")}>
        <Select value={status} onChange={(e) => setStatus(e.target.value as Campaign["status"])}>{CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Starts" error={fieldError(save.error, "starts_on")}><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Ends" error={fieldError(save.error, "ends_on")}><TextInput type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {save.isError && <Notice kind="error">{errorText(save.error)}</Notice>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn variant="primary" type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Btn>
        <Btn onClick={onCancel}>Cancel</Btn>
      </div>
    </form>
  );
}

function CampaignForm({ defaultClient, onClose }: { defaultClient: string; onClose: () => void }) {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const [clientId, setClientId] = useState(defaultClient);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [channels, setChannels] = useState<string[]>(["instagram"]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const create = useMutation({
    mutationFn: () => campaignsApi.create({
      client_id: Number(clientId), name: name.trim(), objective: objective.trim(), budget: Number(budget), channels,
      currency: currency.trim().toUpperCase() || "SAR",
      ...(from ? { starts_on: from } : {}), ...(to ? { ends_on: to } : {}),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); onClose(); },
  });
  const toggle = (ch: string) => setChannels((l) => (l.includes(ch) ? l.filter((x) => x !== ch) : [...l, ch]));

  return (
    <Modal title="New campaign" onClose={onClose} width={600}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} style={{ display: "grid", gap: 14 }}>
        <Field label="Client *" error={fieldError(create.error, "client_id")}>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Choose…</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Name *" error={fieldError(create.error, "name")}><TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={255} dir="auto" required /></Field>
        <Field label="Objective *" error={fieldError(create.error, "objective")}><TextArea value={objective} onChange={(e) => setObjective(e.target.value)} dir="auto" required /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
          <Field label="Budget *" error={fieldError(create.error, "budget")}><TextInput type="number" step="any" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} required /></Field>
          <Field label="Currency" error={fieldError(create.error, "currency")}><TextInput value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} /></Field>
        </div>
        <Field label="Channels *" error={fieldError(create.error, "channels")}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 14 }}>
            {CONTENT_PLATFORMS.map((ch) => <label key={ch} style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={channels.includes(ch)} onChange={() => toggle(ch)} /> {ch}</label>)}
          </div>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Starts" error={fieldError(create.error, "starts_on")}><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Ends" error={fieldError(create.error, "ends_on")}><TextInput type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        {create.isError && <Notice kind="error">{errorText(create.error)}</Notice>}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" type="submit" disabled={create.isPending || !clientId || !name.trim() || !objective.trim() || !budget || channels.length === 0}>{create.isPending ? "Creating…" : "Create campaign"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}