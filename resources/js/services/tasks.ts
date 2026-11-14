import { api } from "./api";
import type { Paginated } from "./content";

/* Mirrors section 5d and 5f of the backend. */

export type TaskStatus = "new" | "in_progress" | "waiting_info" | "waiting_approval" | "completed" | "failed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export const TASK_STATUSES: { id: TaskStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "in_progress", label: "In progress" },
  { id: "waiting_info", label: "Waiting for info" },
  { id: "waiting_approval", label: "Waiting for approval" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
];
export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
export const AGENT_NAMES = ["main", "client", "content", "campaign", "analytics"] as const;

export type Task = {
  id: number;
  client_id: number | null;
  parent_task_id: number | null;
  title: string;
  description: string | null;
  type: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignee_type: "user" | "agent" | null;
  assignee_user_id: number | null;
  assignee_agent: string | null;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  assignee_user?: { id: number; name: string } | null;
  client?: { id: number; name: string } | null;
  subtasks_count?: number;
};

export type TaskCreate = {
  title: string;
  description?: string;
  client_id?: number;
  priority?: TaskPriority;
  due_at?: string;
  // one of them, never both
  assignee_user_id?: number;
  assignee_agent?: string;
};

export const tasksApi = {
  list: (params: { status?: string; priority?: string; client_id?: string; mine?: string; overdue?: string; top_level?: string; per_page?: number }) =>
    api<Paginated<Task>>("/tasks", { params }),
  create: (body: TaskCreate) => api<Task>("/tasks", { method: "POST", body }),
  setStatus: (id: number, status: TaskStatus) => api<Task>(`/tasks/${id}`, { method: "PUT", body: { status } }),
  remove: (id: number) => api<unknown>(`/tasks/${id}`, { method: "DELETE" }),
  // Manager: the AI writes a content draft for this task. Only when the task is new, failed or waiting_info.
  run: (id: number, body: { content_type: string; platform: string; language: "Arabic" | "English" }) =>
    api<{ agent_run_id: number; status: string }>(`/tasks/${id}/run`, { method: "POST", body }),
};

export const taskTone = (s: TaskStatus): "good" | "warn" | "bad" | "plain" =>
  s === "completed" ? "good" : s === "failed" ? "bad" : s === "new" ? "plain" : "warn";
export const priorityTone = (p: TaskPriority): "good" | "warn" | "bad" | "plain" =>
  p === "urgent" ? "bad" : p === "high" ? "warn" : "plain";

export const isTaskOverdue = (t: Pick<Task, "due_at" | "status">) =>
  !!t.due_at && t.status !== "completed" && new Date(t.due_at).getTime() < Date.now();