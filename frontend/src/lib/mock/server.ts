import type { RawResponse } from "@/lib/api/client";
import { getDb, persist } from "./db";
import "./handlers";
import { createContext, matchRoute, MockHttpError } from "./router";
import { seedDatabase } from "./seed";
import { verifyAccessToken } from "./tokens";

interface MockRequest {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  accessToken: string | null;
  deviceId: string;
  signal?: AbortSignal;
}

/** Rate limit on auth endpoints: 100 requests / 15 min (PRD §10). */
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_LIMIT = 100;
const authHits: number[] = [];

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

const error = (status: number, code: string, message: string, details?: Record<string, string[]>): RawResponse => ({
  status,
  body: { success: false, error: { code, message, details } },
});

export async function mockRequest(req: MockRequest): Promise<RawResponse> {
  // Simulated network latency so loading states are visible (skipped in tests).
  if (process.env.NODE_ENV !== "test") await delay(120 + Math.random() * 260, req.signal);

  const db = await getDb(seedDatabase);
  const path = req.path.split("?")[0];

  if (path.startsWith("/auth/")) {
    const now = Date.now();
    while (authHits.length && now - authHits[0] > AUTH_WINDOW_MS) authHits.shift();
    if (authHits.length >= AUTH_LIMIT) {
      return error(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.");
    }
    authHits.push(now);
  }

  const match = matchRoute(req.method, path);
  if (!match) return error(404, "ROUTE_NOT_FOUND", `${req.method} ${path} is not implemented.`);

  let user = null;
  if (req.accessToken) {
    const verified = verifyAccessToken(req.accessToken);
    if (!verified.ok && !match.def.isPublic) {
      return error(
        401,
        verified.reason === "EXPIRED" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
        "Your session has expired. Please sign in again.",
      );
    }
    if (verified.ok) {
      user = db.users.find((u) => u.id === verified.payload.sub && !u.deletedAt) ?? null;
      if (user && user.status === "DISABLED") return error(403, "ACCOUNT_DISABLED", "This account has been disabled.");
    }
  }
  if (!match.def.isPublic && !user) return error(401, "UNAUTHORIZED", "Please sign in to continue.");

  const ctx = createContext({
    db,
    method: req.method,
    path,
    params: match.params,
    query: req.query ?? {},
    // Clone so handlers never hold references to client objects.
    body: req.body === undefined ? {} : JSON.parse(JSON.stringify(req.body)),
    user,
    deviceId: req.deviceId,
  });

  try {
    const result = match.def.handler(ctx);
    if (req.method !== "GET") await persist();
    // Clone the response so the UI can't mutate the in-memory database.
    if (result.kind === "page") {
      return {
        status: 200,
        body: { success: true, data: JSON.parse(JSON.stringify(result.data)), meta: result.meta },
      };
    }
    return {
      status: result.status ?? 200,
      body: {
        success: true,
        data: result.data === undefined ? null : JSON.parse(JSON.stringify(result.data)),
        message: result.message ?? "OK",
      },
    };
  } catch (err) {
    if (err instanceof MockHttpError) return error(err.status, err.code, err.message, err.details);
    console.error("[mock-api]", req.method, path, err);
    return error(500, "INTERNAL_ERROR", "Something went wrong on our side. Please try again.");
  }
}
