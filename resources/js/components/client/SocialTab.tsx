import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { can } from "../../services/auth";
import { usePortalTheme } from "../../services/portalTheme";
import { PLATFORMS, clientsApi } from "../../services/clients";
import type { Client, Platform } from "../../services/clients";
import { Badge, Btn, Card, Field, Loading, Notice, Select, TextInput, errorText, fieldError } from "../Ui";

// Where content for this client gets published. Accounts are registered by hand for now.
export default function SocialTab({ client }: { client: Client }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = can(user, "clients.update");

  const list = useQuery({ queryKey: ["client-social", client.id], queryFn: () => clientsApi.accounts(client.id) });

  const [platform, setPlatform] = useState<Platform>("instagram");
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);

  const add = useMutation({
    mutationFn: () => clientsApi.addAccount(client.id, { platform, account_name: name.trim() }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["client-social", client.id] });
    },
  });

  // refused with a message if the account still has scheduled posts
  const remove = useMutation({
    mutationFn: (id: number) => clientsApi.removeAccount(client.id, id),
    onSuccess: () => {
      setConfirming(null);
      qc.invalidateQueries({ queryKey: ["client-social", client.id] });
    },
  });

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {canEdit && (
        <Card>
          <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Add an account</h3>
          <form
            onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
            style={{ display: "grid", gridTemplateColumns: "minmax(150px, 200px) minmax(200px, 1fr) auto", gap: 12, alignItems: "end", marginTop: 14 }}
          >
            <Field label="Platform" error={fieldError(add.error, "platform")}>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
                {PLATFORMS.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Account name" error={fieldError(add.error, "account_name")}>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="@account" maxLength={255} />
            </Field>
            <Btn variant="primary" type="submit" disabled={add.isPending || !name.trim()}>{add.isPending ? "Adding…" : "Add account"}</Btn>
          </form>
          {add.isError && <div style={{ marginTop: 12 }}><Notice kind="error">{errorText(add.error)}</Notice></div>}
        </Card>
      )}

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && list.data.length === 0 && (
        <div style={{ padding: 24, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 14 }}>
          No social accounts yet.
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {list.data.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, border: `1px solid ${p.border}`, background: p.card, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 15, fontWeight: 600, overflowWrap: "anywhere" }}>{a.account_name}</div>
                <div style={{ marginTop: 3, fontSize: 12, color: p.muted, textTransform: "capitalize" }}>{a.platform}</div>
              </div>
              <Badge tone={a.status === "connected" ? "good" : "plain"}>{a.status}</Badge>
              {canEdit && (
                confirming === a.id ? (
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    Remove this account?
                    <Btn small variant="danger" onClick={() => remove.mutate(a.id)} disabled={remove.isPending}>{remove.isPending ? "Removing…" : "Yes, remove"}</Btn>
                    <Btn small onClick={() => setConfirming(null)}>No</Btn>
                  </span>
                ) : (
                  <Btn small variant="danger" onClick={() => { remove.reset(); setConfirming(a.id); }}>Remove</Btn>
                )
              )}
            </div>
          ))}
          {remove.isError && <Notice kind="error">{errorText(remove.error)}</Notice>}
        </div>
      )}
    </div>
  );
}