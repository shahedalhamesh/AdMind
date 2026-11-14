import { api } from "./api";
import type { Paginated } from "./content";

/* Mirrors section 5e of the backend. budget and spent come as strings with 2 decimals ("5000.00"): parse before calculating. */

export type CampaignStatus = "draft" | "planned" | "active" | "paused" | "completed";
export const CAMPAIGN_STATUSES: CampaignStatus[] = ["draft", "planned", "active", "paused", "completed"];

export type Campaign = {
  id: number;
  client_id: number;
  name: string;
  objective: string;
  budget: string;
  spent: string;
  currency: string;
  channels: string[];
  starts_on: string | null;
  ends_on: string | null;
  status: CampaignStatus;
  client?: { id: number; name: string } | null;
  content_items_count?: number;
};

export type CampaignDetail = {
  campaign: Campaign;
  remaining: number;
  over_budget: boolean;
  content: { id: number; title: string; type: string; platform: string; status: string }[];
};

export type CampaignInput = {
  client_id: number;
  name: string;
  objective: string;
  budget: number;
  channels: string[];
  currency?: string;
  starts_on?: string;
  ends_on?: string;
  status?: CampaignStatus;
};

export const campaignsApi = {
  list: (params: { client_id?: string; status?: string; page?: number; per_page?: number }) => api<Paginated<Campaign>>("/campaigns", { params }),
  get: (id: number) => api<CampaignDetail>(`/campaigns/${id}`),
  create: (body: CampaignInput) => api<Campaign>("/campaigns", { method: "POST", body }),
  // send only what changes. `spent` is updated by hand for now.
  update: (id: number, body: Partial<Omit<CampaignInput, "client_id">> & { spent?: number }) => api<Campaign>(`/campaigns/${id}`, { method: "PUT", body }),
  // only a draft can be deleted (422 otherwise): mark the others completed
  remove: (id: number) => api<unknown>(`/campaigns/${id}`, { method: "DELETE" }),
};

export const campaignTone = (s: CampaignStatus): "good" | "warn" | "bad" | "plain" => (s === "active" ? "good" : s === "paused" ? "warn" : "plain");
export const pct = (spent: string, budget: string) => { const b = Number(budget); return b > 0 ? Math.min(100, (Number(spent) / b) * 100) : 0; };