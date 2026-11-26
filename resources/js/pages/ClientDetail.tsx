import { useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { ApiError } from "../services/api";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import ClientForm from "../components/client/ClientForm";
import ProfileTab from "../components/client/ProfileTab";
import DocumentsTab from "../components/client/DocumentsTab";
import SocialTab from "../components/client/SocialTab";
import HistoryTab from "../components/client/HistoryTab";
import { Badge, Btn, Card, Loading, Modal, Notice, errorText } from "../components/Ui";
import { statusTone } from "./Clients";
import SatisfactionTab from "../components/client/SatisfactionTab";
import ContractsTab from "../components/client/ContractsTab";

type Tab = "profile" | "documents" | "social" | "history" | "satisfaction" | "contracts";
const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Brand profile" },
  { id: "documents", label: "Documents" },
  { id: "social", label: "Social accounts" },
  { id: "history", label: "History" },
  { id: "satisfaction", label: "Satisfaction" },
  { id: "contracts", label: "Contracts" },
];
function Info({ label, children }: { label: string; children: ReactNode }) {
  const { p } = usePortalTheme();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: p.eyeb }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5, overflowWrap: "anywhere" }}>{children}</div>
    </div>
  );
}

export default function ClientDetail() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useParams();
  const id = Number(params.id);

  const [tab, setTab] = useState<Tab>("profile");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const query = useQuery({ queryKey: ["client", id], queryFn: () => clientsApi.get(id), enabled: Number.isFinite(id) });

  // only to show the responsible employee's name (needs users.view)
  const canSeeStaff = can(user, "users.view");
  const staff = useQuery({ queryKey: ["staff"], queryFn: clientsApi.staff, enabled: canSeeStaff });

  const remove = useMutation({
    mutationFn: () => clientsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.removeQueries({ queryKey: ["client", id] });
      navigate("/clients", { replace: true });
    },
  });

  const back = (
    <Link to="/clients" style={{ color: p.link, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>← All clients</Link>
  );

  if (query.isLoading) return <Loading />;

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div style={{ maxWidth: 560 }}>
        {back}
        <h1 style={{ margin: "16px 0 0", fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 500 }}>
          {notFound ? "Client not found" : "Could not open this client"}
        </h1>
        <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.6, color: p.muted }}>
          {notFound ? "This client does not exist, or it belongs to another company." : errorText(query.error)}
        </p>
      </div>
    );
  }

  const c = query.data!;
  const responsible = c.responsible_user_id ? staff.data?.find((u) => u.id === c.responsible_user_id) : undefined;

  return (
    <div>
      {back}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500, overflowWrap: "anywhere" }}>{c.name}</h1>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: p.muted, fontSize: 14 }}>
            <Badge tone={statusTone(c.status)}>{c.status}</Badge>
            <span>{c.industry || "No industry set"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {can(user, "clients.update") && <Btn onClick={() => setEditing(true)}>Edit</Btn>}
          {can(user, "clients.delete") && <Btn variant="danger" onClick={() => { remove.reset(); setDeleting(true); }}>Delete</Btn>}
        </div>
      </div>

      <Card style={{ marginTop: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 20 }}>
          <Info label="Contact">
            {[c.contact_name, c.contact_email, c.contact_phone].filter(Boolean).map((x, i) => <div key={i}>{x}</div>)}
            {!c.contact_name && !c.contact_email && !c.contact_phone && <span style={{ color: p.muted }}>Not set</span>}
          </Info>
          <Info label="Goals">{c.goals || <span style={{ color: p.muted }}>Not set</span>}</Info>
          <Info label="Agreed services">
            {c.agreed_services && c.agreed_services.length > 0
              ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{c.agreed_services.map((s) => <Badge key={s}>{s}</Badge>)}</div>
              : <span style={{ color: p.muted }}>Not set</span>}
          </Info>
          {canSeeStaff && (
            <Info label="Responsible employee">
              {c.responsible_user_id ? (responsible?.name ?? (staff.isLoading ? "…" : `User #${c.responsible_user_id}`)) : <span style={{ color: p.muted }}>Nobody yet</span>}
            </Info>
          )}
        </div>
      </Card>

      <div role="tablist" style={{ display: "flex", gap: 6, margin: "28px 0 18px", borderBottom: `1px solid ${p.border}`, overflowX: "auto" }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.id)}
              style={{ padding: "11px 16px", border: 0, borderBottom: `2px solid ${active ? p.pri : "transparent"}`, background: "transparent", color: active ? p.text : p.muted, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "profile" && <ProfileTab client={c} />}
      {tab === "documents" && <DocumentsTab client={c} />}
      {tab === "social" && <SocialTab client={c} />}
      {tab === "history" && <HistoryTab clientId={c.id} />}
      {tab === "satisfaction" && <SatisfactionTab clientId={c.id} />}
      {tab === "contracts" && <ContractsTab clientId={c.id} />}

      {editing && <ClientForm client={c} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}

      {deleting && (
        <Modal title="Delete this client?" onClose={() => setDeleting(false)} width={480}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: p.muted }}>
            <strong style={{ color: p.text }}>{c.name}</strong> will be removed from your list. It can be restored from the database, and its AI memory is kept.
          </p>
          {remove.isError && <div style={{ marginTop: 14 }}><Notice kind="error">{errorText(remove.error)}</Notice></div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <Btn onClick={() => setDeleting(false)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>{remove.isPending ? "Deleting…" : "Delete client"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}