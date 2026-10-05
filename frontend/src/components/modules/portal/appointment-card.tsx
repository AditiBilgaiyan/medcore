"use client";

import { CalendarClock, CalendarX2, Clock, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatTime, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUpdateAppointmentStatus } from "@/services/appointments";
import type { Appointment } from "@/types";
import { RescheduleDialog } from "./reschedule-dialog";
import { APPOINTMENT_STATUS_COPY, countdownLabel, daysUntil, longDay } from "./portal-utils";

export function isChangeable(a: Appointment) {
  return (a.status === "PENDING" || a.status === "CONFIRMED") && daysUntil(a.date) >= 0;
}

export function CancelAppointmentDialog({ appointment, trigger }: { appointment: Appointment; trigger: React.ReactNode }) {
  const update = useUpdateAppointmentStatus();
  return (
    <ConfirmDialog
      trigger={trigger}
      title="Cancel this appointment?"
      description={`${appointment.doctorName} on ${longDay(appointment.date)} at ${formatTime(appointment.startTime)}. This can't be undone — you'd need to book again.`}
      confirmLabel="Cancel appointment"
      destructive
      reason={{ label: "Reason for cancelling", placeholder: "For example: feeling better, schedule clash…", required: true }}
      onConfirm={async (reason) => {
        await update.mutateAsync({ id: appointment.id, status: "CANCELLED", reason, version: appointment.version });
        toast.success("Appointment cancelled", { description: "The hospital has been notified." });
      }}
    />
  );
}

/** Patient-facing appointment card with cancel / reschedule actions when allowed. */
export function AppointmentCard({ appointment: a, showActions = true }: { appointment: Appointment; showActions?: boolean }) {
  const copy = APPOINTMENT_STATUS_COPY[a.status];
  const changeable = showActions && isChangeable(a);
  const upcoming = daysUntil(a.date) >= 0 && (a.status === "PENDING" || a.status === "CONFIRMED");

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        <div
          className={cn(
            "flex w-full shrink-0 items-center gap-3 rounded-lg border px-3 py-2 sm:w-20 sm:flex-col sm:gap-0 sm:py-3 sm:text-center",
            upcoming ? "border-primary/30 bg-primary/5" : "bg-muted/40",
          )}
        >
          <span className="text-muted-foreground text-xs font-medium uppercase">
            {new Date(`${a.date}T00:00:00`).toLocaleDateString("en-IN", { month: "short" })}
          </span>
          <span className="font-heading text-2xl font-semibold tabular-nums">{new Date(`${a.date}T00:00:00`).getDate()}</span>
          <span className="text-muted-foreground text-xs">
            {new Date(`${a.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" })}
          </span>
          {upcoming && (
            <span className="text-primary ml-auto text-sm font-medium sm:mt-1 sm:ml-0 sm:text-xs">{countdownLabel(a.date)}</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-semibold">{a.doctorName}</p>
              <p className="text-muted-foreground flex items-center gap-1.5 text-base md:text-sm">
                <Stethoscope className="size-4 shrink-0" aria-hidden />
                {a.departmentName}
              </p>
            </div>
            <StatusBadge status={a.status} label={copy.label} />
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base md:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="text-muted-foreground size-4" aria-hidden />
              {longDay(a.date)}, {formatTime(a.startTime)} – {formatTime(a.endTime)}
            </span>
            <span className="text-muted-foreground">{humanize(a.type)}</span>
          </p>
          {a.reason && (
            <p className="text-muted-foreground text-base md:text-sm">
              <span className="text-foreground font-medium">Reason: </span>
              {a.reason}
            </p>
          )}
          {a.status === "CANCELLED" && a.cancelledReason && (
            <p className="text-muted-foreground text-base md:text-sm">
              <span className="text-foreground font-medium">Cancelled: </span>
              {a.cancelledReason}
            </p>
          )}
          {upcoming && <p className="text-muted-foreground text-sm">{copy.help}</p>}
        </div>
      </div>

      {changeable && (
        <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end">
          <CancelAppointmentDialog
            appointment={a}
            trigger={
              <Button variant="ghost" size="lg" className="text-destructive hover:text-destructive">
                <CalendarX2 /> Cancel
              </Button>
            }
          />
          <RescheduleDialog
            appointment={a}
            trigger={
              <Button variant="outline" size="lg">
                <CalendarClock /> Reschedule
              </Button>
            }
          />
        </div>
      )}
    </Card>
  );
}
