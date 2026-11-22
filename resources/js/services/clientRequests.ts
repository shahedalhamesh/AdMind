import { api } from "./api";
import type { Paginated } from "./content";

/* Mirrors section 5l of the backend (client requests). */

export const REQUEST_TYPES = ["content", "campaign", "report", "complaint", "other"] as const;
export const REQUEST_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type RequestStatus = "new" | "in_progress" | "completed" | "rejected";

export type ClientRequest = {
  id: number;
  client_id: number;
  submitted_by_user_id: number | null;
  type: string;
  priority: string;
  subject: string;
  description: string | null;
  status: RequestStatus;
  task_id: number | null;
  created_at: string;
  client?: { id: number; name: string } | null;
  task?: { id: number; title: string; status: string } | null;
};

export const clientRequestsApi = {
  // a client login gets only its own requests; staff can filter
  list: (params: { client_id?: string; status?: string; type?: string; page?: number; per_page?: number }) =>
    api<Paginated<ClientRequest>>("/client-requests", { params }),
  create: (body: { type: string; subject: string; description?: string; priority?: string }) =>
    api<ClientRequest>("/client-requests", { method: "POST", body }),
  convert: (id: number, body: { assignee_user_id?: number; assignee_agent?: string; due_at?: string; priority?: string; title?: string }) =>
    api<{ request: ClientRequest; task: { id: number } }>(`/client-requests/${id}/convert`, { method: "POST", body }),
  reject: (id: number, reason?: string) => api<unknown>(`/client-requests/${id}/reject`, { method: "POST", body: reason ? { reason } : {} }),
};

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const requestTone = (s: RequestStatus): "warn" | "good" | "bad" | "plain" => (s === "new" ? "warn" : s === "completed" ? "good" : s === "rejected" ? "bad" : "plain");
export const STAFF_LABEL: Record<RequestStatus, string> = { new: "New", in_progress: "In progress", completed: "Completed", rejected: "Declined" };
export const CLIENT_LABEL: Record<RequestStatus, string> = { new: "Sent", in_progress: "Being worked on", completed: "Done", rejected: "Declined" };