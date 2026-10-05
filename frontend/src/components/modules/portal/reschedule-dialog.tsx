"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api/client";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRescheduleAppointment } from "@/services/appointments";
import { useSlots } from "@/services/doctors";
import { qk } from "@/services/query-keys";
import type { Appointment } from "@/types";
import { addDaysIso, longDay } from "./portal-utils";

const DAYS_AHEAD = 30;

type InlineError = { code: string; message: string };

export function RescheduleDialog({ appointment, trigger }: { appointment: Appointment; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDaysIso(i));
  const [date, setDate] = useState<string>(appointment.date >= days[0] ? appointment.date : days[0]);
  const [time, setTime] = useState<string | null>(null);
  const [error, setError] = useState<InlineError | null>(null);
  const slots = useSlots(open ? appointment.doctorId : undefined, date);
  const reschedule = useRescheduleAppointment();
  const qc = useQueryClient();

  const reset = () => {
    setDate(appointment.date >= days[0] ? appointment.date : days[0]);
    setTime(null);
    setError(null);
  };

  const isCurrent = (d: string, t: string) => d === appointment.date && t === appointment.startTime;

  const submit = async () => {
    if (!time) return;
    setError(null);
    try {
      await reschedule.mutateAsync({ id: appointment.id, date, startTime: time, version: appointment.version });
      toast.success("Change requested", {
        description: `${longDay(date)} at ${formatTime(time)} — awaiting confirmation from the hospital.`,
      });
      setOpen(false);
      reset();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "UNKNOWN";
      if (code === "SLOT_UNAVAILABLE") {
        setTime(null);
        void slots.refetch();
        setError({ code, message: "Someone just booked that time. Please pick another available time." });
      } else if (code === "VERSION_CONFLICT") {
        setError({
          code,
          message:
            "This appointment was updated by the hospital while you were choosing. Reload it to see the latest details, then try again.",
        });
      } else if (code === "PATIENT_CONFLICT") {
        setError({ code, message: "You already have another appointment at that time. Please choose a different time." });
      } else {
        setError({ code, message: errorMessage(err) });
      }
    }
  };

  const reloadAppointment = async () => {
    await qc.invalidateQueries({ queryKey: qk.appointments.all });
    setOpen(false);
    reset();
  };

  const available = slots.data?.filter((s) => s.available && !isCurrent(date, s.startTime)) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change appointment time</DialogTitle>
          <DialogDescription>
            With {appointment.doctorName} · {appointment.departmentName}. Currently {longDay(appointment.date)} at{" "}
            {formatTime(appointment.startTime)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p id="rs-date-label" className="text-sm font-medium">
            1. Choose a day
          </p>
          <div role="radiogroup" aria-labelledby="rs-date-label" className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => {
              const selected = d === date;
              const dt = new Date(`${d}T00:00:00`);
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={longDay(d)}
                  onClick={() => {
                    setDate(d);
                    setTime(null);
                    setError(null);
                  }}
                  className={cn(
                    "focus-visible:outline-ring flex w-14 shrink-0 cursor-pointer snap-start flex-col items-center rounded-lg border px-1 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                    selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className={cn("text-xs", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {dt.toLocaleDateString("en-IN", { weekday: "short" })}
                  </span>
                  <span className="text-base font-semibold tabular-nums">{dt.getDate()}</span>
                  <span className={cn("text-xs", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {dt.toLocaleDateString("en-IN", { month: "short" })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p id="rs-time-label" className="text-sm font-medium">
            2. Choose a time on {longDay(date)}
          </p>
          {slots.isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : slots.error ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span>{errorMessage(slots.error)}</span>
              <Button variant="outline" size="sm" onClick={() => slots.refetch()}>
                <RefreshCw /> Retry
              </Button>
            </div>
          ) : available.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
              No free times on this day. Please try another day.
            </p>
          ) : (
            <div role="radiogroup" aria-labelledby="rs-time-label" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {available.map((s) => {
                const selected = s.startTime === time;
                return (
                  <button
                    key={s.startTime}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setTime(s.startTime);
                      setError(null);
                    }}
                    className={cn(
                      "focus-visible:outline-ring h-10 cursor-pointer rounded-lg border text-sm font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                      selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {formatTime(s.startTime)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle aria-hidden />
            <AlertTitle>Couldn&apos;t change the time</AlertTitle>
            <AlertDescription>
              <p>{error.message}</p>
              {error.code === "VERSION_CONFLICT" && (
                <Button variant="outline" size="sm" className="mt-2" onClick={reloadAppointment}>
                  <RefreshCw /> Reload appointment
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-muted-foreground flex gap-2 text-sm">
          <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Your new time will be sent to the hospital for confirmation. Until then it shows as &ldquo;Awaiting confirmation&rdquo;.
        </p>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setOpen(false)} disabled={reschedule.isPending}>
            Keep current time
          </Button>
          <Button size="lg" onClick={submit} disabled={!time || reschedule.isPending}>
            {reschedule.isPending && <Loader2 className="animate-spin" />}
            {time ? `Request ${formatTime(time)}` : "Request new time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
