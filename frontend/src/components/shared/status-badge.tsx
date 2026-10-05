import { cn } from "@/lib/utils";
import { humanize } from "@/lib/format";

export type BadgeTone = "neutral" | "info" | "primary" | "success" | "warning" | "danger" | "violet";

export const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
  primary: "bg-cyan-50 text-cyan-800 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/30",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  warning: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  danger: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30",
  violet: "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30",
};

const DOT: Record<BadgeTone, string> = {
  neutral: "bg-muted-foreground/60",
  info: "bg-sky-500",
  primary: "bg-cyan-600",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  violet: "bg-violet-500",
};

/** One map for every workflow status in the app so colours stay consistent. */
export const STATUS_TONE: Record<string, BadgeTone> = {
  // Appointments
  PENDING: "warning",
  CONFIRMED: "info",
  IN_PROGRESS: "violet",
  COMPLETED: "success",
  CANCELLED: "neutral",
  NO_SHOW: "danger",
  EMERGENCY: "danger",
  // Lab
  ORDERED: "neutral",
  SAMPLE_COLLECTED: "info",
  PROCESSING: "violet",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  // Billing
  DRAFT: "neutral",
  ISSUED: "info",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  INSURANCE_PENDING: "violet",
  VOID: "neutral",
  SUCCEEDED: "success",
  FAILED: "danger",
  // Claims
  SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  SETTLED: "success",
  // Prescriptions
  PARTIALLY_DISPENSED: "warning",
  DISPENSED: "success",
  // Hospitals / users
  PENDING_VERIFICATION: "warning",
  ACTIVE: "success",
  SUSPENDED: "danger",
  INVITED: "info",
  DISABLED: "neutral",
  // Lab priority
  ROUTINE: "neutral",
  URGENT: "warning",
  STAT: "danger",
  // Result flags
  NORMAL: "success",
  LOW: "warning",
  HIGH: "warning",
  CRITICAL: "danger",
  // Pharmacy batches
  QUARANTINED: "danger",
  DEPLETED: "neutral",
  EXPIRED: "danger",
  EXPIRING: "warning",
  // Admissions
  ADMITTED: "info",
  DISCHARGED: "neutral",
  // Allergy severity
  MILD: "warning",
  MODERATE: "warning",
  SEVERE: "danger",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}

/** Text label + colour + dot, so colour is never the only signal. */
export function StatusBadge({ status, label, tone, className, dot = true }: StatusBadgeProps) {
  const t = tone ?? STATUS_TONE[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONE_CLASSES[t],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", DOT[t])} aria-hidden />}
      {label ?? humanize(status)}
    </span>
  );
}
