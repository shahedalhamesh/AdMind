import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { can } from "../../services/auth";
import { usePortalTheme } from "../../services/portalTheme";
import { agentApi, NOTE_PREFIX } from "../../services/agent";
import type { AgentRun } from "../../services/agent";
import { CONTENT_TYPES, contentApi } from "../../services/content";
import { ASPECT_RATIOS, mediaApi } from "../../services/media";
import { MediaPreview } from "./MediaGallery";
import { Badge, Btn, Field, Notice, Select, TextArea, TextInput, errorText, fieldError } from "../Ui";

type Mode = "text" | "image" | "reel";
type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "agent"; text: string; runId: number; note: boolean; failed: boolean; corrected: boolean }
  | { id: number; role: "media"; mediaId: number };

let nextId = 1;

const STEP_LABEL: Record<string, string> = {
  queued: "Waiting in the queue…",
  video_voice_music: "Building the video, the voiceover and the music…",
};
const stepLabel = (s?: string) => (s ? STEP_LABEL[s] ?? s.replace(/_/g, " ") + "…" : "Starting…");

// One place to talk to the AI: it writes text, or makes an image or a reel.
export default function AiStudio({ clients, onClose }: { clients: { id: number; name: string }[]; onClose: () => void }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canMedia = can(user, "content.create");

  const [clientId, setClientId] = useState("");
  const [mode, setMode] = useState<Mode>("text");
  const [language, setLanguage] = useState<"Arabic" | "English">("Arabic");
  const [ratio, setRatio] = useState("1:1");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [runId, setRunId] = useState<number | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: (message: string) => agentApi.chat({ client_id: Number(clientId), message, conversation_id: conversationId, language }),
    onSuccess: (res) => {
      setConversationId(res.conversation_id);
      setRunId(res.agent_run_id);
    },
  });

  const generate = useMutation({
    mutationFn: (request: string) =>
      mediaApi.generate({
        client_id: Number(clientId),
        kind: mode === "reel" ? "reel" : "image",
        request,
        aspect_ratio: ratio,
        ...(mode === "reel" ? { language } : {}),
      }),
    onSuccess: (media) => {
      setMessages((m) => [...m, { id: nextId++, role: "media", mediaId: media.id }]);
      qc.invalidateQueries({ queryKey: ["media"] });
    },
  });

  const run = useQuery({
    queryKey: ["agent-run", runId],
    queryFn: () => agentApi.run(runId as number),
    enabled: runId !== null,
    refetchInterval: (q) => (!q.state.data || q.state.data.status === "running" ? 3000 : false),
  });

  // when a text answer is ready, add it to the chat
  useEffect(() => {
    const r: AgentRun | undefined = run.data;
    if (runId === null || !r || r.id !== runId || r.status === "running") return;
    const text = r.status === "failed" ? r.error || "The AI could not finish. Try again later." : r.output || "";
    setMessages((m) => [
      ...m,
      {
        id: nextId++, role: "agent", text, runId: r.id,
        failed: r.status === "failed",
        corrected: r.verification_status === "corrected",
        note: r.status === "succeeded" && (!!r.needs_info || text.startsWith(NOTE_PREFIX)),
      },
    ]);
    setRunId(null);
  }, [run.data, runId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, runId]);

  const busy = send.isPending || generate.isPending || runId !== null;
  const canSend = !!clientId && input.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSend) return;
    const text = input.trim();
    setMessages((m) => [...m, { id: nextId++, role: "user", text }]);
    setInput("");
    if (mode === "text") send.mutate(text);
    else generate.mutate(text);
  };

  const chooseMode = (m: Mode) => {
    setMode(m);
    setRatio(m === "reel" ? "9:16" : "1:1");
    send.reset();
    generate.reset();
  };
  const newConversation = () => { setMessages([]); setConversationId(null); setRunId(null); send.reset(); generate.reset(); };
  const changeClient = (v: string) => { setClientId(v); newConversation(); };

  const placeholder = !clientId
    ? "Choose a client first"
    : mode === "text" ? "Write your request…"
    : mode === "image" ? "Describe the image you want…"
    : "Describe the reel you want. Add “female voice” or “male voice” if you want a voiceover…";

  const modeBtn = (m: Mode, label: string) => (
    <button
      type="button"
      className={mode === m ? "ai-button ai-button-solid" : "ai-button"}
      style={{ padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
      onClick={() => chooseMode(m)}
    >
      {label}
    </button>
  );

  return (
    <div className="ai-surface" style={{ marginBottom: 26, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 500, color: p.aiText, display: "flex", alignItems: "center", gap: 10 }}>
          <span className="ai-dot" />Create with AI
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          {messages.length > 0 && <Btn small onClick={newConversation} disabled={busy}>New conversation</Btn>}
          <Btn small onClick={onClose}>Close</Btn>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "16px 0", alignItems: "center" }}>
        <div style={{ width: 240 }}>
          <Select aria-label="Client" value={clientId} onChange={(e) => changeClient(e.target.value)}>
            <option value="">Choose a client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div style={{ width: 150 }}>
          <Select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as "Arabic" | "English")}>
            <option value="Arabic">Arabic</option>
            <option value="English">English</option>
          </Select>
        </div>
        {mode !== "text" && (
          <div style={{ width: 110 }}>
            <Select aria-label="Shape" value={ratio} onChange={(e) => setRatio(e.target.value)}>
              {ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 14, minHeight: 160, padding: 16, borderRadius: 14, border: `1px solid ${p.border}` }}>
        {messages.length === 0 && !busy && (
          <p style={{ margin: 0, fontSize: 14, color: p.muted, lineHeight: 1.6 }}>
            {clientId ? "Choose Text, Image or Reel, then write what you need." : "Choose a client first."}
          </p>
        )}

        {messages.map((m) => {
          if (m.role === "media") return <MediaCard key={m.id} id={m.mediaId} clientId={Number(clientId)} />;
          return (
            <div key={m.id} style={{ display: "grid", gap: 8, justifyItems: m.role === "user" ? "end" : "start" }}>
              <div dir="auto" style={{
                maxWidth: "88%", padding: "12px 16px", borderRadius: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 15, lineHeight: 1.7,
                background: m.role === "user" ? `linear-gradient(135deg, ${p.ai2}, ${p.ai})` : p.aiBg,
                color: m.role === "user" ? p.aiOn : p.text,
                border: m.role === "user" ? "none" : `1px solid ${m.role === "agent" && m.failed ? "#E5484D" : p.aiBorder}`,
              }}>
                {m.role === "agent" && m.note && <div style={{ marginBottom: 6 }}><Badge tone="warn">The AI needs more information</Badge></div>}
                {m.role === "agent" && m.failed && <div style={{ marginBottom: 6 }}><Badge tone="bad">Failed</Badge></div>}
                {m.text}
              </div>
              {m.role === "agent" && m.corrected && <Badge>Corrected by the AI's fact check</Badge>}
              {m.role === "agent" && !m.failed && !m.note && clientId && (
                <SaveAsContent clientId={Number(clientId)} runId={m.runId} text={m.text} />
              )}
            </div>
          );
        })}

        {busy && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: p.aiText }}>
            <span className="ai-dot" />
            {mode === "text" ? "The AI is working on it. This usually takes between 15 seconds and 2 minutes…" : "Sending your request…"}
          </div>
        )}
        {send.isError && <Notice kind="error">{errorText(send.error)}</Notice>}
        {generate.isError && <Notice kind="error">{errorText(generate.error)}</Notice>}
        {run.isError && <Notice kind="error">{errorText(run.error)}</Notice>}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {modeBtn("text", "Text")}
          {canMedia && modeBtn("image", "Image")}
          {canMedia && modeBtn("reel", "Reel")}
        </div>
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          maxLength={mode === "text" ? 4000 : 2000}
          dir="auto"
          placeholder={placeholder}
          disabled={!clientId}
        />
        {mode === "reel" && (
          <span style={{ fontSize: 12, color: p.muted, lineHeight: 1.5 }}>
            A reel takes 2 to 12 minutes. You can leave this page. The AI builds one file at a time.
          </span>
        )}
        <div>
          <button
            type="submit"
            className="ai-button ai-button-solid"
            disabled={!canSend}
            style={{ padding: "10px 22px", cursor: canSend ? "pointer" : "not-allowed", opacity: canSend ? 1 : 0.55 }}
          >
            {busy ? "Please wait…" : mode === "text" ? "Send" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

// A card for one image or reel: shows the progress, then the file.
function MediaCard({ id, clientId }: { id: number; clientId: number }) {
  const { p } = usePortalTheme();
  const q = useQuery({
    queryKey: ["media-item", id],
    queryFn: () => mediaApi.get(id),
    refetchInterval: (s) => (s.state.data?.status === "processing" ? 5000 : false),
  });
  const m = q.data;

  const box: React.CSSProperties = { maxWidth: 420, padding: 14, borderRadius: 14, border: `1px solid ${p.border}`, display: "grid", gap: 10 };

  if (q.isError) return <Notice kind="error">{errorText(q.error)}</Notice>;
  if (!m) return <div style={{ ...box, color: p.muted, fontSize: 14 }}>Starting…</div>;
  if (m.status === "processing") {
    return (
      <div style={{ ...box, color: p.muted, fontSize: 14, borderColor: p.aiBorder }}>
        <span><span className="ai-dot" style={{ marginInlineEnd: 8 }} /><strong style={{ color: p.text }}>{m.type === "video" ? "Reel" : "Image"}</strong> · {stepLabel(m.metadata?.step)}</span>
        <span style={{ fontSize: 12 }}>You can leave this page. You will get a notification when it is ready.</span>
      </div>
    );
  }
  if (m.status === "failed") return <Notice kind="error">{m.error || "The AI could not make this file."}</Notice>;

  return (
    <div style={box}>
      <MediaPreview m={m} onBroken={() => q.refetch()} />
      {m.metadata?.script && <div dir="auto" style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6 }}><strong>Voiceover:</strong> {m.metadata.script}</div>}
      <span style={{ fontSize: 12, color: p.muted }}>
        Saved in the <Link to="/media" style={{ fontWeight: 600 }}>Media library</Link>.
      </span>
      <AddToDraft mediaId={m.id} clientId={clientId} />
    </div>
  );
}

// "Add to a draft": attach this image or reel to one of the client's drafts.
function AddToDraft({ mediaId, clientId }: { mediaId: number; clientId: number }) {
  const qc = useQueryClient();
  const [postId, setPostId] = useState("");
  const drafts = useQuery({
    queryKey: ["drafts-for-media", clientId],
    queryFn: () => contentApi.list({ client_id: String(clientId), status: "draft", type: "", platform: "", page: 1, per_page: 50 }),
  });
  const add = useMutation({
    mutationFn: () => mediaApi.attach(Number(postId), mediaId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content-media", Number(postId)] }),
  });

  if (add.isSuccess) {
    return <Notice kind="success">Added to the draft. <Link to={`/content/${postId}`} style={{ fontWeight: 600 }}>Open the post</Link></Notice>;
  }
  const list = drafts.data?.data ?? [];
  if (drafts.isLoading) return null;
  if (list.length === 0) return <Notice>No drafts for this client yet. Write a text and press “Save as content” first.</Notice>;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Select aria-label="Draft" value={postId} onChange={(e) => setPostId(e.target.value)}>
        <option value="">Choose a draft…</option>
        {list.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </Select>
      {add.isError && <Notice kind="error">{errorText(add.error)}</Notice>}
      <div><Btn small variant="primary" onClick={() => add.mutate()} disabled={!postId || add.isPending}>{add.isPending ? "Adding…" : "Add to a draft"}</Btn></div>
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