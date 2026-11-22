import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { fmtDateTime } from "../services/content";
import { inviteUrl, invitesApi, joinLinksApi, joinRequestsApi, nameOf, teamJoinUrl } from "../services/invites";
import type { Invitation, JoinLink, JoinRequest, Role } from "../services/invites";
import { Badge, Btn, Card, Field, Loading, Notice, Select, TextInput, errorText, fieldError } from "../components/Ui";

type Tab = "invitations" | "link" | "requests";

const isOwnerOrClient = (r: Role) => ["owner", "client"].includes(r.name.toLowerCase());

export default function TeamAccess() {
  const { p } = usePortalTheme();
  const [tab, setTab] = useState<Tab>("invitations");
  const pending = useQuery({ queryKey: ["join-requests", "pending"], queryFn: () => joinRequestsApi.list("pending"), refetchInterval: 30000 });
  const count = pending.data?.length ?? 0;

  const tabs: [Tab, string][] = [["invitations", "Invitations"], ["link", "Join link"], ["requests", count > 0 ? `Requests (${count})` : "Requests"]];

  return (
    <div>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Team access</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Invitations and join requests</h1>
      <p style={{ margin: "8px 0 0", fontSize: 15, color: p.muted, maxWidth: 640 }}>Add people to your team with a link. There is no email sending yet: copy the link and send it yourself (WhatsApp, email...).</p>

      <div role="tablist" style={{ display: "flex", gap: 6, margin: "24px 0 20px", borderBottom: `1px solid ${p.border}`, overflowX: "auto" }}>
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
            style={{ padding: "11px 16px", border: 0, borderBottom: `2px solid ${tab === id ? p.pri : "transparent"}`, background: "transparent", color: tab === id ? p.text : p.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "invitations" && <InvitationsTab />}
      {tab === "link" && <JoinLinkTab />}
      {tab === "requests" && <RequestsTab />}
    </div>
  );
}

/* A link shown once, with a Copy button */
function LinkBox({ url, note }: { url: string; note?: string }) {
  const { p } = usePortalTheme();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };
  return (
    <div style={{ display: "grid", gap: 8, padding: 14, borderRadius: 12, border: `1px solid ${p.pri}` }}>
      {note && <span style={{ fontSize: 13, color: p.muted }}>{note}</span>}
      <div style={{ display: "flex", gap: 8 }}>
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
          style={{ flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 8, border: `1px solid ${p.border}`, background: "transparent", color: p.text, fontSize: 13, fontFamily: "inherit" }} />
        <Btn variant="primary" onClick={copy}>{copied ? "Copied" : "Copy link"}</Btn>
      </div>
      <span style={{ fontSize: 12, color: p.muted }}>This link is shown only now. If you lose it, make a new one.</span>
    </div>
  );
}

const statusTone = (s: string): "good" | "warn" | "bad" | "plain" =>
  s === "pending" || s === "active" ? "warn" : s === "accepted" || s === "approved" ? "good" : s === "revoked" || s === "rejected" || s === "expired" || s === "full" ? "bad" : "plain";

/* ---------- 1. Personal invitations ---------- */
function InvitationsTab() {
  const { p } = usePortalTheme();
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["roles-for-invites"], queryFn: invitesApi.roles });
  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const [status, setStatus] = useState("pending");
  const list = useQuery({ queryKey: ["invitations", status], queryFn: () => invitesApi.list(status) });

  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [clientId, setClientId] = useState("");
  const [days, setDays] = useState("7");
  const [shown, setShown] = useState<{ email: string; url: string } | null>(null);

  const role = (roles.data ?? []).find((r) => String(r.id) === roleId);
  const isClientRole = role?.name.toLowerCase() === "client";
  const refresh = () => qc.invalidateQueries({ queryKey: ["invitations"] });

  const create = useMutation({
    mutationFn: () => invitesApi.create({ email: email.trim(), role_id: Number(roleId), client_id: isClientRole ? Number(clientId) : null, expires_in_days: Number(days) || 7 }),
    onSuccess: (inv) => {
      if (inv.token) setShown({ email: inv.email, url: inviteUrl(inv.token) });
      setEmail("");
      refresh();
    },
  });
  const renew = useMutation({
    mutationFn: (id: number) => invitesApi.renew(id),
    onSuccess: (inv) => {
      if (inv.token) setShown({ email: inv.email, url: inviteUrl(inv.token) });
      refresh();
    },
  });
  const revoke = useMutation({ mutationFn: (id: number) => invitesApi.revoke(id), onSuccess: refresh });
  const err = create.error ?? renew.error ?? revoke.error;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Card>
        <h3 style={{ margin: "0 0 14px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Invite a member</h3>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} style={{ display: "grid", gap: 14 }}>
          <Field label="Email *" error={fieldError(create.error, "email")}><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Role *" error={fieldError(create.error, "role_id")}>
              <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
                <option value="">Choose…</option>
                {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
            <Field label="Valid for (days)" error={fieldError(create.error, "expires_in_days")}>
              <TextInput type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
          </div>
          {isClientRole && (
            <Field label="Client *" hint="This invitation is the client's own login." error={fieldError(create.error, "client_id")}>
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                <option value="">Choose…</option>
                {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
          {create.isError && <Notice kind="error">{errorText(create.error)}</Notice>}
          <div><Btn variant="primary" type="submit" disabled={create.isPending || !email.trim() || !roleId || (isClientRole && !clientId)}>{create.isPending ? "Creating…" : "Create invitation"}</Btn></div>
        </form>
      </Card>

      {shown && <LinkBox url={shown.url} note={`Invitation for ${shown.email}. Send them this link:`} />}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Invitations</h3>
          <div style={{ width: 160 }}>
            <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {["pending", "accepted", "expired", "revoked"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </Select>
          </div>
        </div>
        {err && <div style={{ marginBottom: 12 }}><Notice kind="error">{errorText(err)}</Notice></div>}
        {list.isLoading && <Loading />}
        {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
        {list.isSuccess && list.data.length === 0 && <div style={{ padding: 24, borderRadius: 14, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 14 }}>No {status} invitations.</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {(list.data ?? []).map((i: Invitation) => (
            <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "14px 16px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, overflowWrap: "anywhere" }}>{i.email}</div>
                <div style={{ fontSize: 12, color: p.muted, marginTop: 4 }}>
                  {nameOf(i.role)}{i.client ? ` · ${nameOf(i.client)}` : ""} · expires {fmtDateTime(i.expires_at)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                {(i.status === "pending" || i.status === "expired") && <Btn small onClick={() => renew.mutate(i.id)} disabled={renew.isPending}>New link</Btn>}
                {i.status === "pending" && <Btn small variant="danger" onClick={() => { if (window.confirm(`Cancel the invitation for ${i.email}?`)) revoke.mutate(i.id); }} disabled={revoke.isPending}>Cancel</Btn>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- 2. Public join link ---------- */
function JoinLinkTab() {
  const { p } = usePortalTheme();
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["roles-for-invites"], queryFn: invitesApi.roles });
  const [status, setStatus] = useState("active");
  const list = useQuery({ queryKey: ["join-links", status], queryFn: () => joinLinksApi.list(status) });

  const [roleId, setRoleId] = useState("");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("30");
  const [maxUses, setMaxUses] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["join-links"] });

  const create = useMutation({
    mutationFn: () => joinLinksApi.create({
      role_id: Number(roleId),
      ...(label.trim() ? { label: label.trim() } : {}),
      expires_in_days: Number(days) || 30,
      ...(maxUses ? { max_uses: Number(maxUses) } : {}),
    }),
    onSuccess: (link: JoinLink) => {
      if (link.token) setShown(teamJoinUrl(link.token));
      refresh();
    },
  });
  const revoke = useMutation({ mutationFn: (id: number) => joinLinksApi.revoke(id), onSuccess: refresh });

  const allowed = (roles.data ?? []).filter((r) => !isOwnerOrClient(r));

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Card>
        <h3 style={{ margin: "0 0 6px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Create a join link</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: p.muted, lineHeight: 1.5 }}>One link for many people (for example a WhatsApp group). Each person asks to join, and nothing happens until you approve them. A public link can never give the Owner or Client role.</p>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Role *" error={fieldError(create.error, "role_id")}>
              <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
                <option value="">Choose…</option>
                {allowed.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
            <Field label="Title" hint="Shown to the person." error={fieldError(create.error, "label")}>
              <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Join as Employee" dir="auto" />
            </Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Valid for (days)" error={fieldError(create.error, "expires_in_days")}><TextInput type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
            <Field label="Max people" hint="Optional." error={fieldError(create.error, "max_uses")}><TextInput type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></Field>
          </div>
          {create.isError && <Notice kind="error">{errorText(create.error)}</Notice>}
          <div><Btn variant="primary" type="submit" disabled={create.isPending || !roleId}>{create.isPending ? "Creating…" : "Create link"}</Btn></div>
        </form>
      </Card>

      {shown && <LinkBox url={shown} note="Send this link to the people you want in your team:" />}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Links</h3>
          <div style={{ width: 160 }}>
            <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {["active", "full", "expired", "revoked"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </Select>
          </div>
        </div>
        {revoke.isError && <div style={{ marginBottom: 12 }}><Notice kind="error">{errorText(revoke.error)}</Notice></div>}
        {list.isLoading && <Loading />}
        {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
        {list.isSuccess && list.data.length === 0 && <div style={{ padding: 24, borderRadius: 14, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 14 }}>No {status} links.</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {(list.data ?? []).map((l: JoinLink) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "14px 16px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
              <div style={{ minWidth: 0 }}>
                <div dir="auto" style={{ fontSize: 15, fontWeight: 600, overflowWrap: "anywhere" }}>{l.label || nameOf(l.role)}</div>
                <div style={{ fontSize: 12, color: p.muted, marginTop: 4 }}>
                  {nameOf(l.role)} · used {l.uses_count}{l.max_uses ? ` of ${l.max_uses}` : ""} · expires {fmtDateTime(l.expires_at)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                {l.status === "active" && <Btn small variant="danger" onClick={() => { if (window.confirm("Stop this link? People who already have it will not be able to use it.")) revoke.mutate(l.id); }} disabled={revoke.isPending}>Stop link</Btn>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- 3. Join requests ---------- */
function RequestsTab() {
  const { p } = usePortalTheme();
  const [status, setStatus] = useState("pending");
  const list = useQuery({ queryKey: ["join-requests", status], queryFn: () => joinRequestsApi.list(status) });
  const roles = useQuery({ queryKey: ["roles-for-invites"], queryFn: invitesApi.roles });
  const allowed = (roles.data ?? []).filter((r) => !isOwnerOrClient(r));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>People asking to join</h3>
        <div style={{ width: 160 }}>
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["pending", "approved", "rejected"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </Select>
        </div>
      </div>
      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && list.data.length === 0 && <div style={{ padding: 24, borderRadius: 14, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 14 }}>No {status} requests.</div>}
      <div style={{ display: "grid", gap: 10 }}>
        {(list.data ?? []).map((r) => <RequestRow key={r.id} r={r} roles={allowed} />)}
      </div>
    </div>
  );
}

function RequestRow({ r, roles }: { r: JoinRequest; roles: Role[] }) {
  const { p } = usePortalTheme();
  const qc = useQueryClient();
  const [roleId, setRoleId] = useState(r.role ? String(r.role.id) : "");
  const refresh = () => qc.invalidateQueries({ queryKey: ["join-requests"] });
  const approve = useMutation({
    mutationFn: () => joinRequestsApi.approve(r.id, r.role && String(r.role.id) !== roleId ? Number(roleId) : undefined),
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["users"] }); },
  });
  const reject = useMutation({ mutationFn: () => joinRequestsApi.reject(r.id), onSuccess: refresh });
  const err = approve.error ?? reject.error;

  return (
    <div style={{ display: "grid", gap: 10, padding: "14px 16px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div dir="auto" style={{ fontSize: 15, fontWeight: 600, overflowWrap: "anywhere" }}>{r.name}</div>
          <div style={{ fontSize: 13, color: p.muted, overflowWrap: "anywhere" }}>{r.email}{r.via_google ? " · Google" : ""} · asked {fmtDateTime(r.created_at)}</div>
        </div>
        <Badge tone={statusTone(r.status)}>{r.status}</Badge>
      </div>
      {r.status === "pending" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ width: 170 }}>
            <Select aria-label="Role to give" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </div>
          <Btn small variant="primary" onClick={() => approve.mutate()} disabled={approve.isPending || reject.isPending}>{approve.isPending ? "Approving…" : "Approve"}</Btn>
          <Btn small variant="danger" onClick={() => { if (window.confirm(`Reject ${r.name}?`)) reject.mutate(); }} disabled={approve.isPending || reject.isPending}>Reject</Btn>
        </div>
      )}
      {err && <Notice kind="error">{errorText(err)}</Notice>}
    </div>
  );
}