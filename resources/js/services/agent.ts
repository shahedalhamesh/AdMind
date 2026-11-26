import { api } from "./api";
import type { ContentItem } from "./content";

/* Mirrors section 6 of the backend: POST /agent/chat, GET /agent/runs/{id}, and POST /content with agent_run_id ("Save as content"). */

// One step of a running request. `events` can be empty or incomplete: never depend on it, `status` is what matters.
export type AgentEvent = {
  n: number;
  time: string;
  agent: string;
  label: string; // Agent Started, Tool Execution Started, Tool Execution Completed, Agent Final Answer, Retrying, Checking the answer
  detail: string; // the tool name (delegate_work_to_coworker = handed to another agent) or a short text
};

export type AgentRun = {
  id: number;
  status: "running" | "succeeded" | "failed";
  mode: string;
  task_id: number | null;
  content_id: number | null;
  needs_info: boolean;
  conversation_id: number | null;
  output: string | null;
  verification_status: "ok" | "corrected" | "skipped" | "failed" | null;
  original_output: string | null;
  error: string | null;
  current_agent?: string | null; // the agent working now (null when the run is not running)
  elapsed_seconds?: number | null;
  events?: AgentEvent[] | null;
};

export const agentApi = {
  // omit conversation_id to start a new conversation; send it to continue one
  chat: (body: { client_id: number; message: string; conversation_id?: number | null; language: "Arabic" | "English" }) =>
    api<{ agent_run_id: number; conversation_id: number; status: string }>("/agent/chat", {
      method: "POST",
      body: { ...body, conversation_id: body.conversation_id ?? undefined },
    }),
  run: (id: number) => api<AgentRun>(`/agent/runs/${id}`),
  saveAsContent: (body: { client_id: number; type: string; platform: string; title: string; agent_run_id: number }) =>
    api<ContentItem>("/content", { method: "POST", body }),
};

export const NOTE_PREFIX = "Note to employee:";