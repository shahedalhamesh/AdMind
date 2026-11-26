export type AuthUser = {
  id?: number;
  name: string;
  email: string;
  picture?: string;
  role?: string;
  permissions?: string[];
  company_id?: number | null;
  client_id?: number | null;
  is_platform_admin?: boolean;
};

export type LoginResponse = { token: string; user: AuthUser };

const USER_KEY = "admind_user";
const TOKEN_KEY = "admind_token";

// Keys used by the old frontend-only flow (verify and onboarding). Removed on sign-out.
const LEGACY_KEYS = [
  "admind_verified_emails",
  "admind_pending_user",
  "admind_onboarded_emails",
  "admind_onboarded",
];

/* ---------- storage helpers ----------
   "Remember me" ON  -> localStorage   (stays after the browser is closed)
   "Remember me" OFF -> sessionStorage (gone when the tab is closed)       */
function stores(): Storage[] {
  const list: Storage[] = [];
  try { list.push(sessionStorage); } catch { /* ignore */ }
  try { list.push(localStorage); } catch { /* ignore */ }
  return list;
}

function readKey(key: string): string | null {
  for (const s of stores()) {
    try {
      const v = s.getItem(key);
      if (v) return v;
    } catch { /* ignore */ }
  }
  return null;
}

function clearKey(key: string): void {
  for (const s of stores()) {
    try { s.removeItem(key); } catch { /* ignore */ }
  }
}

function writeKey(key: string, value: string, remember: boolean): void {
  clearKey(key);
  try {
    (remember ? localStorage : sessionStorage).setItem(key, value);
  } catch { /* ignore */ }
}

/* ---------- session ---------- */
export function getToken(): string | null {
  return readKey(TOKEN_KEY);
}

// Only a cache for instant rendering. The real user always comes from GET /api/me (see AuthContext).
export function getUser(): AuthUser | null {
  const raw = readKey(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser, remember = true): void {
  writeKey(TOKEN_KEY, token, remember);
  writeKey(USER_KEY, JSON.stringify(user), remember);
}

// Update the cached user and keep it next to the token (same storage).
export function saveUser(user: AuthUser): void {
  let remember = true;
  try {
    const inLocal = localStorage.getItem(TOKEN_KEY) !== null;
    const inSession = sessionStorage.getItem(TOKEN_KEY) !== null;
    remember = inLocal || !inSession;
  } catch { /* ignore */ }
  writeKey(USER_KEY, JSON.stringify(user), remember);
}

export function clearUser(): void {
  clearKey(USER_KEY);
  clearKey(TOKEN_KEY);
  LEGACY_KEYS.forEach(clearKey);
}

/* ---------- permissions (same rule as the backend) ---------- */
export function can(user: AuthUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.is_platform_admin) return true;
  return (user.permissions ?? []).some(
    (g) => g === "*" || g === permission || (g.endsWith(".*") && permission.startsWith(g.slice(0, -1)))
  );
}

/* ---------- where each kind of user belongs ---------- */
export function homeFor(user: AuthUser): string {
  if (user.is_platform_admin) return "/platform";
  if (user.client_id) return "/portal";
  return "/dashboard";
}

// The AI chat is for the Employee only (a product decision): the Owner and the Manager do not use it.
// The AI chat is for the Employee and the Owner. The Manager does not use it.
// The AI chat is for everyone who is allowed to run agents (Employee, Manager and Owner).
export function canUseAssistant(user: AuthUser | null): boolean {
  return can(user, "agents.run");
}

// Meetings and Recommendations are for the Owner and the Manager only (a product decision).
export function canUseInsights(user: AuthUser | null): boolean {
  if (!can(user, "clients.view")) return false;
  const role = (user?.role ?? "").toLowerCase();
  return role === "owner" || role === "manager";
}