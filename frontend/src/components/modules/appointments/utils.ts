import { addDays, format, parseISO } from "date-fns";
import type { AppointmentStatus, AvailabilityException, AvailabilityRule, Role, TimeSlot } from "@/types";

/** Local calendar date as YYYY-MM-DD (never via toISOString, which shifts to UTC). */
export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function shiftISODate(date: string, days: number): string {
  return toISODate(addDays(parseISO(date), days));
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Booking horizon for self-service and desk bookings. */
export const BOOKING_WINDOW_DAYS = 30;

export const DESK_ROLES: Role[] = ["RECEPTIONIST", "HOSPITAL_ADMIN"];
export const isDeskRole = (role: Role | undefined) => !!role && DESK_ROLES.includes(role);

/** Mirrors the server's appointment state machine. */
export const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

/** Monday-first display order; dayOfWeek uses 0 = Sunday. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type DayPart = "Morning" | "Afternoon" | "Evening";

export function dayPartOf(time: string): DayPart {
  const m = toMinutes(time);
  if (m < 12 * 60) return "Morning";
  if (m < 17 * 60) return "Afternoon";
  return "Evening";
}

export function groupSlots<T extends TimeSlot>(slots: T[]): { part: DayPart; slots: T[] }[] {
  const parts: DayPart[] = ["Morning", "Afternoon", "Evening"];
  return parts.map((part) => ({ part, slots: slots.filter((s) => dayPartOf(s.startTime) === part) })).filter((g) => g.slots.length > 0);
}

/** Whether the doctor's weekly schedule covers a date (ignores bookings). */
export function worksOn(
  date: string,
  rules: AvailabilityRule[] | undefined,
  exceptions: AvailabilityException[] | undefined,
): boolean | undefined {
  if (!rules) return undefined;
  if (exceptions?.some((x) => x.date === date)) return false;
  const dow = parseISO(date).getDay();
  return rules.some((r) => r.dayOfWeek === dow);
}

export function slotsInBlock(startTime: string, endTime: string, slotMinutes: number): number {
  const span = toMinutes(endTime) - toMinutes(startTime);
  return span > 0 && slotMinutes > 0 ? Math.floor(span / slotMinutes) : 0;
}

/** "Today", "Tomorrow" or "Tue, 06 Oct". */
export function friendlyDate(date: string): string {
  const today = todayISO();
  if (date === today) return "Today";
  if (date === shiftISODate(today, 1)) return "Tomorrow";
  if (date === shiftISODate(today, -1)) return "Yesterday";
  return format(parseISO(date), "EEE, dd MMM");
}
