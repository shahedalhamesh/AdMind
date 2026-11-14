import { clearUser, getToken } from "./auth";

export const API_BASE: string = import.meta.env.VITE_API_URL ?? "/api";

// Fired when the server says the token is no longer valid (401). AuthContext listens to it.
export const UNAUTHORIZED_EVENT = "admind:unauthorized";

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  code?: string;

  constructor(message: string, status: number, errors?: Record<string, string[]>, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
  params?: Params;
};

function fallbackMessage(status: number): string {
  switch (status) {
    case 403: return "You do not have permission to do this.";
    case 404: return "Not found.";
    case 429: return "The system is busy. Please try again in a moment.";
    case 502:
    case 503: return "A service is unavailable right now. Please try again later.";
    default: return "Something went wrong. Please try again.";
  }
}

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, formData, params } = options;
  const token = getToken();

  let url = `${API_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") qs.set(k, String(v));
    });
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  // For multipart (formData) the browser sets Content-Type itself: never set it here.
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check that the backend is running.", 0);
  }

  let data: any = null;
  if (res.status !== 204) {
    try {
      data = await res.json();
    } catch {
      /* empty or non-JSON response */
    }
  }

  // Invalid or expired token: clear the session. The route guards then send the user to /login.
  if (res.status === 401 && token) {
    clearUser();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (!res.ok) {
    throw new ApiError(data?.message ?? fallbackMessage(res.status), res.status, data?.errors, data?.code);
  }

  return data as T;
}