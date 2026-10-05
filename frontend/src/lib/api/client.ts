import { API_BASE_URL, USE_MOCK_API } from "@/constants/config";
import { useAuthStore } from "@/store/auth-store";
import type { ApiErrorBody, ApiPaginated, ApiSuccess, AuthSession, Paginated } from "@/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export type QueryParams = Record<string, string | number | boolean | string[] | undefined | null>;

interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  /** Don't attach the access token or attempt a refresh (auth endpoints). */
  skipAuth?: boolean;
}

export interface RawResponse {
  status: number;
  body: ApiSuccess<unknown> | ApiPaginated<unknown> | ApiErrorBody;
}

const STATE_CHANGING = new Set<HttpMethod>(["POST", "PATCH", "PUT", "DELETE"]);

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const key = "medcore.deviceId";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function buildQueryString(query?: QueryParams): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function send(method: HttpMethod, path: string, opts: RequestOptions): Promise<RawResponse> {
  const accessToken = opts.skipAuth ? null : useAuthStore.getState().accessToken;

  if (USE_MOCK_API) {
    const { mockRequest } = await import("@/lib/mock/server");
    return mockRequest({
      method,
      path,
      query: opts.query,
      body: opts.body,
      accessToken,
      deviceId: getDeviceId(),
      signal: opts.signal,
    });
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Device-Id": getDeviceId(),
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (STATE_CHANGING.has(method)) {
    const csrf = readCookie("csrf_token");
    if (csrf) headers["X-CSRF-Token"] = decodeURIComponent(csrf);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}${buildQueryString(opts.query)}`, {
      method,
      headers,
      credentials: "include",
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
  }

  const body = await res.json().catch(() => ({
    success: false,
    error: { code: "INVALID_RESPONSE", message: `Unexpected response (${res.status})` },
  }));
  return { status: res.status, body };
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchange the refresh-token cookie for a new access token. Concurrent callers
 * share one request so a burst of 401s triggers a single rotation.
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await send("POST", "/auth/refresh", { skipAuth: true });
        if (!res.body.success) return false;
        useAuthStore.getState().setSession((res.body as ApiSuccess<AuthSession>).data);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshInFlight = null), 0);
      }
    })();
  }
  return refreshInFlight;
}

async function request(method: HttpMethod, path: string, opts: RequestOptions = {}, retried = false) {
  const res = await send(method, path, opts);
  if (res.body.success) return res.body;

  const { code, message, details } = res.body.error;
  if (res.status === 401 && !opts.skipAuth && !retried) {
    const refreshed = await refreshSession();
    if (refreshed) return request(method, path, opts, true);
    useAuthStore.getState().clear();
  }
  throw new ApiError(res.status, code, message, details);
}

export const api = {
  async get<T>(path: string, query?: object, signal?: AbortSignal): Promise<T> {
    const body = await request("GET", path, { query: query as QueryParams, signal });
    return (body as ApiSuccess<T>).data;
  },
  async list<T>(path: string, query?: object, signal?: AbortSignal): Promise<Paginated<T>> {
    const body = (await request("GET", path, { query: query as QueryParams, signal })) as ApiPaginated<T>;
    return { data: body.data, meta: body.meta };
  },
  async post<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">): Promise<T> {
    const res = await request("POST", path, { ...opts, body });
    return (res as ApiSuccess<T>).data;
  },
  async patch<T>(path: string, body?: unknown): Promise<T> {
    const res = await request("PATCH", path, { body });
    return (res as ApiSuccess<T>).data;
  },
  async put<T>(path: string, body?: unknown): Promise<T> {
    const res = await request("PUT", path, { body });
    return (res as ApiSuccess<T>).data;
  },
  async delete<T>(path: string): Promise<T> {
    const res = await request("DELETE", path);
    return (res as ApiSuccess<T>).data;
  },
};

/** User-facing message for any thrown error. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
