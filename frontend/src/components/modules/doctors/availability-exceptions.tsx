"use client";

import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DatePickerStrip } from "@/components/modules/appointments/date-picker-strip";
import { SlotGrid } from "@/components/modules/appointments/slot-grid";
import { friendlyDate, todayISO } from "@/components/modules/appointments/utils";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/constants/routes";
import { formatDate } from "@/lib/format";
import { useAddAvailabilityException, useAvailability, useRemoveAvailabilityException, useSlots } from "@/services/doctors";
import type { AvailabilityException } from "@/types";

/** Upcoming leave / blocked days, with add + remove. */
export function AvailabilityExceptions({ doctorId, exceptions }: { doctorId: string; exceptions: AvailabilityException[] }) {
  const router = useRouter();
  const add = useAddAvailabilityException(doctorId);
  const remove = useRemoveAvailabilityException(doctorId);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [removing, setRemoving] = useState<AvailabilityException | null>(null);

  const today = todayISO();
  const dateError = !date
    ? "Choose a date."
    : date < today
      ? "Choose today or a later date."
      : exceptions.some((x) => x.date === date)
        ? "This day is already blocked."
        : null;
  const reasonError = reason.trim().length < 3 ? "Give a short reason (e.g. Conference)." : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (dateError || reasonError) return;
    try {
      const res = await add.mutateAsync({ date, reason: reason.trim() });
      toast.success(`${formatDate(date, "EEE, dd MMM")} blocked`);
      if (res.affectedAppointments > 0) {
        const blocked = date;
        toast.warning(
          `${res.affectedAppointments} booked appointment${res.affectedAppointments > 1 ? "s" : ""} on this day need rescheduling`,
          {
            duration: 10_000,
            action: {
              label: "View",
              onClick: () => router.push(`${ROUTES.appointments}?date=${blocked}&doctorId=${doctorId}`),
            },
          },
        );
      }
      setDate("");
      setReason("");
      setAttempted(false);
    } catch {
      // Toasted globally.
    }
  };

  return (
    <div className="space-y-4">
      {exceptions.length === 0 ? (
        <EmptyState icon={CalendarOff} title="No upcoming leave" description="Block a day when the doctor is away." compact />
      ) : (
        <ul className="divide-y rounded-lg border">
          {exceptions.map((x) => (
            <li key={x.id} className="flex items-center gap-3 px-3 py-2">
              <CalendarOff className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium tabular-nums">
                  {formatDate(x.date, "EEE, dd MMM yyyy")}{" "}
                  <span className="text-muted-foreground font-normal">· {friendlyDate(x.date)}</span>
                </p>
                <p className="text-muted-foreground truncate">{x.reason}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Unblock ${formatDate(x.date)}`}
                onClick={() => setRemoving(x)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} noValidate className="bg-muted/20 space-y-3 rounded-lg border p-3">
        <p className="text-sm font-medium">Block a day</p>
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <Field data-invalid={(attempted && !!dateError) || undefined}>
            <FieldLabel htmlFor="exc-date">Date</FieldLabel>
            <Input
              id="exc-date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={(attempted && !!dateError) || undefined}
              className="tabular-nums"
            />
            <FieldError errors={attempted && dateError ? [{ message: dateError }] : []} />
          </Field>
          <Field data-invalid={(attempted && !!reasonError) || undefined}>
            <FieldLabel htmlFor="exc-reason">Reason</FieldLabel>
            <Input
              id="exc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Annual leave"
              maxLength={200}
              aria-invalid={(attempted && !!reasonError) || undefined}
            />
            <FieldError errors={attempted && reasonError ? [{ message: reasonError }] : []} />
          </Field>
        </div>
        <Button type="submit" variant="outline" disabled={add.isPending}>
          {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Block day
        </Button>
      </form>

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Unblock this day?"
        description={
          removing ? `${formatDate(removing.date, "EEEE, dd MMM yyyy")} (${removing.reason}) will open for booking again.` : undefined
        }
        confirmLabel="Unblock"
        onConfirm={async () => {
          if (!removing) return;
          await remove.mutateAsync(removing.id);
          toast.success("Day unblocked");
        }}
      />
    </div>
  );
}

/** Pick a date and see the bookable slots the saved schedule produces. */
export function AvailabilityPreview({ doctorId }: { doctorId: string }) {
  const [date, setDate] = useState(todayISO());
  const availability = useAvailability(doctorId);
  const slots = useSlots(doctorId, date);
  return (
    <div className="space-y-4">
      <DatePickerStrip
        value={date}
        onChange={setDate}
        rules={availability.data?.rules}
        exceptions={availability.data?.exceptions}
        quickDays={7}
        label="Preview date"
      />
      <SlotGrid
        readOnly
        label={`Slots on ${friendlyDate(date)}`}
        slots={slots.data}
        isLoading={slots.isLoading}
        error={slots.error}
        onRetry={() => void slots.refetch()}
        gridClassName="grid-cols-3 sm:grid-cols-4 md:grid-cols-4"
        emptyTitle={availability.data?.exceptions.some((x) => x.date === date) ? "Blocked day" : "Not working"}
        emptyDescription={availability.data?.exceptions.find((x) => x.date === date)?.reason ?? "No schedule on this day of the week."}
      />
      <p className="text-muted-foreground text-xs">Preview reflects the saved schedule and current bookings.</p>
    </div>
  );
}
