import { api } from "./api";

export type PerfNumbers = {
  runs: number;
  succeeded: number;
  failed: number;
  running: number;
  success_rate: number | null; // percent of finished runs
  avg_duration_seconds: number | null;
  input_tokens: number;
  output_tokens: number;
  cost?: number | null;
  corrected_by_fact_check: number;
  fact_check_failed: number;
};

export type PerfByAgent = PerfNumbers & { agent: string };
export type PerfByMode = PerfNumbers & { mode: string };

export type AgentPerformance = {
  period: { from: string; to: string };
  totals: PerfNumbers;
  by_agent: PerfByAgent[];
  by_mode: PerfByMode[];
  by_day: { date: string; runs: number; failed: number }[];
  recent_failures: { id: number; agent: string; client_id: number | null; error: string | null; started_at: string }[];
  recommendations: { new: number; accepted: number; dismissed: number };
};

export const agentPerformanceApi = {
  get: (f: { from: string; to: string; client_id: string }) => {
    // send only the filters that have a value
    const params: Record<string, string> = {};
    (["from", "to", "client_id"] as const).forEach((k) => { if (f[k]) params[k] = f[k]; });
    return api<AgentPerformance>("/agent-performance", { params });
  },
};

export const AGENT_LABEL: Record<string, string> = {
  main: "Main agent",
  client: "Client agent",
  content: "Content agent",
  campaign: "Campaign agent",
  analytics: "Analytics agent",
};

export const MODE_LABEL: Record<string, string> = {
  chat: "Chat",
  run: "Run",
  task: "Tasks",
  revise: "Revisions",
  meeting: "Meetings",
  recommend: "Recommendations",
};

export function fmtSeconds(s: number | null | undefined): string {
  if (s === null || s === undefined) return "—";
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;
}