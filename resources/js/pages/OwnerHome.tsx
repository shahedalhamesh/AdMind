import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { CLIENT_ROLE, usersApi } from "../services/users";
import ClientForm from "../components/client/ClientForm";
import { Badge, Btn, Card, Loading, Notice, errorText } from "../components/Ui";
import { statusTone } from "./Clients";

// Home for the company owner: clients and team, from the same data as the Clients and Team pages.
export default function OwnerHome() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}), enabled: can(user, "clients.view") });
  const users = useQuery({
    queryKey: ["users", { q: "", roleId: "", status: "" }],
    queryFn: () => usersApi.list({}),
    enabled: can(user, "users.view"),
  });

  const clientList = clients.data ?? [];
  const staff = (users.data ?? []).filter((m) => m.role?.name !== CLIENT_ROLE && m.status === "active");
  const staffById = useMemo(() => new Map(staff.map((m) => [m.id, m])), [staff]);

  const activeClients = clientList.filter((c) => c.status === "active");
  const unassigned = activeClients.filter((c) => !c.responsible_user_id);
  const recent = [...clientList].sort((a, b) => b.id - a.id).slice(0, 5);
  const perEmployee = useMemo(() => {
    const counts = new Map<number, number>();
    clientList.forEach((c) => {
      if (c.responsible_user_id) counts.set(c.responsible_user_id, (counts.get(c.responsible_user_id) ?? 0) + 1);
    });
    return counts;
  }, [clientList]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = user?.name?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const loading = clients.isLoading || users.isLoading;
  const error = clients.error ?? users.error;
  const noClientsYet = clients.isSuccess && clientList.length === 0;

  const tile = (value: number | string, label: string, to?: string) => {
    const inner = (
      <Card style={{ height: "100%", boxSizing: "border-box" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500, lineHeight: 1 }}>{value}</div>
        <div style={{ marginTop: 10, fontSize: 13, color: p.muted }}>{label}</div>
      </Card>
    );
    return to ? <Link to={to} style={{ color: p.text, textDecoration: "none" }}>{inner}</Link> : inner;
  };

  const sectionTitle = (text: string, link?: { to: string; label: string }) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500 }}>{text}</h2>
      {link && <Link to={link.to} style={{ color: p.link, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>{link.label}</Link>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>{today}</p>
          <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 40, fontWeight: 500 }}>{greeting}, {first}.</h1>
        </div>
        {can(user, "clients.create") && <Btn variant="primary" onClick={() => setAdding(true)}>+ Add client</Btn>}
      </div>

      {loading && <Loading />}
      {error && <div style={{ marginTop: 20 }}><Notice kind="error">{errorText(error)}</Notice></div>}

      {noClientsYet && (
        <Card style={{ marginTop: 26 }}>
          <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 500 }}>Add your first client</h2>
          <p style={{ margin: "8px 0 16px", fontSize: 14, lineHeight: 1.6, color: p.muted }}>
            Clients are the heart of the workspace. Add a client, fill in its brand profile, and the AI will learn how that client likes to be presented.
          </p>
          {can(user, "clients.create") && <Btn variant="primary" onClick={() => setAdding(true)}>+ Add client</Btn>}
        </Card>
      )}

      {clients.isSuccess && clientList.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, margin: "26px 0 30px" }}>
            {tile(activeClients.length, "Active clients", "/clients")}
            {tile(clientList.length, "All clients", "/clients")}
            {can(user, "users.view") && tile(staff.length, "Active employees", "/team")}
            {tile(unassigned.length, "Active clients without an employee")}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 22 }}>
            <div>
              {sectionTitle("Needs attention")}
              <Card>
                {unassigned.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 14, color: p.muted }}>Every active client has an employee in charge.</p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 13, color: p.muted }}>These clients have nobody in charge yet:</p>
                    {unassigned.slice(0, 6).map((c) => (
                      <Link key={c.id} to={`/clients/${c.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, color: p.text, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
                        <span style={{ overflowWrap: "anywhere" }}>{c.name}</span>
                        <span style={{ color: p.link, fontSize: 13, whiteSpace: "nowrap" }}>Assign →</span>
                      </Link>
                    ))}
                    {unassigned.length > 6 && <span style={{ fontSize: 13, color: p.muted }}>and {unassigned.length - 6} more</span>}
                  </div>
                )}
              </Card>
            </div>

            <div>
              {sectionTitle("Your team", can(user, "users.view") ? { to: "/team", label: "Manage team" } : undefined)}
              <Card>
                {!can(user, "users.view") ? (
                  <p style={{ margin: 0, fontSize: 14, color: p.muted }}>You do not have access to the team list.</p>
                ) : staff.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 14, color: p.muted }}>No employees yet. Add your team from the Team page.</p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {staff.slice(0, 6).map((m) => (
                      <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14 }}>
                        <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{m.name}</span>
                        <span style={{ color: p.muted, whiteSpace: "nowrap" }}>
                          {perEmployee.get(m.id) ?? 0} {(perEmployee.get(m.id) ?? 0) === 1 ? "client" : "clients"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>

          <div style={{ marginTop: 30 }}>
            {sectionTitle("Latest clients", { to: "/clients", label: "See all" })}
            <div style={{ display: "grid", gap: 10 }}>
              {recent.map((c) => (
                <Link
                  key={c.id}
                  to={`/clients/${c.id}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card, color: p.text, textDecoration: "none", flexWrap: "wrap" }}
                >
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, overflowWrap: "anywhere" }}>{c.name}</div>
                    <div style={{ marginTop: 3, fontSize: 13, color: p.muted }}>{c.industry || "No industry set"}</div>
                  </div>
                  <div style={{ fontSize: 13, color: p.muted }}>
                    {c.responsible_user_id ? (staffById.get(c.responsible_user_id)?.name ?? "Assigned") : "No employee yet"}
                  </div>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {adding && (
        <ClientForm
          onClose={() => setAdding(false)}
          onSaved={(c) => { setAdding(false); navigate(`/clients/${c.id}`); }}
        />
      )}
    </div>
  );
}