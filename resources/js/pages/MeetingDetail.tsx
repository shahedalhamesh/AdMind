import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { ApiError } from "../services/api";
import { usePortalTheme } from "../services/portalTheme";
import { usersApi } from "../services/users";
import { agentApi } from "../services/agent";
import { fmtDateTime, localToIso } from "../services/content";
import { AGENT_NAMES, TASK_PRIORITIES } from "../services/tasks";
import { MEETING_STATUS_LABEL, meetingsApi } from "../services/meetings";
import type { ActionItem } from "../services/meetings";
import { Badge, Btn, Card, Field, Loading, Modal, Notice, Select, TextArea, TextInput, errorText } from "../components/Ui";

export default function MeetingDetail() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const id = Number(useParams().id);
  const [runId, setRunId] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ["meeting", id],
    queryFn: () => meetingsApi.get(id),
    enabled: Number.isFinite(id),
    // speech to text or the AI summary is running: ask again every 4 seconds
    refetchInterval: (s) => (s.state.data?.meeting.status === "processing" || runId !== null ? 4000 : false),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["meeting", id] }); qc.invalidateQueries({ queryKey: ["meetings"] }); };

  // the summary is an AI run: wait for it (every 3 seconds), then reload the meeting
  const run = useQuery({ queryKey: ["agent-run", runId], queryFn: () => agentApi.run(runId as number), enabled: runId !== null, refetchInterval: (s) => (!s.state.data || s.state.data.status === "running" ? 3000 : false) });
  useEffect(() => { if (runId !== null && run.data && run.data.status !== "running") { setRunId(null); refresh(); } }, [run.data, runId]); // eslint-disable-line react-hooks/exhaustive-deps

  const summarize = useMutation({ mutationFn: () => meetingsApi.summarize(id), onSuccess: (r) => { setRunId(r.agent_run_id); refresh(); } });
  const remove = useMutation({ mutationFn: () => meetingsApi.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["meetings"] }); nav("/meetings"); } });

  const back = <Link to="/meetings" style={{ color: p.link, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>← All meetings</Link>;
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return <div style={{ maxWidth: 560 }}>{back}<h1 style={{ margin: "16px 0 0", fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 500 }}>{notFound ? "Meeting not found" : "Could not open this meeting"}</h1><p style={{ color: p.muted }}>{notFound ? "It does not exist, or it belongs to another company." : errorText(q.error)}</p></div>;
  }

  const { meeting, action_items } = q.data;
  const processing = meeting.status === "processing" || runId !== null;
  const canRun = can(user, "agents.run");
  const proposed = action_items.filter((a) => a.status === "proposed");
  const decided = action_items.filter((a) => a.status !== "proposed");

  return (
    <div>
      {back}
      <h1 dir="auto" style={{ margin: "14px 0 0", fontFamily: "Georgia, serif", fontSize: 36, fontWeight: 500, overflowWrap: "anywhere" }}>{meeting.title}</h1>
      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 14, color: p.muted }}>
        <Badge tone={meeting.status === "summarized" ? "good" : meeting.status === "failed" ? "bad" : "plain"}>{processing ? "Processing…" : MEETING_STATUS_LABEL[meeting.status] ?? meeting.status}</Badge>
        {meeting.held_at && <span>{fmtDateTime(meeting.held_at)}</span>}
      </div>
      {processing && <div style={{ marginTop: 16 }}><Notice>Working on it. This page updates by itself. It can take from a few seconds to a few minutes.</Notice></div>}
      {meeting.status === "failed" && <div style={{ marginTop: 16 }}><Notice kind="error">This step failed. You can upload the audio again, or press Summarize again.</Notice></div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 22, marginTop: 26, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <Transcript meetingId={id} value={meeting.transcript ?? ""} locked={processing || !canRun} onSaved={refresh} />
          {canRun && <Recorder meetingId={id} disabled={processing} onUploaded={refresh} />}
          {canRun && (
            <div>
              {summarize.isError && <div style={{ marginBottom: 10 }}><Notice kind="error">{errorText(summarize.error)}</Notice></div>}
              <Btn variant="primary" onClick={() => summarize.mutate()} disabled={processing || summarize.isPending || !(meeting.transcript ?? "").trim()}>
                {processing ? "Working…" : meeting.status === "summarized" ? "Summarize again" : "Summarize with the AI"}
              </Btn>
              {!(meeting.transcript ?? "").trim() && <span style={{ marginLeft: 10, fontSize: 12, color: p.muted }}>Add a transcript first.</span>}
            </div>
          )}
          {can(user, "tasks.assign") && (
            <div><Btn small variant="danger" onClick={() => { if (window.confirm("Delete this meeting?")) remove.mutate(); }} disabled={remove.isPending}>Delete meeting</Btn>{remove.isError && <Notice kind="error">{errorText(remove.error)}</Notice>}</div>
          )}
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {meeting.summary && (
            <Card>
              <h3 style={{ margin: "0 0 10px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Summary</h3>
              <div dir="auto" style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.7, overflowWrap: "anywhere" }}>{meeting.summary}</div>
              {meeting.key_insights && meeting.key_insights.length > 0 && (
                <ul dir="auto" style={{ margin: "14px 0 0", paddingInlineStart: 20, display: "grid", gap: 6, fontSize: 14, lineHeight: 1.6 }}>
                  {meeting.key_insights.map((k, i) => <li key={i}>{k}</li>)}
                </ul>
              )}
            </Card>
          )}

          <Card>
            <h3 style={{ margin: "0 0 12px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Action items</h3>
            {action_items.length === 0 && <p style={{ margin: 0, fontSize: 14, color: p.muted }}>None yet. The AI suggests them after the summary, or add one yourself.</p>}
            <div style={{ display: "grid", gap: 12 }}>
              {proposed.map((a) => <ItemRow key={a.id} item={a} onChanged={refresh} />)}
              {decided.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, opacity: 0.85 }}>
                  <span dir="auto" style={{ overflowWrap: "anywhere" }}>{a.description}</span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                    <Badge tone={a.status === "confirmed" ? "good" : "plain"}>{a.status === "confirmed" ? "Task created" : "Rejected"}</Badge>
                    {a.status === "confirmed" && a.task_id && <Link to="/tasks" style={{ color: p.link, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>Tasks →</Link>}
                  </span>
                </div>
              ))}
            </div>
            {canRun && <AddItem meetingId={id} onAdded={refresh} />}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Transcript({ meetingId, value, locked, onSaved }: { meetingId: number; value: string; locked: boolean; onSaved: () => void }) {
  const [text, setText] = useState(value);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setText(value); }, [value, dirty]);
  const save = useMutation({ mutationFn: () => meetingsApi.update(meetingId, { transcript: text }), onSuccess: () => { setDirty(false); onSaved(); } });
  return (
    <Card>
      <h3 style={{ margin: "0 0 10px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Transcript</h3>
      <TextArea value={text} onChange={(e) => { setText(e.target.value); setDirty(true); }} dir="auto" rows={10} maxLength={50000} disabled={locked} placeholder="Paste the text of the meeting here, or record the audio below." />
      {save.isError && <div style={{ marginTop: 10 }}><Notice kind="error">{errorText(save.error)}</Notice></div>}
      {!locked && <div style={{ marginTop: 10 }}><Btn small variant="primary" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>{save.isPending ? "Saving…" : "Save transcript"}</Btn></div>}
    </Card>
  );
}

// Record in the browser (MediaRecorder gives audio/webm) or upload an audio file. Participants must agree first.
function Recorder({ meetingId, disabled, onUploaded }: { meetingId: number; disabled: boolean; onUploaded: () => void }) {
  const { p } = usePortalTheme();
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState("ar");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = useMutation({ mutationFn: (v: { blob: Blob; name: string }) => meetingsApi.uploadRecording(meetingId, v.blob, v.name, language), onSuccess: onUploaded });

  useEffect(() => () => { window.clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        if (blob.size > 50 * 1024 * 1024) { setError("The recording is larger than 50 MB."); return; }
        upload.mutate({ blob, name: "meeting.webm" });
      };
      r.start();
      rec.current = r;
      setRecording(true);
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("Could not use the microphone. Allow it in the browser and try again.");
    }
  };
  const stop = () => { window.clearInterval(timer.current); setRecording(false); rec.current?.stop(); };
  const pickFile = (f?: File) => {
    setError("");
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { setError("The file is larger than 50 MB."); return; }
    upload.mutate({ blob: f, name: f.name });
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const busy = disabled || upload.isPending;

  return (
    <Card>
      <h3 style={{ margin: "0 0 6px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Audio</h3>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: p.muted, lineHeight: 1.5 }}>Record the meeting or upload an audio file. The server turns it into text. Uploading again replaces the old transcript.</p>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={recording} /> Everyone in the meeting agreed to be recorded
      </label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ width: 130 }}>
          <Select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={recording}>
            <option value="ar">Arabic</option><option value="en">English</option><option value="fr">French</option><option value="tr">Turkish</option>
          </Select>
        </div>
        {!recording ? <Btn onClick={start} disabled={!consent || busy}>● Record</Btn> : <Btn variant="danger" onClick={stop}>■ Stop and send ({mm}:{ss})</Btn>}
        <input ref={fileInput} type="file" hidden accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac,.webm,.mp4" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
        <Btn onClick={() => fileInput.current?.click()} disabled={!consent || busy || recording}>Upload audio</Btn>
      </div>
      {recording && <div role="status" style={{ marginTop: 12, color: "#E5484D", fontWeight: 600, fontSize: 14 }}>● Recording…</div>}
      {upload.isPending && <div style={{ marginTop: 12, fontSize: 13, color: p.muted }}>Sending the audio…</div>}
      {(error || upload.isError) && <div style={{ marginTop: 12 }}><Notice kind="error">{error || errorText(upload.error)}</Notice></div>}
    </Card>
  );
}

function ItemRow({ item, onChanged }: { item: ActionItem; onChanged: () => void }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const reject = useMutation({ mutationFn: () => meetingsApi.rejectItem(item.id), onSuccess: onChanged });
  const canDecide = can(user, "tasks.assign");
  return (
    <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${p.border}`, display: "grid", gap: 8 }}>
      <div dir="auto" style={{ fontSize: 14, lineHeight: 1.6, overflowWrap: "anywhere" }}>{item.description}</div>
      {item.due_date && <span style={{ fontSize: 12, color: p.muted }}>Due {item.due_date}</span>}
      {canDecide ? (
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="primary" onClick={() => setConfirming(true)}>Confirm as a task</Btn>
          <Btn small onClick={() => reject.mutate()} disabled={reject.isPending}>Reject</Btn>
        </div>
      ) : <Badge tone="warn">Waiting for a manager</Badge>}
      {reject.isError && <Notice kind="error">{errorText(reject.error)}</Notice>}
      {confirming && <ConfirmItem item={item} onClose={() => setConfirming(false)} onDone={() => { setConfirming(false); onChanged(); }} />}
    </div>
  );
}

function ConfirmItem({ item, onClose, onDone }: { item: ActionItem; onClose: () => void; onDone: () => void }) {
  const users = useQuery({ queryKey: ["users", { q: "", role_id: "", status: "active" }], queryFn: () => usersApi.list({ status: "active" }) });
  const staff = (users.data ?? []).filter((u) => u.client_id === null);
  const [assignee, setAssignee] = useState(item.suggested_assignee_id ? `user:${item.suggested_assignee_id}` : "");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("medium");
  const confirm = useMutation({
    mutationFn: () => {
      const [kind, value] = assignee.split(":");
      return meetingsApi.confirmItem(item.id, {
        priority,
        ...(due ? { due_at: localToIso(due) } : {}),
        ...(kind === "user" ? { assignee_user_id: Number(value) } : {}),
        ...(kind === "agent" ? { assignee_agent: value } : {}),
      });
    },
    onSuccess: onDone,
  });
  return (
    <Modal title="Confirm as a task" onClose={onClose} width={480}>
      <form onSubmit={(e) => { e.preventDefault(); confirm.mutate(); }} style={{ display: "grid", gap: 14 }}>
        <div dir="auto" style={{ fontSize: 14, lineHeight: 1.6 }}>{item.description}</div>
        <Field label="Assign to">
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{item.suggested_assignee_id ? "The suggested person" : "Nobody yet"}</option>
            <optgroup label="Team">{staff.map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name}</option>)}</optgroup>
            <optgroup label="AI agent">{AGENT_NAMES.map((a) => <option key={a} value={`agent:${a}`}>AI · {a}</option>)}</optgroup>
          </Select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value)}>{TASK_PRIORITIES.map((x) => <option key={x} value={x}>{x}</option>)}</Select></Field>
          <Field label="Due"><TextInput type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        {confirm.isError && <Notice kind="error">{errorText(confirm.error)}</Notice>}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" type="submit" disabled={confirm.isPending}>{confirm.isPending ? "Creating…" : "Create the task"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}

function AddItem({ meetingId, onAdded }: { meetingId: number; onAdded: () => void }) {
  const [text, setText] = useState("");
  const add = useMutation({ mutationFn: () => meetingsApi.addItem(meetingId, { description: text.trim() }), onSuccess: () => { setText(""); onAdded(); } });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate(); }} style={{ display: "flex", gap: 8, marginTop: 14 }}>
      <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an action item…" dir="auto" maxLength={1000} />
      <Btn type="submit" disabled={add.isPending || !text.trim()}>Add</Btn>
    </form>
  );
}