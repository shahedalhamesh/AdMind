import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { can } from "../../services/auth";
import { usePortalTheme } from "../../services/portalTheme";
import { contractsApi } from "../../services/contracts";
import type { Contract, ContractStatus } from "../../services/contracts";
import { Badge, Btn, Field, Loading, Notice, TextInput, errorText, fieldError } from "../Ui";

const STATUS_LABEL: Record<ContractStatus, string> = { active: "Active", expiring: "Ending soon", expired: "Expired", cancelled: "Cancelled" };
const STATUS_TONE: Record<ContractStatus, "warn" | "bad" | undefined> = { active: undefined, expiring: "warn", expired: "bad", cancelled: "bad" };

const day = (d: string | null) => (d ? d : "—");

function daysText(c: Contract): string {
  if (c.days_left === null || c.status === "cancelled") return "";
  if (c.days_left < 0) return `Ended ${Math.abs(c.days_left)} days ago`;
  if (c.days_left === 0) return "Ends today";
  return `${c.days_left} days left`;
}

export default function ContractsTab({ clientId }: { clientId: number }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = can(user, "clients.update");

  const q = useQuery({ queryKey: ["contracts", clientId], queryFn: () => contractsApi.list(clientId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["contracts"] });
  const cancel = useMutation({ mutationFn: (id: number) => contractsApi.cancel(id), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: number) => contractsApi.remove(id), onSuccess: refresh });

  const rows = q.data ?? [];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {canEdit && <AddForm clientId={clientId} onAdded={refresh} />}

      {q.isLoading && <Loading />}
      {q.isError && <Notice kind="error">{errorText(q.error)}</Notice>}
      {cancel.isError && <Notice kind="error">{errorText(cancel.error)}</Notice>}
      {remove.isError && <Notice kind="error">{errorText(remove.error)}</Notice>}
      {q.isSuccess && rows.length === 0 && (
        <div style={{ padding: 24, borderRadius: 14, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>No contracts yet.</div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((c) => (
          <div key={c.id} style={{ display: "flex", gap: 14, padding: 16, borderRadius: 14, border: `1px solid ${c.status === "expiring" ? "#E8A33D" : p.border}`, background: p.card, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong dir="auto" style={{ fontSize: 16 }}>{c.service}</strong>
                <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status] ?? c.status}</Badge>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: p.muted, lineHeight: 1.8 }}>
                <div>Starts: {day(c.starts_on)} · Ends: {day(c.ends_on)}</div>
                <div>Renewal: {day(c.renewal_date)}{daysText(c) ? ` · ${daysText(c)}` : ""}</div>
                {c.amount !== null && c.amount !== undefined && <div>Amount: {c.amount}</div>}
              </div>
            </div>
            {canEdit && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                {c.status !== "cancelled" && c.status !== "expired" && (
                  <Btn small disabled={cancel.isPending}
                    onClick={() => { if (window.confirm("Cancel this contract?")) cancel.mutate(c.id); }}>Cancel contract</Btn>
                )}
                <Btn small variant="danger" disabled={remove.isPending}
                  onClick={() => { if (window.confirm("Delete this contract?")) remove.mutate(c.id); }}>Delete</Btn>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddForm({ clientId, onAdded }: { clientId: number; onAdded: () => void }) {
  const { p } = usePortalTheme();
  const [service, setService] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [renewal, setRenewal] = useState("");
  const [amount, setAmount] = useState("");

  const add = useMutation({
    mutationFn: () =>
      contractsApi.create({
        client_id: clientId,
        service: service.trim(),
        ...(startsOn ? { starts_on: startsOn } : {}),
        ...(endsOn ? { ends_on: endsOn } : {}),
        ...(renewal ? { renewal_date: renewal } : {}),
        ...(amount !== "" ? { amount: Number(amount) } : {}),
      }),
    onSuccess: () => { setService(""); setStartsOn(""); setEndsOn(""); setRenewal(""); setAmount(""); onAdded(); },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
      style={{ display: "grid", gap: 12, padding: 16, borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
      <strong style={{ fontSize: 15 }}>Add a contract</strong>
      <Field label="Service *" error={fieldError(add.error, "service")}>
        <TextInput value={service} onChange={(e) => setService(e.target.value)} maxLength={255} dir="auto" placeholder="e.g. Social media management" />
      </Field>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 170 }}>
          <Field label="Starts" error={fieldError(add.error, "starts_on")}>
            <TextInput type="date" lang="en-US" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </Field>
        </div>
        <div style={{ width: 170 }}>
          <Field label="Ends" error={fieldError(add.error, "ends_on")}>
            <TextInput type="date" lang="en-US" min={startsOn || undefined} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </Field>
        </div>
        <div style={{ width: 170 }}>
          <Field label="Renewal date" error={fieldError(add.error, "renewal_date")}>
            <TextInput type="date" lang="en-US" value={renewal} onChange={(e) => setRenewal(e.target.value)} />
          </Field>
        </div>
        <div style={{ width: 150 }}>
          <Field label="Amount" error={fieldError(add.error, "amount")}>
            <TextInput type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </div>
      </div>
      {add.isError && <Notice kind="error">{errorText(add.error)}</Notice>}
      <div>
        <Btn variant="primary" type="submit" disabled={add.isPending || !service.trim()}>{add.isPending ? "Saving…" : "Add"}</Btn>
      </div>
    </form>
  );
}