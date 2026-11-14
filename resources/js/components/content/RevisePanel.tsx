import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Btn, Card, Notice, TextArea, errorText } from "../Ui";

type Run = { id: number; status: "running" | "succeeded" | "failed"; needs_info: boolean; output: string | null; error: string | null };

export default function RevisePanel({ contentId }: { contentId: number }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [runId, setRunId] = useState<number | null>(null);

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

  const working = start.isPending || (runId !== null && (!run.data || run.data.status === "running"));
  const again = () => { setRunId(null); setNotes(""); start.reset(); };

  return (
    <Card>
      <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Ask the AI to change it</h3>
      <p style={{ margin: "6px 0 14px", fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
        Write what to change. The AI makes a new version and keeps the old ones.
      </p>

      {status === "succeeded" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {run.data?.needs_info ? (
            <Notice kind="warning">{run.data.output || "The AI needs more information before it can change this."}</Notice>
          ) : (
            <Notice kind="success">A new version is ready. It is now the current one and the status is Draft.</Notice>
          )}
          <div><Btn onClick={again}>Another change</Btn></div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" placeholder="For example: make it shorter and friendlier" disabled={working} />
          {start.isError && <Notice kind="error">{errorText(start.error)}</Notice>}
          {status === "failed" && <Notice kind="error">{run.data?.error || "The AI could not finish. Try again."}</Notice>}
          {run.isError && <Notice kind="error">{errorText(run.error)}</Notice>}
          {working && !start.isPending && <Notice>The AI is working on it. This can take up to a minute or two.</Notice>}
          <div>
            <Btn variant="primary" onClick={() => { setRunId(null); start.mutate(); }} disabled={working || !notes.trim()}>
              {working ? "Working…" : status === "failed" ? "Try again" : "Send notes"}
            </Btn>
          </div>
        </div>
      )}
    </Card>
  );
}