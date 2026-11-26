import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export type AiLevel = "manual" | "assisted" | "autonomous";
export const AI_LEVELS: AiLevel[] = ["manual", "assisted", "autonomous"];

export const AI_LEVEL_LABEL: Record<AiLevel, string> = {
  manual: "Off",
  assisted: "Assisted",
  autonomous: "Autonomous",
};
export const AI_LEVEL_HELP: Record<AiLevel, string> = {
  manual: "The AI is turned off. No AI chat, media, revisions or recommendations.",
  assisted: "The AI works, and people approve every step.",
  autonomous: "The AI works, and an approved post can be published by itself.",
};

export type AiPolicy = {
  id: number;
  client_id: number | null; // null = the company default
  autonomy_level: AiLevel;
  max_spend: number | null;
  approval_rules: Record<string, unknown> | null;
  publish_rules: Record<string, unknown> | null;
  escalate_to_user_id: number | null;
  client?: { id: number; name: string };
};

export type AiPolicies = { default: AiPolicy | null; clients: AiPolicy[] };

export type PolicyInput = {
  client_id?: number | null;
  autonomy_level: AiLevel;
  max_spend?: number | null;
  approval_rules?: Record<string, unknown> | null;
  publish_rules?: Record<string, unknown> | null;
  escalate_to_user_id?: number | null;
};

export const aiPolicyApi = {
  list: () => api<AiPolicies>("/ai-policies"),
  save: (body: PolicyInput) => api<AiPolicy>("/ai-policies", { method: "PUT", body }),
  remove: (id: number) => api<{ message: string }>(`/ai-policies/${id}`, { method: "DELETE" }),
  effective: (clientId: number) =>
    api<Record<string, unknown>>("/ai-policies/effective", { params: { client_id: clientId } }),
};

export function autoPublishOf(p: AiPolicy | null | undefined): boolean {
  return p?.publish_rules?.auto_publish === true;
}

// Is the AI turned off (manual) for this client? Used to grey out the AI buttons.
// The reply may be the policy itself or {policy, source}: both are handled.
export function useAiOff(clientId: number | string | null | undefined) {
  const id = clientId ? Number(clientId) : 0;
  const q = useQuery({
    queryKey: ["ai-effective", id],
    queryFn: () => aiPolicyApi.effective(id),
    enabled: id > 0,
    staleTime: 30_000,
  });
  const d = q.data as { autonomy_level?: string; policy?: { autonomy_level?: string } } | undefined;
  const level = d?.autonomy_level ?? d?.policy?.autonomy_level;
  return {
    off: level === "manual",
    message: "The AI is turned off for this client. Ask the owner or a manager to turn it on in AI policy.",
  };
}