import type { Role } from "@/types";

/** Access tokens expire after 15 minutes (PRD §7.1). */
export const ACCESS_TTL_SECONDS = 15 * 60;
/** Refresh tokens expire after 7 days. */
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface AccessPayload {
  sub: string;
  role: Role;
  hid: string | null;
  exp: number;
}

const SIGNATURE = "mock-signature";

function b64(s: string) {
  return btoa(unescape(encodeURIComponent(s)));
}
function unb64(s: string) {
  return decodeURIComponent(escape(atob(s)));
}

export function signAccessToken(payload: Omit<AccessPayload, "exp">): string {
  const body: AccessPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ACCESS_TTL_SECONDS };
  return `mock.${b64(JSON.stringify(body))}.${SIGNATURE}`;
}

export type VerifyResult = { ok: true; payload: AccessPayload } | { ok: false; reason: "INVALID" | "EXPIRED" };

export function verifyAccessToken(token: string): VerifyResult {
  const [prefix, body, sig] = token.split(".");
  if (prefix !== "mock" || sig !== SIGNATURE || !body) return { ok: false, reason: "INVALID" };
  try {
    const payload = JSON.parse(unb64(body)) as AccessPayload;
    if (payload.exp * 1000 < Date.now()) return { ok: false, reason: "EXPIRED" };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "INVALID" };
  }
}

export function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
