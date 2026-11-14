import { api } from "./api";

/* Mirrors UserController exactly. Users are never deleted: the backend sets status to "disabled"
   (which also signs the person out). */

export type UserStatus = "active" | "disabled";
export const USER_STATUSES: UserStatus[] = ["active", "disabled"];

export type Member = {
  id: number;
  name: string;
  email: string;
  status: UserStatus;
  role_id: number;
  client_id: number | null;
  role: { id: number; name: string } | null;
  client: { id: number; name: string } | null;
};

export type Role = { id: number; name: string; permissions: string[] };

export type MemberCreate = {
  name: string;
  email: string;
  password: string;
  role_id: number;
  client_id?: number | null;
  status?: UserStatus;
};

// "Send only what changes."
export type MemberUpdate = Partial<{
  name: string;
  email: string;
  password: string;
  role_id: number;
  client_id: number | null;
  status: UserStatus;
}>;

export const usersApi = {
  list: (params: { q?: string; role_id?: string; status?: string }) => api<Member[]>("/users", { params }),
  create: (body: MemberCreate) => api<Member>("/users", { method: "POST", body }),
  update: (id: number, body: MemberUpdate) => api<Member>(`/users/${id}`, { method: "PUT", body }),
  roles: () => api<Role[]>("/roles"),
};

export const CLIENT_ROLE = "Client";