"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ApiError, errorMessage } from "@/lib/api/client";
import { formatDate, formatTime } from "@/lib/format";
import { useRescheduleAppointment } from "@/services/appointments";
import { useAvailability, useSlots } from "@/services/doctors";
import { qk } from "@/services/query-keys";
import type { Appointment } from "@/types";
import { DatePickerStrip } from "./date-picker-strip";
import { SlotGrid } from "./slot-grid";
import { friendlyDate, todayISO } from "./utils";

export function RescheduleDialog({ appt, trigger }: { appt: Appointment; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <CalendarClock /> Reschedule
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        {open && <RescheduleForm appt={appt} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RescheduleForm({ appt, onDone }: { appt: Appointment; onDone: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(appt.date >= todayISO() ? appt.date : todayISO());
  const [startTime, setStartTime] = useState<string>();
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const availability = useAvailability(appt.doctorId);
  const slots = useSlots(appt.doctorId, date);
  const mutation = useRescheduleAppointment();

  const submit = async () => {
    if (!startTime) return;
    setError(null);
    try {
      await mutation.mutateAsync({ id: appt.id, date, startTime, version: appt.version });
      toast.success("Appointment rescheduled", { description: `${formatDate(date)} at ${formatTime(startTime)}` });
      onDone();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "SLOT_UNAVAILABLE") {
        setStartTime(undefined);
        void slots.refetch();
        setError({ title: "That slot was just taken", message: "This slot was just booked by another patient. Pick another time." });
      } else if (code === "VERSION_CONFLICT") {
        await qc.invalidateQueries({ queryKey: qk.appointments.detail(appt.id) });
        setError({
          title: "Appointment changed",
          message: "Someone else updated this appointment. We've loaded the latest version — review and try again.",
        });
      } else if (code === "PATIENT_CONFLICT") {
        setError({ title: "Patient is busy then", message: errorMessage(err) });
      } else {
        setError({ title: "Couldn't reschedule", message: errorMessage(err) });
      }
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reschedule appointment</DialogTitle>
        <DialogDescription>
          {appt.patientName} with {appt.doctorName}. Currently{" "}
          <span className="text-foreground font-medium tabular-nums">
            {formatDate(appt.date)}, {formatTime(appt.startTime)}
          </span>
          .
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <DatePickerStrip
          value={date}
          onChange={(d) => {
            setDate(d);
            setStartTime(undefined);
            setError(null);
          }}
          rules={availability.data?.rules}
          exceptions={availability.data?.exceptions}
          label="New date"
        />
        <SlotGrid
          label={`Available times on ${friendlyDate(date)}`}
          slots={slots.data}
          isLoading={slots.isLoading}
          error={slots.error}
          onRetry={() => void slots.refetch()}
          value={startTime}
          onChange={(t) => {
            setStartTime(t);
            setError(null);
          }}
          gridClassName="sm:grid-cols-5"
        />
        <div aria-live="polite">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle aria-hidden />
              <AlertTitle>{error.title}</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={mutation.isPending}>
          Close
        </Button>
        <Button onClick={submit} disabled={!startTime || mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          {startTime ? `Move to ${friendlyDate(date)}, ${formatTime(startTime)}` : "Choose a time"}
        </Button>
      </DialogFooter>
    </>
  );
}
