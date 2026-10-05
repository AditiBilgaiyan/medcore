"use client";

import { CalendarX2, Siren } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Appointment, AppointmentStatus, Doctor } from "@/types";
import { AppointmentActions } from "./appointment-actions";

interface DayBoardProps {
  appointments: Appointment[] | undefined;
  doctors: Doctor[] | undefined;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Always show this doctor's column even if empty (doctor filter). */
  pinnedDoctorId?: string;
  truncated?: boolean;
}

/** One column per doctor with that day's appointments as status-coloured cards. */
export function DayBoard({ appointments, doctors, isLoading, isFetching, error, onRetry, pinnedDoctorId, truncated }: DayBoardProps) {
  const columns = useMemo(() => {
    const byDoctor = new Map<string, { id: string; name: string; specialisation?: string; items: Appointment[] }>();
    if (pinnedDoctorId) {
      const d = doctors?.find((x) => x.id === pinnedDoctorId);
      if (d) byDoctor.set(d.id, { id: d.id, name: `Dr. ${d.firstName} ${d.lastName}`, specialisation: d.specialisation, items: [] });
    }
    for (const a of appointments ?? []) {
      if (!byDoctor.has(a.doctorId)) {
        const d = doctors?.find((x) => x.id === a.doctorId);
        byDoctor.set(a.doctorId, { id: a.doctorId, name: a.doctorName, specialisation: d?.specialisation, items: [] });
      }
      byDoctor.get(a.doctorId)!.items.push(a);
    }
    for (const col of byDoctor.values()) col.items.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return [...byDoctor.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [appointments, doctors, pinnedDoctorId]);

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Loading day board">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card w-72 shrink-0 space-y-2 rounded-xl border p-3">
            <Skeleton className="h-8 w-40" />
            {Array.from({ length: 4 }).map((__, j) => (
              <Skeleton key={j} className="h-20" />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (error && !appointments) return <ErrorState error={error} onRetry={onRetry} className="bg-card rounded-xl border" />;
  if (!columns.length) {
    return (
      <div className="bg-card rounded-xl border">
        <EmptyState icon={CalendarX2} title="No appointments on this day" description="Try another date or clear the filters." />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {truncated && (
        <p className="text-muted-foreground text-xs">Showing the first 200 appointments. Narrow the filters to see the rest.</p>
      )}
      <div
        className={cn("flex snap-x gap-3 overflow-x-auto pb-3 transition-opacity", isFetching && "opacity-70")}
        role="region"
        aria-label="Day board — scroll horizontally for more doctors"
        tabIndex={0}
      >
        {columns.map((col) => (
          <section
            key={col.id}
            className="bg-muted/30 flex w-72 shrink-0 snap-start flex-col rounded-xl border"
            aria-label={`${col.name}, ${col.items.length} appointments`}
          >
            <header className="bg-card flex items-center gap-2 border-b px-3 py-2.5 first:rounded-t-xl">
              <UserAvatar name={col.name} className="size-7" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold">{col.name}</h3>
                {col.specialisation && <p className="text-muted-foreground truncate text-xs">{col.specialisation}</p>}
              </div>
              <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">{col.items.length}</span>
            </header>
            <ol className="flex flex-col gap-2 p-2">
              {col.items.length === 0 && <li className="text-muted-foreground px-2 py-6 text-center text-xs">No appointments</li>}
              {col.items.map((a) => (
                <BoardCard key={a.id} appt={a} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

const STRIP: Record<AppointmentStatus, string> = {
  PENDING: "bg-warning",
  CONFIRMED: "bg-info",
  IN_PROGRESS: "bg-primary",
  COMPLETED: "bg-success",
  CANCELLED: "bg-muted-foreground/40",
  NO_SHOW: "bg-destructive",
};

function BoardCard({ appt }: { appt: Appointment }) {
  const muted = appt.status === "CANCELLED" || appt.status === "NO_SHOW";
  return (
    <li
      className={cn(
        "bg-card hover:border-primary/40 relative rounded-lg border p-2.5 text-sm shadow-xs transition-colors",
        appt.isEmergency && "border-destructive/50",
        muted && "opacity-70",
      )}
    >
      {/* Status colour strip — the badge below carries the text label. */}
      <span className={cn("absolute inset-y-2 left-0 w-1 rounded-r", STRIP[appt.status])} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold tabular-nums">
            {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
          </p>
          <Link
            href={ROUTES.appointment(appt.id)}
            className={cn(
              "focus-visible:after:ring-ring/50 block truncate font-medium after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-3",
              muted && "line-through",
            )}
          >
            {appt.patientName}
          </Link>
          <p className="text-muted-foreground truncate text-xs tabular-nums">{appt.patientMrn}</p>
        </div>
        <div className="relative z-10">
          <AppointmentActions appt={appt} variant="menu" />
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-1.5">
        <StatusBadge status={appt.status} />
        {appt.isEmergency && (
          <span className="text-destructive inline-flex items-center gap-1 text-xs font-medium">
            <Siren className="size-3" aria-hidden /> Emergency
          </span>
        )}
        {appt.type === "FOLLOW_UP" && <span className="text-muted-foreground text-xs">Follow-up</span>}
      </div>
      {appt.reason && <p className="text-muted-foreground mt-1 truncate pl-1.5 text-xs">{appt.reason}</p>}
    </li>
  );
}
