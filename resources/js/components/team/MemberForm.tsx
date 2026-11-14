import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { CLIENT_ROLE, USER_STATUSES, usersApi } from "../../services/users";
import type { Member, MemberUpdate, Role } from "../../services/users";
import type { Client } from "../../services/clients";
import { Btn, Field, Modal, Notice, Select, TextInput, errorText, fieldError } from "../Ui";

// One form for both "Add member" (member = undefined) and "Edit member".
export default function MemberForm({
  member,
  roles,
  clients,
  onClose,
}: {
  member?: Member;
  roles: Role[];
  clients: Client[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSelf = !!member && member.id === user?.id;

  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState<string>(member ? String(member.role_id) : "");
  const [clientId, setClientId] = useState<string>(member?.client_id ? String(member.client_id) : "");
  const [status, setStatus] = useState<"active" | "disabled">(member?.status ?? "active");

  const roleName = roles.find((r) => String(r.id) === roleId)?.name;
  const isClientRole = roleName === CLIENT_ROLE;

  const save = useMutation({
    mutationFn: () => {
      if (!member) {
        return usersApi.create({
          name: name.trim(),
          email: email.trim(),
          password,
          role_id: Number(roleId),
          client_id: isClientRole && clientId ? Number(clientId) : null,
          status,
        });
      }
      // edit: send only what changed
      const body: MemberUpdate = {};
      if (name.trim() !== member.name) body.name = name.trim();
      if (email.trim() !== member.email) body.email = email.trim();
      if (password) body.password = password;
      if (Number(roleId) !== member.role_id) body.role_id = Number(roleId);
      const newClient = isClientRole && clientId ? Number(clientId) : null;
      if (newClient !== member.client_id) body.client_id = newClient;
      if (status !== member.status) body.status = status;
      return usersApi.update(member.id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  const err = save.error;
  const ready = name.trim() && email.trim() && roleId && (member || password.length >= 8) && (!isClientRole || clientId);

  return (
    <Modal title={member ? "Edit member" : "Add member"} onClose={onClose} width={560}>
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <Field label="Name *" error={fieldError(err, "name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={255} />
        </Field>
        <Field label="Email *" error={fieldError(err, "email")}>
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
        </Field>
        <Field
          label={member ? "New password" : "Password *"}
          error={fieldError(err, "password")}
          hint={member ? "Leave empty to keep the current one. A new password signs the person out everywhere." : "At least 8 characters."}
        >
          <TextInput type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <Field label="Role *" error={fieldError(err, "role_id")}>
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} disabled={isSelf} required>
              <option value="" disabled>Choose a role</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="Status" error={fieldError(err, "status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as "active" | "disabled")} disabled={isSelf}>
              {USER_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </Select>
          </Field>
        </div>

        {isClientRole && (
          <Field label="Client *" error={fieldError(err, "client_id")} hint="A login with the Client role belongs to one client.">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <option value="" disabled>Choose a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        {roles.length === 0 && <Notice kind="warning">The list of roles could not be loaded. Close this window and try again.</Notice>}
        {isSelf && <Notice>You cannot change your own role or status.</Notice>}
        {status === "disabled" && !isSelf && (
          <Notice kind="warning">A disabled person is signed out and cannot log in. People are never deleted, so you can enable them again later.</Notice>
        )}
        {err && <Notice kind="error">{errorText(err)}</Notice>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" type="submit" disabled={save.isPending || !ready}>
            {save.isPending ? "Saving…" : member ? "Save changes" : "Add member"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}