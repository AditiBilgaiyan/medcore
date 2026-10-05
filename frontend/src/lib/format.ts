import { differenceInYears, format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { CURRENCY, LOCALE } from "@/constants/config";

function toDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

/** 04 Oct 2026 */
export function formatDate(value: string | Date | undefined | null, pattern = "dd MMM yyyy"): string {
  const d = toDate(value);
  return d ? format(d, pattern) : "—";
}

/** 04 Oct 2026, 09:30 */
export function formatDateTime(value: string | Date | undefined | null): string {
  return formatDate(value, "dd MMM yyyy, HH:mm");
}

/** "09:30" -> "9:30 AM" */
export function formatTime(time: string | undefined | null): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatRelative(value: string | Date | undefined | null): string {
  const d = toDate(value);
  return d ? `${formatDistanceToNowStrict(d)} ago` : "—";
}

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 2,
});
const compactCurrencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});
const numberFormatter = new Intl.NumberFormat(LOCALE);

export function formatCurrency(amount: number | undefined | null, compact = false): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return compact ? compactCurrencyFormatter.format(amount) : currencyFormatter.format(amount);
}

export function formatNumber(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return numberFormatter.format(value);
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function fullName(p: { firstName: string; lastName: string } | undefined | null): string {
  return p ? `${p.firstName} ${p.lastName}`.trim() : "—";
}

export function doctorName(d: { firstName: string; lastName: string } | undefined | null): string {
  return d ? `Dr. ${d.firstName} ${d.lastName}` : "—";
}

export function initials(name: string): string {
  return name
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function ageFromDob(dob: string | undefined | null): number | null {
  const d = toDate(dob);
  return d ? differenceInYears(new Date(), d) : null;
}

/** "34 y · Male" */
export function ageGender(dob: string | undefined, gender: string | undefined): string {
  const age = ageFromDob(dob);
  const g = gender ? gender.charAt(0) + gender.slice(1).toLowerCase() : "";
  return [age != null ? `${age} y` : null, g].filter(Boolean).join(" · ");
}

/** "IN_PROGRESS" -> "In progress" */
export function humanize(value: string | undefined | null): string {
  if (!value) return "—";
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
