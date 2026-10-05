import { ROUTES } from "@/constants/routes";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { BadgeTone } from "@/components/shared/status-badge";
import type { AppointmentStatus, InvoiceStatus, LabResult, PrescriptionStatus } from "@/types";

/** Local calendar date as yyyy-MM-dd (matches the API's ISODate). */
export function isoDay(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

export function todayIso(): string {
  return isoDay(new Date());
}

export function addDaysIso(days: number, from: Date = new Date()): string {
  return isoDay(addDays(from, days));
}

/** Calendar days from today until the given ISO date (negative = past). */
export function daysUntil(date: string): number {
  return differenceInCalendarDays(parseISO(date), new Date());
}

/** "Today", "Tomorrow", "In 2 days", "Yesterday", "3 days ago" */
export function countdownLabel(date: string): string {
  const d = daysUntil(date);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d > 1) return `In ${d} days`;
  if (d === -1) return "Yesterday";
  return `${Math.abs(d)} days ago`;
}

/** "Mon, 6 Oct" */
export function shortDay(date: string): string {
  return format(parseISO(date), "EEE, d MMM");
}

/** "Monday, 6 October 2026" */
export function longDay(date: string | Date): string {
  return format(typeof date === "string" ? parseISO(date) : date, "EEEE, d MMMM yyyy");
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ---------------- Plain-language statuses ---------------- */

export const APPOINTMENT_STATUS_COPY: Record<AppointmentStatus, { label: string; help: string }> = {
  PENDING: { label: "Awaiting confirmation", help: "The hospital will confirm this time shortly. We'll notify you." },
  CONFIRMED: { label: "Confirmed", help: "Your appointment is booked. Please arrive 10 minutes early." },
  IN_PROGRESS: { label: "In progress", help: "Your consultation is under way." },
  COMPLETED: { label: "Completed", help: "Your visit is complete." },
  CANCELLED: { label: "Cancelled", help: "This appointment was cancelled." },
  NO_SHOW: { label: "Missed", help: "This appointment was marked as missed." },
};

export const PRESCRIPTION_STATUS_COPY: Record<PrescriptionStatus, { label: string; help: string; tone: BadgeTone }> = {
  ISSUED: { label: "Ready to collect", help: "Ready to collect at the hospital pharmacy.", tone: "info" },
  PARTIALLY_DISPENSED: {
    label: "Partly collected",
    help: "Some medicines have been collected. Collect the rest at the pharmacy.",
    tone: "warning",
  },
  DISPENSED: { label: "Dispensed", help: "All medicines have been collected.", tone: "success" },
  CANCELLED: { label: "Cancelled", help: "Your doctor cancelled this prescription.", tone: "neutral" },
};

export const INVOICE_STATUS_COPY: Record<InvoiceStatus, { label: string; help: string }> = {
  DRAFT: { label: "Draft", help: "This bill is still being prepared." },
  ISSUED: { label: "Unpaid", help: "This bill is waiting for payment." },
  PARTIALLY_PAID: { label: "Partly paid", help: "Part of this bill has been paid. The balance is still due." },
  PAID: { label: "Paid", help: "This bill is fully paid. Thank you." },
  INSURANCE_PENDING: { label: "With insurer", help: "Your insurer is reviewing this bill." },
  VOID: { label: "Cancelled", help: "This bill was cancelled and no payment is needed." },
};

export const PAYABLE_STATUSES: InvoiceStatus[] = ["ISSUED", "PARTIALLY_PAID"];

export function abnormalCount(results: LabResult[]): { abnormal: number; critical: number } {
  return {
    abnormal: results.filter((r) => r.flag !== "NORMAL").length,
    critical: results.filter((r) => r.flag === "CRITICAL").length,
  };
}

export function prescriptionHref(id: string): string {
  return ROUTES.portalPrescription(id);
}
