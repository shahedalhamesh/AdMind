import { api } from "./api";
import type { Paginated } from "./content";

/* Mirrors section 5j of the backend. status: new -> accepted (becomes a task) | dismissed. Staff only. */

export type RecStatus = "new" | "accepted" | "dismissed";
export type Recommendation = {
  id: number;
  client_id: number;
  recommendation: string;
  status: RecStatus;
  based_on: { title?: string; reason?: string; priority?: "low" | "medium" | "high"; period?: { start: string; end: string }; agent_run_id?: number; task_id?: number | null } | null;
};

export const recommendationsApi = {
  // 422 when the client has no performance numbers in that period
  generate: (body: { client_id: number; days: number; language: "Arabic" | "English" }) => api<{ agent_run_id: number }>("/recommendations/generate", { method: "POST", body }),
  list: (params: { client_id?: string; status?: string; per_page?: number }) => api<Paginated<Recommendation>>("/recommendations", { params }),
  accept: (id: number, body: { assignee_user_id?: number; assignee_agent?: string; due_at?: string; priority?: string; title?: string }) =>
    api<{ recommendation: Recommendation; task: { id: number } }>(`/recommendations/${id}/accept`, { method: "POST", body }),
  dismiss: (id: number) => api<unknown>(`/recommendations/${id}/dismiss`, { method: "POST", body: {} }),
};