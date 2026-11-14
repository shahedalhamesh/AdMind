import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { meetingsApi } from "../services/meetings";
import { Btn, Field, Modal, Notice, Select, TextInput, errorText } from "./Ui";

type Phase = "idle" | "recording" | "sending" | "transcribing" | "summarizing" | "error";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One button: record the meeting, then it is created, uploaded, turned into text and summarized by the AI.
export default function QuickRecordMeeting({ defaultClient, onClose }: { defaultClient?: string; onClose: () => void }) {
  const { p } = usePortalTheme();
  const nav = useNavigate();
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });

  const [clientId, setClientId] = useState(defaultClient ?? "");
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("ar");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; window.clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  const fail = (msg: string) => { setError(msg); setPhase("error"); };

  const process = async (blob: Blob) => {
    try {
      setPhase("sending");
      const name = title.trim() || `Meeting ${new Date().toLocaleDateString("en-GB")}`;
      const meeting = await meetingsApi.create({ client_id: Number(clientId), title: name });
      await meetingsApi.uploadRecording(meeting.id, blob, "meeting.webm", language);
      qc.invalidateQueries({ queryKey: ["meetings"] });

      // the server turns the audio into text: ask every 4 seconds (up to about 15 minutes)
      setPhase("transcribing");
      let status = "processing";
      for (let i = 0; i < 225 && status === "processing"; i++) {
        await wait(4000);
        if (!alive.current) return;
        status = (await meetingsApi.get(meeting.id)).meeting.status;
      }
      if (status !== "uploaded") { fail("The audio could not be turned into text. Open the meeting and try again."); nav(`/meetings/${meeting.id}`); return; }

      setPhase("summarizing");
      await meetingsApi.summarize(meeting.id);
      if (alive.current) nav(`/meetings/${meeting.id}`); // that page waits for the summary by itself
    } catch (e) {
      if (alive.current) fail(errorText(e));
    }
  };

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
        if (blob.size > 50 * 1024 * 1024) { fail("The recording is larger than 50 MB. Record a shorter meeting."); return; }
        void process(blob);
      };
      r.start();
      rec.current = r;
      setPhase("recording");
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      fail("Could not use the microphone. Allow it in the browser and try again.");
    }
  };
  const stop = () => { window.clearInterval(timer.current); rec.current?.stop(); };

  const busy = phase === "sending" || phase === "transcribing" || phase === "summarizing";
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const msg: Record<string, string> = { sending: "Sending the audio…", transcribing: "Turning the audio into text… this can take a few minutes.", summarizing: "The AI is summarizing…" };

  return (
    <Modal title="Record a meeting" onClose={() => { if (phase !== "recording" && !busy) onClose(); }} width={540}>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Client *">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={phase !== "idle" && phase !== "error"}>
            <option value="">Choose…</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Title" hint="Optional. If you leave it empty, it is named with today's date.">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} dir="auto" disabled={phase !== "idle" && phase !== "error"} />
        </Field>
        <Field label="Spoken language">
          <Select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={phase !== "idle" && phase !== "error"}>
            <option value="ar">Arabic</option><option value="en">English</option><option value="fr">French</option><option value="tr">Turkish</option>
          </Select>
        </Field>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={phase === "recording" || busy} /> Everyone in the meeting agreed to be recorded
        </label>

        {phase === "recording" && <div role="status" style={{ color: "#E5484D", fontWeight: 600, fontSize: 15 }}>● Recording… {mm}:{ss}</div>}
        {busy && <Notice>{msg[phase]} Keep this page open.</Notice>}
        {error && <Notice kind="error">{error}</Notice>}

        <div style={{ display: "flex", gap: 8 }}>
          {phase !== "recording" ? (
            <Btn variant="primary" onClick={start} disabled={!consent || !clientId || busy}>● Start recording</Btn>
          ) : (
            <Btn variant="danger" onClick={stop}>■ Stop and analyze</Btn>
          )}
          <Btn onClick={onClose} disabled={phase === "recording" || busy}>Cancel</Btn>
        </div>
        <span style={{ fontSize: 12, color: p.muted, lineHeight: 1.5 }}>When you stop, the meeting is created and the AI writes the summary and suggests action items. You confirm them on the next page.</span>
      </div>
    </Modal>
  );
}