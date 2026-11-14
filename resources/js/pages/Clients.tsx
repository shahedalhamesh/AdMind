import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { CLIENT_STATUSES, clientsApi } from "../services/clients";
import type { Client } from "../services/clients";
import ClientForm from "../components/client/ClientForm";
import { Badge, Btn, Loading, Notice, Select, TextInput, errorText } from "../components/Ui";

export function statusTone(s: Client["status"]): "good" | "warn" | "bad" {
  return s === "active" ? "good" : s === "paused" ? "warn" : "bad";
}

export default function Clients() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);

  // wait a moment after typing before asking the server
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useQuery({ queryKey: ["clients", { q, status }], queryFn: () => clientsApi.list({ q, status }) });
  const clients = list.data ?? [];
  const filtering = !!q || !!status;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Clients</p>
          <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Your clients</h1>
        </div>
        {can(user, "clients.create") && <Btn variant="primary" onClick={() => setAdding(true)}>+ Add client</Btn>}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "24px 0 20px" }}>
        <div style={{ flex: "1 1 260px", maxWidth: 380 }}>
          <TextInput placeholder="Search by name" aria-label="Search clients" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ width: 180 }}>
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </Select>
        </div>
      </div>

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}

      {list.isSuccess && clients.length === 0 && (
        <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15, lineHeight: 1.6 }}>
          {filtering
            ? "No clients match your search."
            : "No clients yet. Add the clients you work with, and the AI will learn how each one likes to be presented."}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
        {clients.map((c) => (
          <Link
            key={c.id}
            to={`/clients/${c.id}`}
            style={{ display: "block", padding: 20, borderRadius: 16, border: `1px solid ${p.border}`, background: p.card, color: p.text, textDecoration: "none" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 500, minWidth: 0, overflowWrap: "anywhere" }}>{c.name}</div>
              <Badge tone={statusTone(c.status)}>{c.status}</Badge>
            </div>
            <div style={{ marginTop: 6, fontSize: 14, color: p.muted }}>{c.industry || "No industry set"}</div>
            {(c.contact_name || c.contact_email) && (
              <div style={{ marginTop: 14, fontSize: 13, color: p.muted, overflowWrap: "anywhere" }}>
                {[c.contact_name, c.contact_email].filter(Boolean).join(" · ")}
              </div>
            )}
          </Link>
        ))}
      </div>

      {adding && (
        <ClientForm
          onClose={() => setAdding(false)}
          onSaved={(c) => { setAdding(false); navigate(`/clients/${c.id}`); }}
        />
      )}
    </div>
  );
}