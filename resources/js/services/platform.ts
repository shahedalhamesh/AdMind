import { api } from "./api";
import type { Paginated } from "./content";

/* Mirrors "Platform Admin" in section 4 of the backend. Only a Platform Admin (is_platform_admin) can call these. */

export type SubscriptionStatus = "trial" | "active" | "suspended" | "cancelled";
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["trial", "active", "suspended", "cancelled"];

export type Company = {
  id: number;
  name: string;
  plan: string | null;
  subscription_status: SubscriptionStatus;
  subscription_ends_at: string | null;
  created_at: string;
  staff_count: number;
  clients_count: number;
};

export const platformApi = {
  list: (params: { status?: string; q?: string; page?: number; per_page?: number }) => api<Paginated<Company>>("/admin/companies", { params }),
  // suspending or cancelling signs out every user of that company at once
  setStatus: (id: number, subscription_status: SubscriptionStatus) => api<Company>(`/admin/companies/${id}`, { method: "PUT", body: { subscription_status } }),
};