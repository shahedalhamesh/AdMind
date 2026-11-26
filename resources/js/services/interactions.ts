import { api } from "./api";

export type InteractionType = "meeting" | "message" | "call" | "note";
export const INTERACTION_TYPES: InteractionType[] = ["meeting", "message", "call", "note"];

export type Interaction = {
  id: number;
  client_id: number;
  type: InteractionType;
  summary: string;
  source: string | null;
  occurred_at: string;
};

export type InteractionPage = { data: Interaction[]; current_page: number; last_page: number };

export const interactionsApi = {
  list: (clientId: number, page: number) =>
    api<InteractionPage>(`/clients/${clientId}/interactions`, { params: { per_page: 20, page } }),
  create: (clientId: number, body: { type: InteractionType; summary: string; occurred_at?: string }) =>
    api<Interaction>(`/clients/${clientId}/interactions`, { method: "POST", body }),
  remove: (id: number) => api<{ message: string }>(`/client-interactions/${id}`, { method: "DELETE" }),
};

// "2026-11-23T14:30" (from the date box) -> "2026-11-23 14:30:00" (what the backend wants)
export function toBackendTime(local: string): string | undefined {
  return local ? `${local.replace("T", " ")}:00` : undefined;
}