import { hasPermission, permissionsForRole, type Permission } from "@/constants/permissions";
import type { AuditAction, CurrentUser, Notification, NotificationChannel, NotificationType, PaginationMeta, Role } from "@/types";
import { MOCK_REFRESH_COOKIE, nextNumber, uid, type MockDb, type StoredUser } from "./db";
import { mockBus } from "./events";

export class MockHttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export const fail = (status: number, code: string, message: string, details?: Record<string, string[]>): never => {
  throw new MockHttpError(status, code, message, details);
};
export const notFound = (entity = "Resource"): never => fail(404, "NOT_FOUND", `${entity} not found.`);
export const forbidden = (message = "You don't have permission to do that."): never => fail(403, "FORBIDDEN", message);

export type HandlerResult =
  { kind: "data"; data: unknown; message?: string; status?: number } | { kind: "page"; data: unknown[]; meta: PaginationMeta };

export const ok = (data: unknown, message = "OK", status = 200): HandlerResult => ({ kind: "data", data, message, status });
export const created = (data: unknown, message = "Created"): HandlerResult => ({ kind: "data", data, message, status: 201 });

/* ------------------------------------------------------------------ */
/* Query helpers                                                       */
/* ------------------------------------------------------------------ */

export class Query {
  constructor(private readonly raw: Record<string, unknown>) {}
  str(key: string): string | undefined {
    const v = this.raw[key];
    if (v == null || v === "") return undefined;
    return Array.isArray(v) ? String(v[0]) : String(v);
  }
  num(key: string, fallback?: number): number | undefined {
    const v = this.str(key);
    const n = v != null ? Number(v) : NaN;
    return Number.isFinite(n) ? n : fallback;
  }
  arr(key: string): string[] | undefined {
    const v = this.raw[key];
    if (v == null || v === "") return undefined;
    const list = (Array.isArray(v) ? v : [v]).flatMap((x) => String(x).split(","));
    return list.filter(Boolean);
  }
  bool(key: string): boolean | undefined {
    const v = this.str(key);
    return v == null ? undefined : v === "true";
  }
}

export function paginate<T>(list: T[], q: Query, defaultLimit = 20): HandlerResult {
  const limit = Math.min(Math.max(q.num("limit", defaultLimit)!, 1), 200);
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(q.num("page", 1)!, 1), totalPages);
  return {
    kind: "page",
    data: list.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total, totalPages },
  };
}

export function matchesSearch(search: string | undefined, ...fields: (string | undefined | null)[]): boolean {
  if (!search) return true;
  const needle = search.trim().toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

export function sortBy<T>(list: T[], q: Query, defaults: { key: keyof T & string; order: "asc" | "desc" }): T[] {
  const key = (q.str("sortBy") as keyof T & string) ?? defaults.key;
  const order = (q.str("sortOrder") as "asc" | "desc") ?? defaults.order;
  const dir = order === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const av = a[key] as unknown;
    const bv = b[key] as unknown;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface MockContext {
  db: MockDb;
  method: string;
  path: string;
  params: Record<string, string>;
  query: Query;
  body: Record<string, unknown>;
  user: StoredUser | null;
  deviceId: string;
  ip: string;
  requireUser(): StoredUser;
  requirePermission(permission: Permission): StoredUser;
  requireRoles(...roles: Role[]): StoredUser;
  /** null means all tenants (Super Admin). */
  tenantId(): string | null;
  /** 404 (not 403) when the entity belongs to another tenant, so IDs can't be probed. */
  assertTenant(entity: { hospitalId: string | null } | undefined, name?: string): void;
  /** Patient record linked to the current PATIENT user. */
  ownPatientId(): string | undefined;
  /** Doctor profile linked to the current DOCTOR user. */
  ownDoctorId(): string | undefined;
  audit(action: AuditAction, entityType: string, entityId: string, summary: string): void;
  notify(
    userId: string | undefined,
    n: { type: NotificationType; title: string; body: string; link?: string; channels: NotificationChannel[] },
  ): void;
  notifyRole(role: Role, hospitalId: string, n: Parameters<MockContext["notify"]>[1]): void;
  number(key: string, prefix: string): string;
  getRefreshCookie(): string | null;
  setRefreshCookie(token: string | null): void;
}

export function createContext(init: {
  db: MockDb;
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  user: StoredUser | null;
  deviceId: string;
}): MockContext {
  const { db } = init;
  const ctx: MockContext = {
    db,
    method: init.method,
    path: init.path,
    params: init.params,
    query: new Query(init.query),
    body: (init.body ?? {}) as Record<string, unknown>,
    user: init.user,
    deviceId: init.deviceId,
    ip: "127.0.0.1",
    requireUser() {
      if (!ctx.user) fail(401, "UNAUTHORIZED", "Please sign in to continue.");
      return ctx.user!;
    },
    requirePermission(permission) {
      const u = ctx.requireUser();
      if (!hasPermission(u.role, permission)) forbidden();
      return u;
    },
    requireRoles(...roles) {
      const u = ctx.requireUser();
      if (!roles.includes(u.role)) forbidden();
      return u;
    },
    tenantId() {
      const u = ctx.requireUser();
      return u.role === "SUPER_ADMIN" ? null : u.hospitalId;
    },
    assertTenant(entity, name = "Resource") {
      if (!entity) notFound(name);
      const tenant = ctx.tenantId();
      if (tenant !== null && entity!.hospitalId !== tenant) notFound(name);
    },
    ownPatientId() {
      const u = ctx.user;
      return u ? db.patients.find((p) => p.userId === u.id)?.id : undefined;
    },
    ownDoctorId() {
      const u = ctx.user;
      return u ? db.doctors.find((d) => d.userId === u.id)?.id : undefined;
    },
    audit(action, entityType, entityId, summary) {
      const u = ctx.requireUser();
      db.auditLogs.unshift({
        id: uid("aud"),
        hospitalId: u.hospitalId,
        userId: u.id,
        userName: `${u.firstName} ${u.lastName}`,
        userRole: u.role,
        action,
        entityType,
        entityId,
        summary,
        ip: ctx.ip,
        createdAt: new Date().toISOString(),
      });
    },
    notify(userId, n) {
      if (!userId) return;
      const notification: Notification = {
        id: uid("ntf"),
        userId,
        ...n,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      db.notifications.unshift(notification);
      if (n.channels.includes("IN_APP")) mockBus.emit(userId, "notification:new", notification);
    },
    notifyRole(role, hospitalId, n) {
      db.users.filter((u) => u.role === role && u.hospitalId === hospitalId && u.status === "ACTIVE").forEach((u) => ctx.notify(u.id, n));
    },
    number(key, prefix) {
      return nextNumber(db, key, prefix);
    },
    getRefreshCookie() {
      return typeof window === "undefined" ? null : window.localStorage.getItem(MOCK_REFRESH_COOKIE);
    },
    setRefreshCookie(token) {
      if (typeof window === "undefined") return;
      if (token) window.localStorage.setItem(MOCK_REFRESH_COOKIE, token);
      else window.localStorage.removeItem(MOCK_REFRESH_COOKIE);
    },
  };
  return ctx;
}

export function toCurrentUser(db: MockDb, u: StoredUser): CurrentUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = u;
  return {
    ...rest,
    hospitalName: db.hospitals.find((h) => h.id === u.hospitalId)?.name ?? null,
    permissions: permissionsForRole(u.role),
    doctorId: db.doctors.find((d) => d.userId === u.id)?.id,
    patientId: db.patients.find((p) => p.userId === u.id)?.id,
  };
}

export function publicUser(u: StoredUser) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = u;
  return rest;
}

/* ------------------------------------------------------------------ */
/* Route table                                                         */
/* ------------------------------------------------------------------ */

export type Handler = (ctx: MockContext) => HandlerResult;

interface RouteDef {
  method: string;
  pattern: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
  isPublic: boolean;
}

const routes: RouteDef[] = [];

export function route(method: string, pattern: string, handler: Handler, opts: { public?: boolean } = {}) {
  const keys: string[] = [];
  const regex = new RegExp(
    `^${pattern.replace(/\//g, "\\/").replace(/:(\w+)/g, (_, k) => {
      keys.push(k);
      return "([^/]+)";
    })}$`,
  );
  routes.push({ method, pattern, regex, keys, handler, isPublic: !!opts.public });
}

export function matchRoute(method: string, path: string) {
  // Static segments beat params: "/medicines/summary" before "/medicines/:id".
  const candidates = routes
    .filter((r) => r.method === method)
    .map((r) => ({ r, m: r.regex.exec(path) }))
    .filter((x) => x.m)
    .sort((a, b) => a.r.keys.length - b.r.keys.length);
  const hit = candidates[0];
  if (!hit) return null;
  const params: Record<string, string> = {};
  hit.r.keys.forEach((k, i) => (params[k] = decodeURIComponent(hit.m![i + 1])));
  return { def: hit.r, params };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function requireFields(body: Record<string, unknown>, fields: string[]) {
  const details: Record<string, string[]> = {};
  for (const f of fields) {
    const v = body[f];
    if (v == null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0)) {
      details[f] = ["This field is required."];
    }
  }
  if (Object.keys(details).length) fail(422, "VALIDATION_ERROR", "Please fix the highlighted fields.", details);
}

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export const round2 = (n: number) => Math.round(n * 100) / 100;
