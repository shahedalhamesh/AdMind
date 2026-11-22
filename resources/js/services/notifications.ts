import { api } from "./api";
import type { Paginated } from "./content";

/* Mirrors section 5f of the backend: GET /notifications, POST /notifications/{id}/read, POST /notifications/read-all */

export type AppNotification = {
  id: number;
  type: string; // approval_needed, info_needed, failure, meeting_summarized, content_approved, client_feedback, media_ready, recommendations_ready...
  title: string;
  body: string | null;
  data: { task_id?: number; content_id?: number; agent_run_id?: number; [k: string]: unknown } | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationsResponse = { unread_count: number; notifications: Paginated<AppNotification> };

export const notificationsApi = {
  list: (params: { unread?: string; per_page?: number; page?: number }) => api<NotificationsResponse>("/notifications", { params }),
  read: (id: number) => api<unknown>(`/notifications/${id}/read`, { method: "POST", body: {} }),
  readAll: () => api<unknown>("/notifications/read-all", { method: "POST", body: {} }),
};

// Where a notification leads. Only content has a page so far.
// Where a notification leads. Only what the backend documents is used; anything else stays not clickable.
export function notificationTarget(n: AppNotification): string | null {
  const d = n.data ?? {};
  if (d.content_id) return `/content/${d.content_id}`;
  if (n.type === "meeting_summarized" && d.meeting_id) return `/meetings/${d.meeting_id}`;
  if (n.type === "recommendations_ready") return "/recommendations";
  if (n.type === "media_ready") return "/media";
  if (n.type === "join_request") return "/team/access";
  if (n.type === "member_joined") return "/team";
  if (n.type === "client_request") return "/requests";
  if (n.type === "request_update") return "/portal";
  if (d.task_id) return "/tasks";
  return null;
}

export const NOTIFICATION_LABEL: Record<string, string> = {
  approval_needed: "Needs review",
  info_needed: "Info needed",
  failure: "Failed",
  meeting_summarized: "Meeting",
  content_approved: "Approved",
  client_feedback: "Client feedback",
  media_ready: "Media ready",
  recommendations_ready: "Recommendations",
  join_request: "Join request",
  member_joined: "Joined",
  client_request: "Client request",
  request_update: "Request update",
};