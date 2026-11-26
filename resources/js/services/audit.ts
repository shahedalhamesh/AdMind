import { api } from "./api";

export type AuditEntry = {
  id: number;
  actor_type: string;
  actor_id: number | null;
  actor?: { id: number; name: string } | null;
  action: string;
  subject_type: string | null;
  subject_id: number | null;
  changes: { method?: string; path?: string; status?: number; input?: unknown } | null;
  result: "success" | "denied" | "failed";
  ip_address: string | null;
  created_at: string;
};

export type AuditPage = { data: AuditEntry[]; current_page: number; last_page: number };

export type AuditFilters = {
  actor_id: string;
  action: string;
  subject_type: string;
  result: string;
  from: string;
  to: string;
  page: number;
};

export const auditApi = {
  list: (f: AuditFilters) => {
    // send only the filters that have a value
    const params: Record<string, string | number> = { per_page: 30, page: f.page };
    (["actor_id", "action", "subject_type", "result", "from", "to"] as const).forEach((k) => {
      if (f[k]) params[k] = f[k];
    });
    return api<AuditPage>("/audit-logs", { params });
  },
};