import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { can } from "../../services/auth";
import { CLIENT_STATUSES, clientsApi } from "../../services/clients";
import type { Client, ClientInput, ClientStatus } from "../../services/clients";
import { Btn, Field, Modal, Notice, Select, TagInput, TextArea, TextInput, errorText, fieldError } from "../Ui";

// One form for both "Add client" (client = undefined) and "Edit client".
export default function ClientForm({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved: (c: Client) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [name, setName] = useState(client?.name ?? "");
  const [industry, setIndustry] = useState(client?.industry ?? "");
  const [contactName, setContactName] = useState(client?.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(client?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(client?.contact_phone ?? "");
  const [goals, setGoals] = useState(client?.goals ?? "");
  const [services, setServices] = useState<string[]>(client?.agreed_services ?? []);
  const [status, setStatus] = useState<ClientStatus>(client?.status ?? "active");
  const [responsible, setResponsible] = useState<string>(client?.responsible_user_id ? String(client.responsible_user_id) : "");

  // Picking the responsible employee needs the users list (users.view). Without it the field is hidden.
  const canPickStaff = can(user, "users.view");
  const staff = useQuery({ queryKey: ["staff"], queryFn: clientsApi.staff, enabled: canPickStaff });

  const save = useMutation({
    mutationFn: (body: ClientInput) => (client ? clientsApi.update(client.id, body) : clientsApi.create(body)),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", saved.id] });
      onSaved(saved);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body: ClientInput = {
      name: name.trim(),
      industry: industry.trim() || null,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      goals: goals.trim() || null,
      agreed_services: services,
      status,
    };
    if (canPickStaff) body.responsible_user_id = responsible ? Number(responsible) : null;
    save.mutate(body);
  };

  const err = save.error;

  return (
    <Modal title={client ? "Edit client" : "Add client"} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <Field label="Name *" error={fieldError(err, "name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={255} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <Field label="Industry" error={fieldError(err, "industry")}>
            <TextInput value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={255} />
          </Field>
          <Field label="Status" error={fieldError(err, "status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as ClientStatus)}>
              {CLIENT_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </Select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <Field label="Contact name" error={fieldError(err, "contact_name")}>
            <TextInput value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={255} />
          </Field>
          <Field label="Contact email" error={fieldError(err, "contact_email")}>
            <TextInput type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} maxLength={255} />
          </Field>
          <Field label="Contact phone" error={fieldError(err, "contact_phone")}>
            <TextInput value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={50} />
          </Field>
        </div>

        <Field label="Goals" error={fieldError(err, "goals")}>
          <TextArea value={goals} onChange={(e) => setGoals(e.target.value)} />
        </Field>

        <Field label="Agreed services" error={fieldError(err, "agreed_services")} hint="Press Enter after each service.">
          <TagInput value={services} onChange={setServices} placeholder="For example: Reels, Photography" />
        </Field>

        {canPickStaff && (
          <Field label="Responsible employee" error={fieldError(err, "responsible_user_id")}>
            <Select value={responsible} onChange={(e) => setResponsible(e.target.value)} disabled={staff.isLoading}>
              <option value="">Nobody yet</option>
              {(staff.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
        )}

        {err && <Notice kind="error">{errorText(err)}</Notice>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" type="submit" disabled={save.isPending || !name.trim()}>
            {save.isPending ? "Saving…" : client ? "Save changes" : "Add client"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}