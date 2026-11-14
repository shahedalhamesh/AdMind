import { api } from "./api";
import type { Paginated } from "./content";

/* Mirrors section 5h of the backend: performance numbers, goals and client reports. */

export const METRIC_NAMES = ["reach", "impressions", "likes", "comments", "shares", "clicks", "spend", "ctr", "engagement_rate"];
export const GOAL_PERIODS = ["weekly", "monthly", "quarterly"] as const;

export type MetricRow = {
  subject_type: "content" | "campaign" | "account";
  subject_id: number;
  platform: string;
  metric: string;
  value: number;
  metric_date: string; // YYYY-MM-DD, not in the future
};

export type SavedMetric = Partial<MetricRow> & { id?: number };

export type GoalStatus = "on_track" | "at_risk" | "achieved" | "missed";
export type Goal = {
  id: number;
  client_id: number;
  metric: string;
  target_value: number | string;
  period: (typeof GOAL_PERIODS)[number];
  starts_on: string;
  ends_on: string;
  current: number | string;
  progress_pct: number;
  status: GoalStatus;
};
export type GoalInput = { client_id: number; metric: string; target_value: number; period: string; starts_on: string; ends_on: string };

export type ReportData = {
  client: { id: number; name: string };
  period: { start: string; end: string };
  totals: Record<string, number>;
  by_platform: Record<string, Record<string, number>>;
  content: { published_count: number; published: { id?: number; title?: string }[]; top_by: string | null; top: { content_id: number; title: string; value: number }[] };
  goals: Goal[];
  campaigns: { id: number; name: string; status: string; budget: string; spent: string; currency: string }[];
  has_metrics: boolean;
};

export type ReportSummary = { id: number; client_id: number; visible_to_client: boolean; created_at?: string; period_start?: string; period_end?: string; data?: ReportData };
export type ReportFull = ReportSummary & { data: ReportData };

const asList = <T,>(r: T[] | { data: T[] }): T[] => (Array.isArray(r) ? r : r?.data ?? []);

export const reportsApi = {
  saveMetrics: (client_id: number, metrics: MetricRow[]) => api<{ saved: number }>("/metrics", { method: "POST", body: { client_id, metrics } }),
  metrics: (params: { client_id: string; metric?: string; per_page?: number }) => api<Paginated<SavedMetric>>("/metrics", { params }),

  goals: async (clientId: string) => asList(await api<Goal[] | { data: Goal[] }>("/goals", { params: { client_id: clientId } })),
  createGoal: (body: GoalInput) => api<Goal>("/goals", { method: "POST", body }),
  deleteGoal: (id: number) => api<unknown>(`/goals/${id}`, { method: "DELETE" }),

  generate: (body: { client_id: number; period_start: string; period_end: string; top_metric?: string; visible_to_client: boolean }) =>
    api<ReportFull>("/reports/generate", { method: "POST", body }),
  list: async (clientId: string) => asList(await api<ReportSummary[] | { data: ReportSummary[] }>("/reports", { params: { client_id: clientId } })),
  get: (id: number) => api<ReportFull>(`/reports/${id}`),
  setVisibility: (id: number, visible_to_client: boolean) => api<unknown>(`/reports/${id}/visibility`, { method: "PUT", body: { visible_to_client } }),
  remove: (id: number) => api<unknown>(`/reports/${id}`, { method: "DELETE" }),
};

export const goalTone = (s: GoalStatus): "good" | "warn" | "bad" | "plain" => (s === "achieved" ? "good" : s === "on_track" ? "plain" : s === "at_risk" ? "warn" : "bad");
export const GOAL_LABEL: Record<GoalStatus, string> = { on_track: "On track", at_risk: "At risk", achieved: "Achieved", missed: "Missed" };
export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const num = (v: number | string) => Number(v).toLocaleString();