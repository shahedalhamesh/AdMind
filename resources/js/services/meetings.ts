import { api } from "./api";
import type { Paginated } from "./content";

/* Mirrors section 5i of the backend.
   status: uploaded (has a transcript) -> processing (speech to text, or the AI summarizing) -> summarized | failed */

export type MeetingStatus = "uploaded" | "processing" | "summarized" | "failed";
export const MEETING_STATUS_LABEL: Record<string, string> = { uploaded: "Has a transcript", processing: "Processing", summarized: "Summarized", failed: "Failed" };

export type MeetingListItem = { id: number; client_id: number; title: string; held_at: string | null; summary: string | null; status: MeetingStatus; proposed_count: number };
export type Meeting = {
  id: number;
  client_id: number;
  title: string;
  held_at: string | null;
  status: MeetingStatus;
  transcript: string | null;
  summary: string | null;
  key_insights: string[] | null;
};

export type ActionItemStatus = "proposed" | "confirmed" | "rejected";
export type ActionItem = { id: number; description: string; suggested_assignee_id: number | null; due_date: string | null; status: ActionItemStatus; task_id: number | null };

export type MeetingFull = { meeting: Meeting; action_items: ActionItem[] };

export const meetingsApi = {
  list: (params: { client_id?: string; status?: string; page?: number; per_page?: number }) => api<Paginated<MeetingListItem>>("/meetings", { params }),
  get: (id: number) => api<MeetingFull>(`/meetings/${id}`),
  create: (body: { client_id: number; title: string; held_at?: string; transcript?: string }) => api<Meeting>("/meetings", { method: "POST", body }),
  update: (id: number, body: Partial<{ title: string; held_at: string; transcript: string; summary: string; key_insights: string[] }>) => api<Meeting>(`/meetings/${id}`, { method: "PUT", body }),
  remove: (id: number) => api<unknown>(`/meetings/${id}`, { method: "DELETE" }),

  // audio file (max 50 MB) -> the server turns it into a transcript in the background
  uploadRecording: (id: number, file: Blob, filename: string, language?: string) => {
    const fd = new FormData();
    fd.append("file", file, filename);
    if (language) fd.append("language", language);
    return api<{ meeting_id: number; status: string }>(`/meetings/${id}/recording`, { method: "POST", formData: fd });
  },
  summarize: (id: number) => api<{ agent_run_id: number }>(`/meetings/${id}/summarize`, { method: "POST", body: {} }),

  addItem: (id: number, body: { description: string; suggested_assignee_id?: number; due_date?: string }) => api<ActionItem>(`/meetings/${id}/action-items`, { method: "POST", body }),
  updateItem: (id: number, body: Partial<{ description: string; suggested_assignee_id: number | null; due_date: string | null }>) => api<ActionItem>(`/meeting-action-items/${id}`, { method: "PUT", body }),
  // becomes a task. Everything is optional: the suggested assignee is used by default.
  confirmItem: (id: number, body: { assignee_user_id?: number; assignee_agent?: string; due_at?: string; priority?: string; title?: string }) =>
    api<{ action_item: ActionItem; task: { id: number } }>(`/meeting-action-items/${id}/confirm`, { method: "POST", body }),
  rejectItem: (id: number) => api<unknown>(`/meeting-action-items/${id}/reject`, { method: "POST", body: {} }),
};