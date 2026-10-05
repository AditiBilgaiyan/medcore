"use client";

import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { type BadgeTone, STATUS_TONE } from "@/components/shared/status-badge";
import { ROLE_LABELS } from "@/constants/roles";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { AuditAction } from "@/types";

export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Greeting + date line used at the top of every role dashboard. */
export function DashboardHeader({ actions, subtitle }: { actions?: React.ReactNode; subtitle?: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  const name = user.role === "DOCTOR" ? `Dr. ${user.lastName}` : user.firstName;
  const context = [ROLE_LABELS[user.role], user.hospitalName].filter(Boolean).join(" · ");
  return (
    <PageHeader
      title={`${greeting()}, ${name}`}
      description={
        <>
          <time dateTime={todayIso()}>{format(new Date(), "EEEE, d MMMM yyyy")}</time>
          {context && <span> · {context}</span>}
          {subtitle && <span> · {subtitle}</span>}
        </>
      }
      actions={actions}
      className="pb-1"
    />
  );
}

/** Left-edge status colour bar classes, aligned with StatusBadge tones. */
const BAR: Record<BadgeTone, string> = {
  neutral: "bg-muted-foreground/40",
  info: "bg-sky-500",
  primary: "bg-cyan-600",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  violet: "bg-violet-500",
};

export function statusBarClass(status: string): string {
  return BAR[STATUS_TONE[status] ?? "neutral"];
}

/** Placeholder rows for list widgets. */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Standard loading / error / empty handling for list widgets.
 * Renders children only when there's data to show.
 */
export function WidgetState({
  isLoading,
  error,
  onRetry,
  isEmpty,
  empty,
  rows,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  isEmpty: boolean;
  empty: React.ComponentProps<typeof EmptyState>;
  rows?: number;
  children: React.ReactNode;
}) {
  if (isLoading) return <ListSkeleton rows={rows} />;
  if (error && isEmpty) return <ErrorState error={error} onRetry={onRetry} className="py-6" />;
  if (isEmpty) return <EmptyState compact {...empty} />;
  return <>{children}</>;
}

/** A row inside a list widget that navigates somewhere. */
export function LinkRow({
  href,
  children,
  className,
  label,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group hover:bg-accent/50 focus-visible:outline-ring flex items-center gap-3 rounded-lg px-2 py-2 transition-colors focus-visible:outline-2",
        className,
      )}
    >
      {children}
      <ChevronRight
        className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    </Link>
  );
}

/** "View all" link for SectionCard actions. */
export function ViewAllLink({ href, children = "View all" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-primary focus-visible:outline-ring rounded text-xs font-medium hover:underline focus-visible:outline-2"
    >
      {children}
    </Link>
  );
}

/** Small count pill shown next to widget titles. */
export function CountPill({ count, label }: { count: number | undefined; label: string }) {
  if (count === undefined) return null;
  return (
    <span className="bg-muted text-muted-foreground ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
      {count}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

/** Badge tone per audit action (dashboard activity feed + audit log page). */
export const AUDIT_ACTION_TONE: Record<AuditAction, BadgeTone> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "danger",
  LOGIN: "neutral",
  LOGOUT: "neutral",
};
