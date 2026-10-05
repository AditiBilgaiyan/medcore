"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MoreHorizontal, Stethoscope, UserX, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";
import { formatTime } from "@/lib/format";
import { useUpdateAppointmentStatus } from "@/services/appointments";
import { qk } from "@/services/query-keys";
import type { Appointment, AppointmentStatus, CurrentUser } from "@/types";
import { isDeskRole } from "./utils";

export interface AvailableActions {
  confirm: boolean;
  cancel: boolean;
  noShow: boolean;
  /** Label for the treating doctor's encounter link, if any. */
  encounter: "Start encounter" | "Continue encounter" | "View encounter" | null;
  reschedule: boolean;
}

export function getAppointmentActions(appt: Appointment, user: CurrentUser | null | undefined): AvailableActions {
  const desk = isDeskRole(user?.role);
  const treating = user?.role === "DOCTOR" && !!user.doctorId && user.doctorId === appt.doctorId;
  const upcoming = appt.status === "PENDING" || appt.status === "CONFIRMED";
  return {
    confirm: desk && appt.status === "PENDING",
    cancel: desk && upcoming,
    noShow: desk && appt.status === "CONFIRMED",
    encounter: !treating
      ? null
      : appt.status === "CONFIRMED"
        ? "Start encounter"
        : appt.status === "IN_PROGRESS"
          ? "Continue encounter"
          : appt.status === "COMPLETED"
            ? "View encounter"
            : null,
    reschedule: desk && upcoming,
  };
}

export function hasAnyAction(a: AvailableActions) {
  return a.confirm || a.cancel || a.noShow || !!a.encounter;
}

const SUCCESS: Partial<Record<AppointmentStatus, string>> = {
  CONFIRMED: "Appointment confirmed",
  CANCELLED: "Appointment cancelled",
  NO_SHOW: "Marked as no-show",
};

/** Status transitions with optimistic-concurrency handling (VERSION_CONFLICT → refetch). */
export function useAppointmentStatusChange() {
  const mutation = useUpdateAppointmentStatus();
  const qc = useQueryClient();
  const change = async (appt: Appointment, status: AppointmentStatus, reason?: string) => {
    try {
      await mutation.mutateAsync({ id: appt.id, status, version: appt.version, reason: reason || undefined });
      toast.success(SUCCESS[status] ?? "Appointment updated", { description: `${appt.patientName} · ${formatTime(appt.startTime)}` });
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        // The global handler already toasted the conflict; pull the latest state and close any dialog.
        await qc.invalidateQueries({ queryKey: qk.appointments.all });
        return;
      }
      throw err;
    }
  };
  return { change, isPending: mutation.isPending, pendingStatus: mutation.isPending ? mutation.variables?.status : undefined };
}

interface AppointmentActionsProps {
  appt: Appointment;
  variant?: "buttons" | "menu";
}

/** Row / page actions for an appointment, filtered by role and state. */
export function AppointmentActions({ appt, variant = "buttons" }: AppointmentActionsProps) {
  const { user } = useAuth();
  const actions = getAppointmentActions(appt, user);
  const { change, pendingStatus, isPending } = useAppointmentStatusChange();
  const [dialog, setDialog] = useState<"cancel" | "noShow" | null>(null);

  if (!hasAnyAction(actions)) return null;

  const dialogs = (
    <>
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(o) => setDialog(o ? "cancel" : null)}
        title="Cancel this appointment?"
        description={`${appt.patientName} with ${appt.doctorName} at ${formatTime(appt.startTime)}. The patient will be notified.`}
        confirmLabel="Cancel appointment"
        destructive
        reason={{ label: "Reason for cancelling", placeholder: "e.g. Patient called to cancel", required: true }}
        onConfirm={(reason) => change(appt, "CANCELLED", reason)}
      />
      <ConfirmDialog
        open={dialog === "noShow"}
        onOpenChange={(o) => setDialog(o ? "noShow" : null)}
        title="Mark as no-show?"
        description={`${appt.patientName} didn't arrive for the ${formatTime(appt.startTime)} appointment. This can't be undone.`}
        confirmLabel="Mark no-show"
        destructive
        onConfirm={() => change(appt, "NO_SHOW")}
      />
    </>
  );

  if (variant === "menu") {
    return (
      // Keep clicks (including from portalled dialogs) from activating the clickable table row.
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${appt.patientName} at ${formatTime(appt.startTime)}`}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-muted-foreground text-xs">{appt.patientName}</DropdownMenuLabel>
            {actions.encounter && (
              <DropdownMenuItem asChild>
                <Link href={ROUTES.encounter(appt.id)}>
                  <Stethoscope /> {actions.encounter}
                </Link>
              </DropdownMenuItem>
            )}
            {actions.confirm && (
              <DropdownMenuItem onSelect={() => void change(appt, "CONFIRMED").catch(() => undefined)}>
                <CheckCircle2 /> Confirm
              </DropdownMenuItem>
            )}
            {(actions.noShow || actions.cancel) && (actions.confirm || actions.encounter) && <DropdownMenuSeparator />}
            {actions.noShow && (
              <DropdownMenuItem onSelect={() => setDialog("noShow")}>
                <UserX /> Mark no-show
              </DropdownMenuItem>
            )}
            {actions.cancel && (
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
                <XCircle /> Cancel appointment
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {dialogs}
      </div>
    );
  }

  return (
    <>
      {actions.encounter && (
        <Button asChild>
          <Link href={ROUTES.encounter(appt.id)}>
            <Stethoscope /> {actions.encounter}
          </Link>
        </Button>
      )}
      {actions.confirm && (
        <Button onClick={() => void change(appt, "CONFIRMED").catch(() => undefined)} disabled={isPending}>
          {pendingStatus === "CONFIRMED" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Confirm
        </Button>
      )}
      {actions.noShow && (
        <Button variant="outline" onClick={() => setDialog("noShow")} disabled={isPending}>
          <UserX /> No-show
        </Button>
      )}
      {actions.cancel && (
        <Button variant="destructive" onClick={() => setDialog("cancel")} disabled={isPending}>
          <XCircle /> Cancel
        </Button>
      )}
      {dialogs}
    </>
  );
}
