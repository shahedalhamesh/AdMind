import { api } from "./api";

/* Everything here mirrors ClientController, ClientProfileController, ClientDocumentController
   and SocialAccountController exactly. Nothing is added or removed. */

export type ClientStatus = "active" | "paused" | "churned";
export const CLIENT_STATUSES: ClientStatus[] = ["active", "paused", "churned"];

export type Client = {
  id: number;
  name: string;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  goals: string | null;
  agreed_services: string[] | null;
  status: ClientStatus;
  responsible_user_id: number | null;
  created_at?: string;
};

export type ClientInput = {
  name: string;
  industry?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  goals?: string | null;
  agreed_services?: string[];
  status?: ClientStatus;
  responsible_user_id?: number | null;
};

export type BrandProfile = {
  tone: string;
  target_audience: string;
  content_style: string | null;
  guidelines: string | null;
  colors: unknown[] | null;
  fonts: unknown[] | null;
  forbidden_words: string[] | null;
  platforms: string[] | null;
};

export type ProfileInput = {
  tone: string;
  target_audience: string;
  content_style?: string | null;
  guidelines?: string | null;
  colors?: string[];
  fonts?: string[];
  forbidden_words?: string[];
  platforms?: string[];
};

export type ProfileSaved = { profile: BrandProfile; ai_synced: boolean; ai_error: string | null };

export type ProfileProposal = {
  saved: false;
  proposed: {
    industry: string | null;
    tone: string | null;
    target_audience: string | null;
    platforms: string[];
    forbidden_words: string[];
  };
};

export type ClientDocument = { id: number; title: string; source_type: "manual" | "file"; created_at: string };
export type DocumentSaved = { id: number; title: string; source_type: string; chunks: number | null; warning: string | null };

export const PLATFORMS = ["instagram", "facebook", "tiktok", "x", "linkedin", "snapchat"] as const;
export type Platform = (typeof PLATFORMS)[number];
export type SocialAccount = { id: number; client_id: number; platform: Platform; account_name: string; status: string; created_at?: string };

// The users list is used only to pick the responsible employee (needs users.view).
export type StaffUser = { id: number; name: string; email?: string; role?: string };

export const clientsApi = {
  list: (params: { q?: string; status?: string }) => api<Client[]>("/clients", { params }),
  get: (id: number) => api<Client>(`/clients/${id}`),
  create: (body: ClientInput) => api<Client>("/clients", { method: "POST", body }),
  update: (id: number, body: Partial<ClientInput>) => api<Client>(`/clients/${id}`, { method: "PUT", body }),
  remove: (id: number) => api<{ message: string }>(`/clients/${id}`, { method: "DELETE" }),

  profile: (id: number) => api<{ profile: BrandProfile | null }>(`/clients/${id}/profile`),
  saveProfile: (id: number, body: ProfileInput) => api<ProfileSaved>(`/clients/${id}/profile`, { method: "PUT", body }),
  // Takes a few seconds (the language model reads the text). Nothing is saved by this call.
  extract: (text: string) => api<ProfileProposal>("/clients/extract-profile", { method: "POST", body: { text } }),

  documents: (id: number) => api<ClientDocument[]>(`/clients/${id}/documents`),
  addText: (id: number, body: { title?: string; text: string }) =>
    api<DocumentSaved>(`/clients/${id}/documents`, { method: "POST", body }),
  addFile: (id: number, file: File, title?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (title) fd.append("title", title);
    return api<DocumentSaved>(`/clients/${id}/documents`, { method: "POST", formData: fd });
  },
  removeDocument: (id: number, documentId: number) =>
    api<{ message: string }>(`/clients/${id}/documents/${documentId}`, { method: "DELETE" }),

  accounts: (id: number) => api<SocialAccount[]>(`/clients/${id}/social-accounts`),
  addAccount: (id: number, body: { platform: Platform; account_name: string }) =>
    api<SocialAccount>(`/clients/${id}/social-accounts`, { method: "POST", body }),
  removeAccount: (id: number, accountId: number) =>
    api<{ message: string }>(`/clients/${id}/social-accounts/${accountId}`, { method: "DELETE" }),

  staff: async (): Promise<StaffUser[]> => {
    const d = await api<unknown>("/users");
    const list = Array.isArray(d) ? d : ((d as { data?: unknown; users?: unknown })?.data ?? (d as { users?: unknown })?.users ?? []);
    return Array.isArray(list) ? (list as StaffUser[]) : [];
  },
};

// Arrays saved by the backend as plain JSON: show every item as text.
export function asStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
}