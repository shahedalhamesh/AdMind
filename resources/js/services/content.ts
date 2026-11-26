import { api } from "./api";

/* Mirrors ContentController, ApprovalController and PublishController exactly.

   Content status flow:
     draft --submit--> in_review --approve--> approved --schedule--> scheduled --mark-published--> published
     in_review --changes requested--> revision_requested ; in_review --rejected--> draft
   Approval stages: reason "escalation" = stage 1 (the manager's internal review); anything else = the client's decision. */

export type ContentStatus = "idea" | "draft" | "in_review" | "approved" | "revision_requested" | "scheduled" | "published" | "failed";

export const STATUS_LABEL: Record<string, string> = {
  idea: "Idea",
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  revision_requested: "Changes requested",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed to publish",
};
export const CONTENT_STATUSES = Object.keys(STATUS_LABEL) as ContentStatus[];
export const CONTENT_TYPES = ["post", "reel", "story"] as const;
export const CONTENT_PLATFORMS = ["instagram"] as const;

export function contentTone(status: string): "good" | "warn" | "bad" | "plain" {
  if (status === "approved" || status === "published") return "good";
  if (status === "in_review" || status === "scheduled") return "warn";
  if (status === "revision_requested" || status === "failed") return "bad";
  return "plain";
}

export type Paginated<T> = { data: T[]; current_page: number; last_page: number; per_page: number; total: number };

export type Version = {
  id: number;
  version_number: number;
  body: string;
  language: string | null;
  hashtags: string[] | null;
  script: string | null;
  instruction: string | null;
  created_at?: string;
};

export type ContentItem = {
  id: number;
  client_id: number;
  type: string;
  platform: string;
  title: string;
  status: ContentStatus;
  current_version_id: number | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at?: string;
  current_version?: Version | null;
  client?: { id: number; name: string } | null;
};

export type ApprovalStatus = "pending" | "approved" | "rejected" | "changes_requested";

export type Approval = {
  id: number;
  status: ApprovalStatus;
  reason: string | null;
  comment: string | null;
  requested_from_id: number | null;
  requested_by_id: number | null;
  decided_at: string | null;
  preferred_publish_at?: string | null; // the client's wish, set with its final approval
  created_at?: string;
  subject_type: string;
  subject_id: number;
  content?: ContentItem | null; // only in the approvals list
};

export type Decision = "approved" | "rejected" | "changes_requested";
export type DecisionResult = {
  stage: "internal" | "client";
  content_status: string;
  next_approval?: unknown;
  auto_publish_job_id?: number | null; // set when the AI policy scheduled the post by itself
};

export type PublishJob = {
  id: number;
  content_id: number;
  status: string; // pending, publishing, published, failed, cancelled
  scheduled_at: string;
  published_at: string | null;
  external_post_id: string | null;
  attempts?: number;
  last_error?: string | null;
  social_account?: { id: number; platform: string; account_name: string } | null;
  content?: { id: number; client_id: number; title: string; type: string; platform: string; status: string } | null;
};

export const isInternalStage = (a: Pick<Approval, "reason">) => a.reason === "escalation";

export const contentApi = {
  list: (params: { client_id?: string; status?: string; type?: string; platform?: string; page?: number; per_page?: number }) =>
    api<Paginated<ContentItem>>("/content", { params }),
  get: (id: number) => api<{ content: ContentItem; versions: Version[]; approvals: Approval[] }>(`/content/${id}`),
  // Employee: goes to a manager (stage 1). Manager or Owner: goes straight to the client (stage 2).
  submit: (id: number) => api<{ stage: "internal" | "client"; content_status: string }>(`/content/${id}/submit`, { method: "POST", body: {} }),
  schedule: (id: number, body: { scheduled_at: string; social_account_id?: number }) =>
    api<PublishJob>(`/content/${id}/schedule`, { method: "POST", body }),
  update: (id: number, body: { campaign_id: number | null }) => api<unknown>(`/content/${id}`, { method: "PUT", body }),
  // The AI rewrites the post with the employee's notes (202 + agent_run_id: poll agentApi.run). The post becomes a draft.
  revise: (id: number, notes: string) => api<{ agent_run_id: number }>(`/content/${id}/revise`, { method: "POST", body: { notes } }),
  // The person writes the new text by hand (a rare fallback). The post becomes a draft.
  addVersion: (id: number, body: { body: string; instruction?: string }) => api<unknown>(`/content/${id}/versions`, { method: "POST", body }),
};

export const approvalsApi = {
  list: () => api<Approval[]>("/approvals"),
  // preferred_publish_at: only with "approved", only in the client's own approval, must be in the future
  decide: (id: number, body: { decision: Decision; comment?: string; preferred_publish_at?: string }) =>
    api<DecisionResult>(`/approvals/${id}/decision`, { method: "POST", body }),
};

export const publishApi = {
  list: (params: { status?: string; client_id?: string; overdue?: string; per_page?: number }) =>
    api<Paginated<PublishJob>>("/publish-jobs", { params }),
  reschedule: (id: number, scheduled_at: string) => api<PublishJob>(`/publish-jobs/${id}`, { method: "PUT", body: { scheduled_at } }),
  cancel: (id: number) => api<PublishJob>(`/publish-jobs/${id}/cancel`, { method: "POST", body: {} }),
  markPublished: (id: number, external_post_id?: string) =>
    api<PublishJob>(`/publish-jobs/${id}/mark-published`, { method: "POST", body: external_post_id ? { external_post_id } : {} }),
  // Automatic publishing only (simulation or meta). 202: the queue worker does it. Also retries a failed job.
  publishNow: (id: number) => api<PublishJob>(`/publish-jobs/${id}/publish-now`, { method: "POST", body: {} }),
};

export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// <input type="datetime-local"> gives "2026-11-15T10:30" in the person's own time: send it as a full ISO time.
export function localToIso(local: string): string {
  return new Date(local).toISOString();
}

// The other way: an ISO time from the API becomes the "2026-11-15T10:30" an <input type="datetime-local"> wants.
export function isoToLocal(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function isOverdue(job: Pick<PublishJob, "status" | "scheduled_at">): boolean {
  return job.status === "pending" && new Date(job.scheduled_at).getTime() < Date.now();
}