import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useAuth } from "../AuthContext";
import { can } from "../../services/auth";
import { mediaApi } from "../../services/media";
import { usePortalTheme } from "../../services/portalTheme";
import { Notice, TextArea, errorText } from "../Ui";

type Run = { id: number; status: "running" | "succeeded" | "failed"; needs_info: boolean; output: string | null; error: string | null };
type MediaJob = { id: number; old: number[] }; // the new file being made, and the old files it replaces

export default function RevisePanel({ contentId, clientId }: { contentId: number; clientId: number }) {
  const qc = useQueryClient();
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [doText, setDoText] = useState(true);
  const [doMedia, setDoMedia] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [job, setJob] = useState<MediaJob | null>(null);
  const [mediaNote, setMediaNote] = useState("");
  const handled = useRef(false);

  // the files attached to this post (same cache as the gallery)
  const attached = useQuery({ queryKey: ["content-media", contentId], queryFn: () => mediaApi.forContent(contentId) });
  const prev = (attached.data ?? []).find((m) => m.prompt) ?? null;
  const isReel = prev?.type === "video";
  const kind: "image" | "reel" = isReel ? "reel" : "image";
  const canMakeMedia = can(user, "content.create") && !!prev;

  // ---- text ----
  const start = useMutation({
    mutationFn: () => api<{ agent_run_id: number }>(`/content/${contentId}/revise`, { method: "POST", body: { notes: notes.trim() } }),
    onSuccess: (r) => setRunId(r.agent_run_id),
  });
  const run = useQuery({
    queryKey: ["agent-run", runId],
    queryFn: () => api<Run>(`/agent/runs/${runId}`),
    enabled: runId !== null,
    refetchInterval: (q) => (!q.state.data || q.state.data.status === "running" ? 3000 : false),
  });
  const status = run.data?.status;
  useEffect(() => {
    if (status === "succeeded" || status === "failed") {
      qc.invalidateQueries({ queryKey: ["content", contentId] });
      qc.invalidateQueries({ queryKey: ["content-list"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
  }, [status, contentId, qc]);

  // ---- image / reel ----
  const make = useMutation({
    mutationFn: () => {
      const sameType = (attached.data ?? []).filter((m) => m.type === prev!.type).map((m) => m.id);
      const request = `${prev!.prompt}\n\nChange requested: ${notes.trim()}`.slice(0, 2000);
      return mediaApi
        .generate({
          client_id: clientId,
          kind,
          request,
          aspect_ratio: prev!.aspect_ratio ?? (isReel ? "9:16" : "1:1"),
          content_id: contentId,
          ...(isReel ? { language: "Arabic" as const } : {}),
        })
        .then((m) => ({ id: m.id, old: sameType }));
    },
    onSuccess: (j) => { handled.current = false; setJob(j); },
  });
  const media = useQuery({
    queryKey: ["media-item", job?.id],
    queryFn: () => mediaApi.get(job!.id),
    enabled: job !== null,
    refetchInterval: (q) => (!q.state.data || q.state.data.status === "processing" ? 5000 : false),
  });
  const mstatus = media.data?.status;
  useEffect(() => {
    if (mstatus !== "ready" || !job || handled.current) return;
    handled.current = true;
    (async () => {
      try {
        // make sure the new file is attached, then remove the old ones
        const now = await mediaApi.forContent(contentId);
        if (!now.some((m) => m.id === job.id)) await mediaApi.attach(contentId, job.id);
        for (const oldId of job.old) await mediaApi.detach(contentId, oldId);
        setMediaNote("");
      } catch {
        setMediaNote("The new file was added, but the old one could not be removed. Remove it by hand.");
      }
      qc.invalidateQueries({ queryKey: ["content-media", contentId] });
    })();
  }, [mstatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const textWorking = start.isPending || (runId !== null && (!run.data || run.data.status === "running"));
  const mediaWorking = make.isPending || (job !== null && (!media.data || media.data.status === "processing"));
  const working = textWorking || mediaWorking;

  const send = () => {
    setRunId(null); setJob(null); setMediaNote(""); start.reset(); make.reset();
    if (doText) start.mutate();
    if (doMedia && canMakeMedia) make.mutate();
  };

  const canGo = !working && !!notes.trim() && (doText || (doMedia && canMakeMedia));

  return (
    <div className="ai-surface" style={{ padding: 20 }}>
      <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500, color: p.aiText, display: "flex", alignItems: "center", gap: 10 }}>
        <span className="ai-dot" />Ask the AI to change it
      </h3>
      <p style={{ margin: "6px 0 14px", fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
        Write what to change, then choose what the AI should change. The text keeps its old versions. A new image or reel replaces the old one.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" placeholder="For example: two people sitting at the same table, snow outside" disabled={working} />

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={doText} onChange={(e) => setDoText(e.target.checked)} disabled={working} />
            Change the text
          </label>
          {canMakeMedia && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={doMedia} onChange={(e) => setDoMedia(e.target.checked)} disabled={working} />
              Make a new {isReel ? "reel" : "image"}
            </label>
          )}
        </div>

        {start.isError && <Notice kind="error">{errorText(start.error)}</Notice>}
        {status === "failed" && <Notice kind="error">{run.data?.error || "The AI could not finish the text. Try again."}</Notice>}
        {run.isError && <Notice kind="error">{errorText(run.error)}</Notice>}
        {status === "succeeded" && (run.data?.needs_info
          ? <Notice kind="warning">{run.data.output || "The AI needs more information before it can change this."}</Notice>
          : <Notice kind="success">A new text version is ready. It is now the current one and the status is Draft.</Notice>)}

        {make.isError && <Notice kind="error">{errorText(make.error)}</Notice>}
        {mstatus === "failed" && <Notice kind="error">{media.data?.error || "The AI could not make the file."} The old file was kept.</Notice>}
        {mstatus === "ready" && <Notice kind="success">The new {isReel ? "reel" : "image"} is ready and replaced the old one.</Notice>}
        {mediaNote && <Notice kind="warning">{mediaNote}</Notice>}

        {working && !start.isPending && !make.isPending && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: p.aiText }}>
            <span className="ai-dot" />
            <span>
              The AI is working on it.
              {mediaWorking && media.data?.metadata?.step ? ` (${media.data.metadata.step.replace(/_/g, " ")})` : ""} You can stay on this page.
            </span>
          </div>
        )}

        <div>
          <button
            type="button"
            className="ai-button ai-button-solid"
            onClick={send}
            disabled={!canGo}
            style={{ padding: "10px 22px", cursor: canGo ? "pointer" : "not-allowed", opacity: canGo ? 1 : 0.55 }}
          >
            {working ? "Working…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}