import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../components/AuthContext";
import { can } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { clientsApi } from "../services/clients";
import { usersApi } from "../services/users";
import { CONTENT_TYPES, fmtDateTime, localToIso } from "../services/content";
import { AGENT_NAMES, TASK_PRIORITIES, TASK_STATUSES, isTaskOverdue, priorityTone, taskTone, tasksApi } from "../services/tasks";
import type { Task, TaskStatus } from "../services/tasks";
import { Badge, Btn, Field, Loading, Modal, Notice, RED, Select, TextArea, TextInput, errorText, fieldError } from "../components/Ui";
import TaskRelations from "../components/TaskRelations";
export default function Tasks() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState("");
  const [mine, setMine] = useState(false);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}), enabled: can(user, "clients.view") });
  const list = useQuery({
    queryKey: ["tasks", { clientId, priority, mine }],
    queryFn: () => tasksApi.list({ client_id: clientId, priority, top_level: "1", per_page: 100, ...(mine ? { mine: "1" } : {}) }),
  });
  const tasks = list.data?.data ?? [];

  const card = (t: Task) => (
    <button key={t.id} type="button" onClick={() => setOpenTask(t)}
      style={{ textAlign: "start", display: "grid", gap: 8, padding: "12px 14px", borderRadius: 12, border: `1px solid ${isTaskOverdue(t) ? RED : p.border}`, background: p.card, color: p.text, cursor: "pointer", fontFamily: "inherit" }}>
      <span dir="auto" style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{t.title}</span>
      {t.client && <span style={{ fontSize: 12, color: p.muted }}>{t.client.name}</span>}
      <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
        <span style={{ fontSize: 12, color: p.muted }}>{t.assignee_type === "agent" ? `AI · ${t.assignee_agent}` : t.assignee_user?.name ?? "Unassigned"}</span>
      </span>
      {t.due_at && <span style={{ fontSize: 12, color: isTaskOverdue(t) ? RED : p.muted }}>Due {fmtDateTime(t.due_at)}</span>}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Tasks</p>
          <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Tasks</h1>
        </div>
        {can(user, "tasks.create") && <Btn variant="primary" onClick={() => setCreating(true)}>+ New task</Btn>}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "22px 0 18px", alignItems: "center" }}>
        {can(user, "clients.view") && (
          <div style={{ width: 200 }}>
            <Select aria-label="Filter by client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">All clients</option>
              {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
        )}
        <div style={{ width: 160 }}>
          <Select aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All priorities</option>
            {TASK_PRIORITIES.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
          </Select>
          
        </div>
               <Btn small variant={mine ? "primary" : "ghost"} onClick={() => setMine((v) => !v)}>My tasks</Btn>
      </div>
      

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && tasks.length === 0 && (
        <div style={{ padding: 28, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 15 }}>No tasks yet.</div>
      )}

      {tasks.length > 0 && (
        <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(230px, 1fr)", gap: 14, overflowX: "auto", paddingBottom: 12, alignItems: "start" }}>
          {TASK_STATUSES.map((s) => {
            const col = tasks.filter((t) => t.status === s.id);
            return (
              <div key={s.id} style={{ display: "grid", gap: 10, alignContent: "start" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: p.muted }}>
                  <span>{s.label}</span><span>{col.length}</span>
                </div>
                {col.map(card)}
              </div>
            );
          })}
        </div>
      )}

      {openTask && <TaskDetail task={openTask} onClose={() => setOpenTask(null)} />}
      {creating && <TaskForm onClose={() => setCreating(false)} />}
    </div>
  );
}

function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [contentType, setContentType] = useState("post");
  const [language, setLanguage] = useState<"Arabic" | "English">("Arabic");
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const save = useMutation({ mutationFn: () => tasksApi.setStatus(task.id, status), onSuccess: () => { refresh(); onClose(); } });
  const remove = useMutation({ mutationFn: () => tasksApi.remove(task.id), onSuccess: () => { refresh(); onClose(); } });
  const run = useMutation({ mutationFn: () => tasksApi.run(task.id, { content_type: contentType, platform: "instagram", language }), onSuccess: refresh });

  const canRun = can(user, "tasks.assign") && task.assignee_type === "agent" && ["new", "failed", "waiting_info"].includes(task.status);
  const err = save.error ?? remove.error ?? run.error;
    const canAssign = can(user, "tasks.assign");
  // "Waiting for approval" is set by the system only. "Completed" by hand only for the Owner and the Manager.
  const statusOptions = TASK_STATUSES.filter((s) => s.id === task.status || (!["waiting_approval", "failed"].includes(s.id) && (s.id !== "completed" || canAssign)));

  return (
    <Modal title={task.title} onClose={onClose} width={560}>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge tone={taskTone(task.status)}>{TASK_STATUSES.find((s) => s.id === task.status)?.label ?? task.status}</Badge>
          <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
          {task.client && <Link to={`/clients/${task.client.id}`} style={{ color: p.link, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>{task.client.name}</Link>}
        </div>
        {task.description && <div dir="auto" style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, overflowWrap: "anywhere" }}>{task.description}</div>}
        <div style={{ fontSize: 13, color: p.muted }}>
          {task.assignee_type === "agent" ? `Assigned to the AI (${task.assignee_agent})` : task.assignee_user ? `Assigned to ${task.assignee_user.name}` : "Not assigned"}
          {task.due_at && ` · Due ${fmtDateTime(task.due_at)}`}
        </div>
        <TaskRelations taskId={task.id} clientId={task.client_id} />

        {can(user, "tasks.update") && (
          <Field label="Status" error={fieldError(save.error, "status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                            {statusOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
        )}

        {canRun && (
          <div style={{ display: "grid", gap: 10, padding: 14, borderRadius: 12, border: `1px solid ${p.border}` }}>
            <strong style={{ fontSize: 14 }}>Run with the AI</strong>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ width: 150 }}>
                <Select aria-label="Content type" value={contentType} onChange={(e) => setContentType(e.target.value)}>
                  {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
                </Select>
              </div>
              <div style={{ width: 150 }}>
                <Select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as "Arabic" | "English")}>
                  <option value="Arabic">Arabic</option>
                  <option value="English">English</option>
                </Select>
              </div>
            </div>
            {run.isSuccess ? (
              <Notice kind="success">The AI is working on it. When the draft is ready, the reviewer gets a notification and it appears in Content.</Notice>
            ) : (
              <div><Btn small variant="primary" onClick={() => run.mutate()} disabled={run.isPending}>{run.isPending ? "Starting…" : "Run"}</Btn></div>
            )}
          </div>
        )}

        {err && <Notice kind="error">{errorText(err)}</Notice>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {can(user, "tasks.update") && <Btn variant="primary" onClick={() => save.mutate()} disabled={save.isPending || status === task.status}>{save.isPending ? "Saving…" : "Save status"}</Btn>}
            <Btn onClick={onClose}>Close</Btn>
          </div>
          {can(user, "tasks.delete") && (
            <Btn variant="danger" onClick={() => { if (window.confirm("Delete this task and its subtasks?")) remove.mutate(); }} disabled={remove.isPending}>Delete</Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}

function TaskForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ["clients", { q: "", status: "" }], queryFn: () => clientsApi.list({}) });
  const users = useQuery({ queryKey: ["users", { q: "", role_id: "", status: "active" }], queryFn: () => usersApi.list({ status: "active" }) });
  const staff = (users.data ?? []).filter((u) => u.client_id === null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [assignee, setAssignee] = useState(""); // "user:5" | "agent:content" | ""
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const [kind, value] = assignee.split(":");
      return tasksApi.create({
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(clientId ? { client_id: Number(clientId) } : {}),
        priority: priority as never,
        ...(due ? { due_at: localToIso(due) } : {}),
        ...(kind === "user" ? { assignee_user_id: Number(value) } : {}),
        ...(kind === "agent" ? { assignee_agent: value } : {}),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); onClose(); },
  });

  return (
    <Modal title="New task" onClose={onClose} width={560}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} style={{ display: "grid", gap: 14 }}>
        <Field label="Title *" error={fieldError(create.error, "title")}><TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} dir="auto" autoFocus /></Field>
        <Field label="Description" error={fieldError(create.error, "description")}><TextArea value={description} onChange={(e) => setDescription(e.target.value)} dir="auto" /></Field>
        <Field label="Client" error={fieldError(create.error, "client_id")}>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">No client</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Assign to" error={fieldError(create.error, "assignee_user_id") || fieldError(create.error, "assignee_agent")}>
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Nobody yet</option>
            <optgroup label="Team">{staff.map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name}</option>)}</optgroup>
            <optgroup label="AI agent">{AGENT_NAMES.map((a) => <option key={a} value={`agent:${a}`}>AI · {a}</option>)}</optgroup>
          </Select>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Priority" error={fieldError(create.error, "priority")}>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {TASK_PRIORITIES.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label="Due" error={fieldError(create.error, "due_at")}><TextInput type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        {create.isError && <Notice kind="error">{errorText(create.error)}</Notice>}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="primary" type="submit" disabled={create.isPending || !title.trim()}>{create.isPending ? "Creating…" : "Create task"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </form>
    </Modal>
  );
}