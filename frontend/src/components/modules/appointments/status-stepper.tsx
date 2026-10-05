import { Ban, Check, UserX } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Appointment, AppointmentStatus } from "@/types";
import { STATUS_LABEL } from "./utils";

const FLOW: AppointmentStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];

/** Lifecycle: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED, or a terminal CANCELLED / NO_SHOW. */
export function StatusStepper({ appt }: { appt: Appointment }) {
  const terminal = appt.status === "CANCELLED" || appt.status === "NO_SHOW";
  // Staff bookings skip PENDING; terminal states stop where the appointment was (best effort: after the last reachable step).
  const currentIdx = terminal ? -1 : FLOW.indexOf(appt.status);
  const reachedIdx = terminal ? (appt.status === "NO_SHOW" ? 1 : 0) : currentIdx;

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-2 gap-3 sm:flex sm:items-start sm:gap-0" aria-label="Appointment lifecycle">
        {FLOW.map((s, i) => {
          const done = i < currentIdx || (terminal && i <= reachedIdx) || (appt.status === "COMPLETED" && i === currentIdx);
          const current = !terminal && i === currentIdx && appt.status !== "COMPLETED";
          return (
            <li
              key={s}
              className="flex items-center gap-2 sm:flex-1 sm:flex-col sm:items-stretch sm:gap-2"
              aria-current={current ? "step" : undefined}
            >
              <div className="flex items-center sm:w-full">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums",
                    done && "border-primary bg-primary text-primary-foreground",
                    current && "border-primary bg-background text-primary ring-primary/20 ring-3",
                    !done && !current && "border-border bg-background text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                {i < FLOW.length - 1 && (
                  <span
                    className={cn(
                      "mx-2 hidden h-0.5 flex-1 rounded sm:block",
                      i < currentIdx || (terminal && i < reachedIdx) ? "bg-primary" : "bg-border",
                    )}
                    aria-hidden
                  />
                )}
              </div>
              <span className={cn("text-xs sm:text-sm", current ? "font-semibold" : done ? "font-medium" : "text-muted-foreground")}>
                {STATUS_LABEL[s]}
                <span className="sr-only">{done ? " (done)" : current ? " (current)" : " (not reached)"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {terminal && (
        <div
          role="note"
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
            appt.status === "NO_SHOW" ? "border-destructive/30 bg-destructive/5" : "bg-muted/50",
          )}
        >
          {appt.status === "NO_SHOW" ? (
            <UserX className="text-destructive mt-0.5 size-4" aria-hidden />
          ) : (
            <Ban className="text-muted-foreground mt-0.5 size-4" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="font-medium">
              {STATUS_LABEL[appt.status]} <span className="text-muted-foreground font-normal">· {formatDateTime(appt.updatedAt)}</span>
            </p>
            {appt.status === "CANCELLED" && <p className="text-muted-foreground">Reason: {appt.cancelledReason || "Not recorded"}</p>}
            {appt.status === "NO_SHOW" && <p className="text-muted-foreground">The patient didn&apos;t arrive for this appointment.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
