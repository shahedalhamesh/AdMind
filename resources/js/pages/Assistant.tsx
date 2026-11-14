import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { agentApi, NOTE_PREFIX } from "../services/agent";
import type { AgentRun } from "../services/agent";
import { CONTENT_TYPES } from "../services/content";
import { Badge, Btn, Field, Loading, Notice, Select, TextArea, TextInput, errorText, fieldError } from "../components/Ui";

type Msg = { id: number; role: "user" | "agent"; text: string; runId?: number; note?: boolean; corrected?: boolean; failed?: boolean };

let nextId = 1;

// Chat with the AI about one client. The AI answers in 15 to 90 seconds: the page asks every 3 seconds until it is done.
export default function Assistant() {
  const { p } = usePortalTheme();
  const [clientId, setClientId] = useState("");
  const [language, setLanguage] = useState<"Arabic" | "English">("Arabic");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [runId, setRunId] = useState<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });

  const send = useMutation({
    mutationFn: (message: string) => agentApi.chat({ client_id: Number(clientId), message, conversation_id: conversationId, language }),
    onSuccess: (res) => {
      setConversationId(res.conversation_id);
      setRunId(res.agent_run_id);
    },
  });

  const run = useQuery({
    queryKey: ["agent-run", runId],
    queryFn: () => agentApi.run(runId as number),
    enabled: runId !== null,
    refetchInterval: (q) => (!q.state.data || q.state.data.status === "running" ? 3000 : false),
  });

  // when the run ends, add the answer to the chat
  useEffect(() => {
    const r: AgentRun | undefined = run.data;
    if (runId === null || !r || r.id !== runId || r.status === "running") return;
    const text = r.status === "failed" ? r.error || "The AI could not finish. Try again later." : r.output || "";
    setMessages((m) => [
      ...m,
      { id: nextId++, role: "agent", text, runId: r.id, failed: r.status === "failed", corrected: r.verification_status === "corrected", note: r.status === "succeeded" && (r.needs_info || text.startsWith(NOTE_PREFIX)) },
    ]);
    setRunId(null);
  }, [run.data, runId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, runId]);

  const busy = send.isPending || runId !== null;
  const canSend = !!clientId && input.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSend) return;
    const text = input.trim();
    setMessages((m) => [...m, { id: nextId++, role: "user", text }]);
    setInput("");
    send.mutate(text);
  };

  const newConversation = () => { setMessages([]); setConversationId(null); setRunId(null); send.reset(); };
  const changeClient = (v: string) => { setClientId(v); newConversation(); };

  return (
    <div style={{ maxWidth: 860 }}>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>AI Assistant</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>AI Assistant</h1>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: p.muted }}>Ask the AI to write content for a client. It knows the client's brand profile and documents.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "22px 0 18px", alignItems: "center" }}>
        <div style={{ width: 240 }}>
          <Select aria-label="Client" value={clientId} onChange={(e) => changeClient(e.target.value)}>
            <option value="">Choose a client…</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div style={{ width: 160 }}>
          <Select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as "Arabic" | "English")}>
            <option value="Arabic">Arabic</option>
            <option value="English">English</option>
          </Select>
        </div>
        {messages.length > 0 && <Btn small onClick={newConversation} disabled={busy}>New conversation</Btn>}
      </div>

      {clients.isLoading && <Loading />}
      {clients.isError && <Notice kind="error">{errorText(clients.error)}</Notice>}
      {clients.isSuccess && clients.data.length === 0 && <Notice kind="warning">There are no clients yet. Ask the owner to add one first.</Notice>}

      <div style={{ display: "grid", gap: 14, minHeight: 240, padding: 18, borderRadius: 16, border: `1px solid ${p.border}`, background: p.card }}>
        {messages.length === 0 && !busy && (
          <p style={{ margin: 0, fontSize: 14, color: p.muted, lineHeight: 1.6 }}>
            {clientId ? "Write what you need, for example: “Write an Instagram caption for our new offer.”" : "Choose a client first."}
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} style={{ display: "grid", gap: 8, justifyItems: m.role === "user" ? "end" : "start" }}>
            <div dir="auto" style={{
              maxWidth: "88%", padding: "12px 16px", borderRadius: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 15, lineHeight: 1.7,
              background: m.role === "user" ? p.pri : "transparent", color: m.role === "user" ? "#fff" : p.text,
              border: m.role === "user" ? "none" : `1px solid ${m.failed ? "#E5484D" : p.border}`,
            }}>
              {m.note && <div style={{ marginBottom: 6 }}><Badge tone="warn">The AI needs more information</Badge></div>}
              {m.failed && <div style={{ marginBottom: 6 }}><Badge tone="bad">Failed</Badge></div>}
              {m.text}
            </div>
            {m.corrected && <Badge>Corrected by the AI's fact check</Badge>}
            {m.role === "agent" && m.runId && !m.failed && !m.note && clientId && (
              <SaveAsContent clientId={Number(clientId)} runId={m.runId} text={m.text} />
            )}
          </div>
        ))}

        {busy && (
          <div style={{ fontSize: 14, color: p.muted }}>The AI is working on it. This usually takes between 15 seconds and 2 minutes…</div>
        )}
        {send.isError && <Notice kind="error">{errorText(send.error)}</Notice>}
        {run.isError && <Notice kind="error">{errorText(run.error)}</Notice>}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          maxLength={4000}
          dir="auto"
          placeholder={clientId ? "Write your request…" : "Choose a client first"}
          disabled={!clientId}
        />
        <div>
          <Btn variant="primary" type="submit" disabled={!canSend}>{busy ? "Waiting for the AI…" : "Send"}</Btn>
        </div>
      </form>
    </div>
  );
}

// "Save as content": the AI's answer becomes a draft the team can review and send for approval.
function SaveAsContent({ clientId, runId, text }: { clientId: number; runId: number; text: string }) {
  const { p } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("post");
  const [title, setTitle] = useState(text.replace(/\s+/g, " ").trim().slice(0, 50));

  const save = useMutation({ mutationFn: () => agentApi.saveAsContent({ client_id: clientId, type, platform: "instagram", title: title.trim(), agent_run_id: runId }) });

  if (save.isSuccess) {
    return (
      <div style={{ fontSize: 13 }}>
        <Notice kind="success">Saved as a draft. <Link to={`/content/${save.data.id}`} style={{ fontWeight: 600 }}>Open it to send it for approval</Link></Notice>
      </div>
    );
  }
  if (!open) return <Btn small onClick={() => setOpen(true)}>Save as content</Btn>;

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      style={{ display: "grid", gap: 10, width: "min(420px, 100%)", padding: 14, borderRadius: 14, border: `1px solid ${p.border}` }}>
      <Field label="Type" error={fieldError(save.error, "type")}>
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
        </Select>
      </Field>
      <Field label="Title *" error={fieldError(save.error, "title")}>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} dir="auto" />
      </Field>
      <span style={{ fontSize: 12, color: p.muted }}>Platform: Instagram</span>
      {save.isError && <Notice kind="error">{errorText(save.error)}</Notice>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn small variant="primary" type="submit" disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : "Save"}</Btn>
        <Btn small onClick={() => setOpen(false)}>Cancel</Btn>
      </div>
    </form>
  );
}