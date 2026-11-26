import { api } from "./api";

export type ContractStatus = "active" | "expiring" | "expired" | "cancelled";

export type Contract = {
  id: number;
  client_id: number;
  client?: { id: number; name: string };
  service: string;
  starts_on: string | null;
  ends_on: string | null;
  renewal_date: string | null;
  amount: number | null; // null for people without clients.update: show no price
  status: ContractStatus;
  days_left: number | null;
};

export type ContractInput = {
  client_id: number;
  service: string;
  starts_on?: string;
  ends_on?: string;
  renewal_date?: string;
  amount?: number;
};

export const contractsApi = {
  // no pagination; the reply may be a plain list or {data: [...]}
  list: async (clientId: number): Promise<Contract[]> => {
    const d = await api<Contract[] | { data: Contract[] }>("/contracts", { params: { client_id: clientId } });
    return Array.isArray(d) ? d : d.data ?? [];
  },
  // every client's contracts, nearest end date first; `status` is optional
  listAll: async (status?: string): Promise<Contract[]> => {
    const d = await api<Contract[] | { data: Contract[] }>("/contracts", { params: status ? { status } : {} });
    return Array.isArray(d) ? d : d.data ?? [];
  },
  create: (body: ContractInput) => api<Contract>("/contracts", { method: "POST", body }),
  cancel: (id: number) => api<Contract>(`/contracts/${id}/cancel`, { method: "POST" }),
  remove: (id: number) => api<{ message: string }>(`/contracts/${id}`, { method: "DELETE" }),
};