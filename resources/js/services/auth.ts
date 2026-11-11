export type AuthUser = {
  name: string;
  email: string;
  picture?: string;
};

const KEY = "admind_user";

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: AuthUser): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* ignore storage errors */
  }
}

export function clearUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore storage errors */
  }
}

const VERIFIED_KEY = "admind_verified_emails";
const PENDING_KEY = "admind_pending_user";

function readVerified(): string[] {
  try {
    const raw = localStorage.getItem(VERIFIED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isEmailVerified(email: string): boolean {
  return readVerified().includes(email.toLowerCase());
}

export function markEmailVerified(email: string): void {
  try {
    const list = readVerified();
    const e = email.toLowerCase();
    if (!list.includes(e)) list.push(e);
    localStorage.setItem(VERIFIED_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function savePendingUser(user: AuthUser): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function getPendingUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function clearPendingUser(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}