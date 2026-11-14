import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { CLIENT_ROLE, USER_STATUSES, usersApi } from "../services/users";
import type { Member } from "../services/users";
import MemberForm from "../components/team/MemberForm";
import { Badge, Btn, Loading, Notice, Select, TextInput, errorText } from "../components/Ui";

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export default function Team() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const canAdd = can(user, "users.create");
  const canEdit = can(user, "users.update");

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<{ member?: Member } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const users = useQuery({
    queryKey: ["users", { q, roleId, status }],
    queryFn: () => usersApi.list({ q, role_id: roleId, status }),
  });
  const roles = useQuery({ queryKey: ["roles"], queryFn: usersApi.roles });
  // all clients, to show who handles which one (and to link a Client login to its client)
  const clients = useQuery({
    queryKey: ["clients", { q: "", status: "" }],
    queryFn: () => clientsApi.list({}),
    enabled: can(user, "clients.view"),
  });

  const all = users.data ?? [];
  const staff = all.filter((m) => m.role?.name !== CLIENT_ROLE);
  const clientLogins = all.filter((m) => m.role?.name === CLIENT_ROLE);

  const handled = useMemo(() => {
    const map = new Map<number, { id: number; name: string }[]>();
    (clients.data ?? []).forEach((c) => {
      if (!c.responsible_user_id) return;
      const list = map.get(c.responsible_user_id) ?? [];
      list.push({ id: c.id, name: c.name });
      map.set(c.responsible_user_id, list);
    });
    return map;
  }, [clients.data]);

  const filtering = !!q || !!roleId || !!status;

  const row = (m: Member, kind: "staff" | "client") => (
    <div
      key={m.id}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card, flexWrap: "wrap", opacity: m.status === "disabled" ? 0.7 : 1 }}
    >
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#C75B41,#A64B35)", color: "#fff", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {initials(m.name)}
      </div>

      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>
          {m.name}{m.id === user?.id && <span style={{ color: p.muted, fontWeight: 500 }}> (you)</span>}
        </div>
        <div style={{ marginTop: 3, fontSize: 13, color: p.muted, overflowWrap: "anywhere" }}>{m.email}</div>
      </div>

      <div style={{ flex: "2 1 260px", minWidth: 0, fontSize: 13 }}>
        {kind === "staff" ? (
          (handled.get(m.id)?.length ?? 0) > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ color: p.muted }}>Handles:</span>
              {handled.get(m.id)!.map((c) => (
                <Link key={c.id} to={`/clients/${c.id}`} style={{ padding: "3px 10px", borderRadius: 999, border: `1px solid ${p.border}`, color: p.link, textDecoration: "none", fontWeight: 600 }}>
                  {c.name}
                </Link>
              ))}
            </div>
          ) : (
            <span style={{ color: p.muted }}>{clients.isLoading ? "…" : "No clients assigned"}</span>
          )
        ) : m.client ? (
          <span style={{ color: p.muted }}>
            Client:{" "}
            <Link to={`/clients/${m.client.id}`} style={{ color: p.link, fontWeight: 600, textDecoration: "none" }}>{m.client.name}</Link>
          </span>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {m.role && <Badge>{m.role.name}</Badge>}
        {m.status === "disabled" && <Badge tone="warn">Disabled</Badge>}
        {canEdit && <Btn small onClick={() => setForm({ member: m })}>Edit</Btn>}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Team</p>
          <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Your team</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: p.muted }}>Employees and the clients each one handles.</p>
        </div>
        {canAdd && <Btn variant="primary" onClick={() => setForm({})}>+ Add member</Btn>}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "24px 0 22px" }}>
        <div style={{ flex: "1 1 260px", maxWidth: 380 }}>
          <TextInput placeholder="Search by name or email" aria-label="Search team" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ width: 180 }}>
          <Select aria-label="Filter by role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">All roles</option>
            {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </div>
        <div style={{ width: 160 }}>
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            {USER_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </Select>
        </div>
      </div>

      {users.isLoading && <Loading />}
      {users.isError && <Notice kind="error">{errorText(users.error)}</Notice>}

      {users.isSuccess && (
        <>
          <h2 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>Employees</h2>
          {staff.length === 0 ? (
            <div style={{ padding: 24, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 14 }}>
              {filtering ? "Nobody matches your search." : "No employees yet."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>{staff.map((m) => row(m, "staff"))}</div>
          )}

          <h2 style={{ margin: "34px 0 4px", fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>Client logins</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: p.muted }}>People from your clients who can sign in to review and approve content.</p>
          {clientLogins.length === 0 ? (
            <div style={{ padding: 24, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 14 }}>
              {filtering ? "Nobody matches your search." : "No client logins yet."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>{clientLogins.map((m) => row(m, "client"))}</div>
          )}
        </>
      )}

      {form && (
        <MemberForm
          member={form.member}
          roles={roles.data ?? []}
          clients={clients.data ?? []}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}