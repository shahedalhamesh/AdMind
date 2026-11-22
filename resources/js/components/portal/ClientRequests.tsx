import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortalTheme } from "../../services/portalTheme";
import { fmtDateTime } from "../../services/content";
import { CLIENT_LABEL, REQUEST_PRIORITIES, REQUEST_TYPES, cap, clientRequestsApi, requestTone } from "../../services/clientRequests";
import { Badge, Btn, Field, Loading, Notice, Select, TextArea, TextInput, errorText, fieldError } from "../Ui";

export default function ClientRequests() {
  const { p } = usePortalTheme();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["my-requests"], queryFn: () => clientRequestsApi.list({ per_page: 50 }) });
  const items = list.data?.data ?? [];

  const [type, setType] = useState("content");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const send = useMutation({
    mutationFn: () => clientRequestsApi.create({ type, subject: subject.trim(), ...(description.trim() ? { description: description.trim() } : {}), priority }),
    onSuccess: () => {
      setSubject("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["my-requests"] });
    },
  });

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} style={{ display: "grid", gap: 14, padding: 20, borderRadius: 16, border: `1px solid ${p.border}`, background: p.card }}>
        <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>New request</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Type" error={fieldError(send.error, "type")}>
            <Select value={type} onChange={(e) => setType(e.target.value)}>{REQUEST_TYPES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}</Select>
          </Field>
          <Field label="Priority" error={fieldError(send.error, "priority")}>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>{REQUEST_PRIORITIES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}</Select>
          </Field>
        </div>
        <Field label="Subject *" error={fieldError(send.error, "subject")}><TextInput value={subject} onChange={(e) => setSubject(e.target.value)} dir="auto" maxLength={255} required /></Field>
        <Field label="Details" error={fieldError(send.error, "description")}><TextArea value={description} onChange={(e) => setDescription(e.target.value)} dir="auto" /></Field>
        {send.isError && <Notice kind="error">{errorText(send.error)}</Notice>}
        {send.isSuccess && <Notice kind="success">Your request was sent to the agency.</Notice>}
        <div><Btn variant="primary" type="submit" disabled={send.isPending || !subject.trim()}>{send.isPending ? "Sending…" : "Send request"}</Btn></div>
      </form>

      <div>
        <h3 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>My requests</h3>
        {list.isLoading && <Loading />}
        {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
        {list.isSuccess && items.length === 0 && <div style={{ padding: 24, borderRadius: 14, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 14 }}>You have not sent a request yet.</div>}
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((r) => (
            <div key={r.id} style={{ display: "grid", gap: 6, padding: "14px 16px", borderRadius: 14, border: `1px solid ${p.border}`, background: p.card }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span dir="auto" style={{ fontSize: 15, fontWeight: 600, overflowWrap: "anywhere" }}>{r.subject}</span>
                <Badge tone={requestTone(r.status)}>{CLIENT_LABEL[r.status] ?? r.status}</Badge>
              </div>
              <div style={{ fontSize: 12, color: p.muted }}>{cap(r.type)} · {cap(r.priority)} · {fmtDateTime(r.created_at)}</div>
              {r.description && <div dir="auto" style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6, overflowWrap: "anywhere" }}>{r.description}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}