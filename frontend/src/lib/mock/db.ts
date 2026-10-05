import type {
  Admission,
  Appointment,
  AuditLog,
  AvailabilityException,
  AvailabilityRule,
  Department,
  Dispensation,
  Doctor,
  Hospital,
  InsuranceClaim,
  Invoice,
  LabOrder,
  LabTest,
  MedicalRecord,
  Medicine,
  Notification,
  Patient,
  Prescription,
  User,
  Vaccination,
  Ward,
} from "@/types";

export interface StoredUser extends User {
  /** Mock only. The real API stores a bcrypt hash (cost 12). */
  password: string;
}

export type StoredMedicine = Omit<Medicine, "totalStock" | "unitPrice">;

export interface StoredRefreshToken {
  token: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  ip: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt?: string;
  /** Set when rotated; reusing a rotated token revokes the whole family. */
  replacedBy?: string;
}

export interface StoredOtp {
  userId: string;
  purpose: "EMAIL" | "PHONE" | "RESET";
  code: string;
  expiresAt: string;
}

export interface MockDb {
  schemaVersion: number;
  seededAt: string;
  hospitals: Hospital[];
  departments: Department[];
  users: StoredUser[];
  doctors: Doctor[];
  availability: AvailabilityRule[];
  availabilityExceptions: AvailabilityException[];
  patients: Patient[];
  appointments: Appointment[];
  medicalRecords: MedicalRecord[];
  vaccinations: Vaccination[];
  prescriptions: Prescription[];
  labTests: LabTest[];
  labOrders: LabOrder[];
  medicines: StoredMedicine[];
  dispensations: Dispensation[];
  invoices: Invoice[];
  claims: InsuranceClaim[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  wards: Ward[];
  admissions: Admission[];
  refreshTokens: StoredRefreshToken[];
  otps: StoredOtp[];
  counters: Record<string, number>;
}

export const SCHEMA_VERSION = 2;
const STORAGE_KEY = "medcore.mockdb";
/** Reseed when the demo data is older than this so dashboards stay populated. */
const MAX_SEED_AGE_DAYS = 5;

let cache: MockDb | null = null;
let loading: Promise<MockDb> | null = null;

const hasIdb = () => typeof window !== "undefined" && typeof indexedDB !== "undefined";

/** Other tabs drop their in-memory copy when this tab writes, so the next request reloads. */
const channel = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("medcore.mockdb") : null;
channel?.addEventListener("message", (e) => {
  if (e.data === "updated" || e.data === "reset") {
    cache = null;
    loading = null;
  }
});

/**
 * The mock database lives in IndexedDB (localStorage is too small for two weeks of
 * hospital data). Loads once per tab and keeps an in-memory copy.
 */
export async function getDb(seed: () => MockDb): Promise<MockDb> {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      if (hasIdb()) {
        try {
          const { get } = await import("idb-keyval");
          const stored = await get<MockDb>(STORAGE_KEY);
          if (stored) {
            const ageDays = (Date.now() - new Date(stored.seededAt).getTime()) / 86_400_000;
            if (stored.schemaVersion === SCHEMA_VERSION && ageDays < MAX_SEED_AGE_DAYS) {
              cache = stored;
              return stored;
            }
          }
        } catch {
          // Storage unavailable or corrupt — fall through and reseed.
        }
      }
      cache = seed();
      await writeNow();
      return cache;
    })();
  }
  return loading;
}

async function writeNow(): Promise<void> {
  if (!cache || !hasIdb()) return;
  try {
    const { set } = await import("idb-keyval");
    await set(STORAGE_KEY, cache);
    channel?.postMessage("updated");
  } catch {
    // Quota exceeded or private mode — keep working in memory.
  }
}

let writeChain: Promise<void> = Promise.resolve();

/**
 * Persist after a mutation. Writes are serialised and awaited by the mock server
 * before it responds, so a reload straight after a change (e.g. signing in) never
 * reads stale data.
 */
export function persist(): Promise<void> {
  writeChain = writeChain.then(writeNow, writeNow);
  return writeChain;
}

export async function resetDb(): Promise<void> {
  cache = null;
  loading = null;
  if (hasIdb()) {
    const { del } = await import("idb-keyval");
    await del(STORAGE_KEY);
    window.localStorage.removeItem(MOCK_REFRESH_COOKIE);
    channel?.postMessage("reset");
  }
}

/** The mock stands in for the browser's httpOnly refresh-token cookie. */
export const MOCK_REFRESH_COOKIE = "medcore.mock.refresh";

export function uid(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

/** Human-readable sequential numbers: INV-2026-00042 */
export function nextNumber(db: MockDb, key: string, prefix: string, pad = 5): string {
  db.counters[key] = (db.counters[key] ?? 0) + 1;
  return `${prefix}-${new Date().getFullYear()}-${String(db.counters[key]).padStart(pad, "0")}`;
}
