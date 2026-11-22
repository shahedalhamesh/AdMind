import { api } from "./api";
import type { LoginResponse } from "./auth";

/* Mirrors sections 5m and 5n of the backend: invitations, the public join link and join requests. */

export type Ref = { id: number; name: string };
export type Role = { id: number; name: string };

export type Invitation = {
  id: number;
  email: string;
  role: Ref | string | null;
  client: Ref | string | null;
  expires_at: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  token?: string; // only in the answer of create and renew: shown once
};

export type JoinLink = {
  id: number;
  role: Ref | string | null;
  label: string | null;
  expires_at: string;
  max_uses: number | null;
  uses_count: number;
  status: "active" | "revoked" | "expired" | "full";
  token?: string; // only in the answer of create
};

export type JoinRequest = {
  id: number;
  name: string;
  email: string;
  role: Ref | null;
  via_google: boolean;
  status: "pending" | "approved" | "rejected";
  decided_at: string | null;
  user_id: number | null;
  created_at: string;
};

export const nameOf = (v: Ref | string | null | undefined) => (typeof v === "string" ? v : v?.name ?? "");
export function rows<T>(r: T[] | { data: T[] } | undefined | null): T[] {
  if (!r) return [];
  return Array.isArray(r) ? r : r.data ?? [];
}

// the links the Owner copies and sends
export const inviteUrl = (token: string) => `${window.location.origin}/join/${token}`;
export const teamJoinUrl = (token: string) => `${window.location.origin}/team-join/${token}`;

export const invitesApi = {
  roles: () => api<Role[] | { data: Role[] }>("/roles").then((r) => rows(r)),
  list: (status: string) => api<Invitation[] | { data: Invitation[] }>("/invitations", { params: { status } }).then((r) => rows(r)),
  create: (body: { email: string; role_id: number; client_id: number | null; expires_in_days: number }) =>
    api<Invitation>("/invitations", { method: "POST", body }),
  renew: (id: number) => api<Invitation>(`/invitations/${id}/renew`, { method: "POST", body: {} }),
  revoke: (id: number) => api<unknown>(`/invitations/${id}`, { method: "DELETE" }),
};

export const joinLinksApi = {
  list: (status: string) => api<JoinLink[] | { data: JoinLink[] }>("/join-links", { params: { status } }).then((r) => rows(r)),
  create: (body: { role_id: number; label?: string; expires_in_days: number; max_uses?: number }) =>
    api<JoinLink>("/join-links", { method: "POST", body }),
  revoke: (id: number) => api<unknown>(`/join-links/${id}`, { method: "DELETE" }),
};

export const joinRequestsApi = {
  list: (status: string) => api<JoinRequest[] | { data: JoinRequest[] }>("/join-requests", { params: { status } }).then((r) => rows(r)),
  approve: (id: number, role_id?: number) => api<unknown>(`/join-requests/${id}/approve`, { method: "POST", body: role_id ? { role_id } : {} }),
  reject: (id: number) => api<unknown>(`/join-requests/${id}/reject`, { method: "POST", body: {} }),
};

// the pages of the person who opens a link (no login)
export const publicJoinApi = {
  preview: (token: string) =>
    api<{ company_name: string; email: string; role: Ref | string; client_name: string | null; expires_at: string }>(`/join/${token}`),
  accept: (token: string, body: { credential: string; name?: string } | { name: string; password: string }) =>
    api<LoginResponse>(`/join/${token}`, { method: "POST", body }),
  teamPreview: (token: string) =>
    api<{ company_name: string; role: Ref | string; label: string | null; expires_at: string }>(`/team-join/${token}`),
  teamJoin: (token: string, body: { credential: string; name?: string } | { name: string; email: string; password: string }) =>
    api<{ status: string; message: string }>(`/team-join/${token}`, { method: "POST", body }),
};