import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { can } from "../../services/auth";
import { usePortalTheme } from "../../services/portalTheme";
import { fmtDateTime } from "../../services/content";
import { INTERACTION_TYPES, interactionsApi, toBackendTime } from "../../services/interactions";
import type { InteractionType } from "../../services/interactions";
import { Badge, Btn, Field, Loading, Notice, Select, TextArea, TextInput, errorText, fieldError } from "../Ui";

const TYPE_LABEL: Record<InteractionType, string> = { meeting: "Meeting", message: "Message", call: "Call", note: "Note" };

export default function HistoryTab({ clientId }: { clientId: number }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = can(user, "clients.update");
  const [page, setPage] = useState(1);

  const list = useQuery({ queryKey: ["interactions", clientId, page], queryFn: () => interactionsApi.list(clientId, page) });
  const rows = list.data?.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["interactions", clientId] });

  const remove = useMutation({ mutationFn: (id: number) => interactionsApi.remove(id), onSuccess: refresh });

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {canEdit && <AddForm clientId={clientId} onAdded={() => { setPage(1); refresh(); }} />}

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {remove.isError && <Notice kind="error">{errorText(remove.error)}</Notice>}
      {list.isSuccess && rows.length === 0 && (
        <div style={{ padding: 24, borderRadius: 14, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>
          Nothing here yet. Add the first note about this client.
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", gap: 14, padding: 14, borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
            <div style={{ flexShrink: 0, paddingTop: 2 }}><Badge>{TYPE_LABEL[r.type] ?? r.type}</Badge></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div dir="auto" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 15, lineHeight: 1.6 }}>{r.summary}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: p.muted }}>
                {fmtDateTime(r.occurred_at)}{r.source && r.source !== "manual" ? ` · ${r.source}` : ""}
              </div>
            </div>
            {canEdit && (
              <Btn small variant="danger" disabled={remove.isPending}
                onClick={() => { if (window.confirm("Delete this entry?")) remove.mutate(r.id); }}>
                Delete
              </Btn>
            )}
          </div>
        ))}
      </div>

      {list.data && list.data.last_page > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontSize: 13, color: p.muted }}>
          <Btn small onClick={() => setPage((n) => n - 1)} disabled={page <= 1}>← Previous</Btn>
          <span>Page {list.data.current_page} of {list.data.last_page}</span>
          <Btn small onClick={() => setPage((n) => n + 1)} disabled={page >= list.data.last_page}>Next →</Btn>
        </div>
      )}
    </div>
  );
}

function AddForm({ clientId, onAdded }: { clientId: number; onAdded: () => void }) {
  const { p } = usePortalTheme();
  const [type, setType] = useState<InteractionType>("note");
  const [summary, setSummary] = useState("");
  const [when, setWhen] = useState("");

  const add = useMutation({
    mutationFn: () => interactionsApi.create(clientId, { type, summary: summary.trim(), occurred_at: toBackendTime(when) }),
    onSuccess: () => { setSummary(""); setWhen(""); onAdded(); },
  });

  // the date can't be in the future
  const now = new Date();
  const maxLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
      style={{ display: "grid", gap: 12, padding: 16, borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
      <strong style={{ fontSize: 15 }}>Add to the history</strong>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 160 }}>
          <Field label="Type" error={fieldError(add.error, "type")}>
            <Select value={type} onChange={(e) => setType(e.target.value as InteractionType)}>
              {INTERACTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </Select>
          </Field>
        </div>
        <div style={{ width: 230 }}>
          <Field label="When (optional)" error={fieldError(add.error, "occurred_at")}>
            <TextInput type="datetime-local" lang="en-US" max={maxLocal} value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="What happened *" error={fieldError(add.error, "summary")}>
        <TextArea value={summary} onChange={(e) => setSummary(e.target.value)} dir="auto" maxLength={2000} />
      </Field>
      {add.isError && <Notice kind="error">{errorText(add.error)}</Notice>}
      <div>
        <Btn variant="primary" type="submit" disabled={add.isPending || !summary.trim()}>{add.isPending ? "Saving…" : "Add"}</Btn>
      </div>
    </form>
  );
}