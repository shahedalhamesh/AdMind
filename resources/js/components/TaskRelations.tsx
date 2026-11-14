import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../services/api";
import { can } from "../services/auth";
import { useAuth } from "./AuthContext";
import { usePortalTheme } from "../services/portalTheme";
import { Badge, Btn, Notice, Select, TextInput, errorText } from "./Ui";

type Mini = { id: number; title: string; status: string };
type Detail = { task: { id: number; client_id: number | null }; subtasks: Mini[]; depends_on: Mini[]; blocked: boolean };
type ListRes = { data: Mini[] };

const tone = (s: string): "good" | "warn" | "bad" | "plain" => (s === "completed" ? "good" : s === "failed" ? "bad" : s === "in_progress" ? "warn" : "plain");
const label = (s: string) => s.replace(/_/g, " ");

export default function TaskRelations({ taskId, clientId }: { taskId: number; clientId?: number | null }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [dep, setDep] = useState("");

  const q = useQuery({ queryKey: ["task-relations", taskId], queryFn: () => api<Detail>(`/tasks/${taskId}`) });

  const canCreate = can(user, "tasks.create");
  const canAssign = can(user, "tasks.assign");

  // tasks that could be a dependency (same client when known)
  const candidates = useQuery({
    queryKey: ["task-candidates", clientId ?? "all"],
    queryFn: () => api<ListRes>("/tasks", { params: { per_page: 100, top_level: 1, ...(clientId ? { client_id: String(clientId) } : {}) } }),
    enabled: canAssign,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["task-relations", taskId] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["task"] });
  };

  const addSub = useMutation({
    mutationFn: () => api<unknown>("/tasks", { method: "POST", body: { title: title.trim(), parent_task_id: taskId, ...(clientId ? { client_id: clientId } : {}) } }),
    onSuccess: () => { setTitle(""); refresh(); },
  });
  const addDep = useMutation({
    mutationFn: () => api<unknown>(`/tasks/${taskId}/dependencies`, { method: "POST", body: { depends_on_task_id: Number(dep) } }),
    onSuccess: () => { setDep(""); refresh(); },
  });
  const removeDep = useMutation({
    mutationFn: (id: number) => api<unknown>(`/tasks/${taskId}/dependencies/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  if (q.isLoading) return <span style={{ fontSize: 13, color: p.muted }}>Loading…</span>;
  if (q.isError || !q.data) return <Notice kind="error">{errorText(q.error)}</Notice>;
  const { subtasks, depends_on, blocked } = q.data;

  const taken = new Set([taskId, ...depends_on.map((d) => d.id)]);
  const options = (candidates.data?.data ?? []).filter((t) => !taken.has(t.id));

  const h: React.CSSProperties = { margin: "0 0 10px", fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 500 };
  const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 14, padding: "6px 0" };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {blocked && <Notice kind="warning">This task is blocked. It cannot be completed until the tasks it waits for are finished.</Notice>}

      <div>
        <h4 style={h}>Subtasks</h4>
        {subtasks.length === 0 && <span style={{ fontSize: 13, color: p.muted }}>No subtasks.</span>}
        {subtasks.map((s) => (
          <div key={s.id} style={row}>
            <span dir="auto" style={{ overflowWrap: "anywhere" }}>{s.title}</span>
            <Badge tone={tone(s.status)}>{label(s.status)}</Badge>
          </div>
        ))}
        {canCreate && (
          <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) addSub.mutate(); }} style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1 }}><TextInput placeholder="New subtask title" value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" maxLength={255} /></div>
            <Btn type="submit" disabled={!title.trim() || addSub.isPending}>{addSub.isPending ? "Adding…" : "Add"}</Btn>
          </form>
        )}
        {addSub.isError && <div style={{ marginTop: 8 }}><Notice kind="error">{errorText(addSub.error)}</Notice></div>}
      </div>

      <div>
        <h4 style={h}>Waits for</h4>
        {depends_on.length === 0 && <span style={{ fontSize: 13, color: p.muted }}>Does not wait for any task.</span>}
        {depends_on.map((d) => (
          <div key={d.id} style={row}>
            <span dir="auto" style={{ overflowWrap: "anywhere" }}>{d.title}</span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge tone={tone(d.status)}>{label(d.status)}</Badge>
              {canAssign && <Btn small onClick={() => removeDep.mutate(d.id)} disabled={removeDep.isPending}>Remove</Btn>}
            </span>
          </div>
        ))}
        {canAssign && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <Select aria-label="Task to wait for" value={dep} onChange={(e) => setDep(e.target.value)}>
                <option value="">Choose a task…</option>
                {options.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
            </div>
            <Btn onClick={() => addDep.mutate()} disabled={!dep || addDep.isPending}>{addDep.isPending ? "Adding…" : "Add"}</Btn>
          </div>
        )}
        {(addDep.isError || removeDep.isError) && <div style={{ marginTop: 8 }}><Notice kind="error">{errorText(addDep.error ?? removeDep.error)}</Notice></div>}
      </div>
    </div>
  );
}