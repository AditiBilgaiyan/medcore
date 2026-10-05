import { Check, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LabOrder } from "@/types";

interface Step {
  key: string;
  label: string;
  caption?: string;
  state: "done" | "current" | "upcoming" | "error";
}

function buildSteps(o: LabOrder): Step[] {
  const order = ["ORDERED", "SAMPLE_COLLECTED", "PROCESSING", "PENDING_APPROVAL", "APPROVED"] as const;
  // A rejected order goes back to the bench: processing is current again, review shows the rejection.
  const effective = o.status === "REJECTED" ? "PROCESSING" : o.status === "CANCELLED" ? undefined : o.status;
  const currentIndex = effective ? order.indexOf(effective) : -1;
  const stateAt = (i: number): Step["state"] => {
    if (o.status === "APPROVED") return "done";
    if (currentIndex < 0) return i === 0 || (i === 1 && o.collectedAt) ? "done" : "upcoming";
    return i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
  };
  return [
    { key: "ordered", label: "Ordered", caption: formatDateTime(o.createdAt), state: stateAt(0) },
    {
      key: "collected",
      label: "Sample collected",
      caption: o.collectedAt ? `${formatDateTime(o.collectedAt)}${o.collectedByName ? ` · ${o.collectedByName}` : ""}` : undefined,
      state: stateAt(1),
    },
    {
      key: "processing",
      label: o.status === "REJECTED" ? "Re-processing" : "Processing",
      caption: o.processedByName && o.status !== "PROCESSING" ? `Results by ${o.processedByName}` : undefined,
      state: stateAt(2),
    },
    o.status === "REJECTED"
      ? { key: "review", label: "Rejected", caption: o.rejectionReason, state: "error" }
      : { key: "review", label: "Awaiting approval", state: stateAt(3) },
    {
      key: "approved",
      label: "Approved",
      caption: o.approvedAt ? `${formatDateTime(o.approvedAt)}${o.approvedByName ? ` · ${o.approvedByName}` : ""}` : undefined,
      state: stateAt(4),
    },
  ];
}

export function LabWorkflowStepper({ order, className }: { order: LabOrder; className?: string }) {
  const steps = buildSteps(order);
  return (
    <ol aria-label="Order progress" className={cn("grid gap-3 sm:grid-cols-5 sm:gap-2", className)}>
      {steps.map((s, i) => (
        <li key={s.key} aria-current={s.state === "current" ? "step" : undefined} className="relative flex gap-3 sm:flex-col sm:gap-2">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "absolute top-7 bottom-[-0.75rem] left-3 w-px sm:top-3 sm:right-[-0.5rem] sm:bottom-auto sm:left-8 sm:h-px sm:w-auto",
                s.state === "done" ? "bg-primary" : "bg-border",
              )}
            />
          )}
          <span
            aria-hidden
            className={cn(
              "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
              s.state === "done" && "border-primary bg-primary text-primary-foreground",
              s.state === "current" && "border-primary bg-background text-primary ring-primary/20 ring-3",
              s.state === "upcoming" && "border-border bg-background text-muted-foreground",
              s.state === "error" && "border-destructive bg-destructive text-white",
            )}
          >
            {s.state === "done" ? <Check className="size-3.5" /> : s.state === "error" ? <X className="size-3.5" /> : i + 1}
          </span>
          <div className="min-w-0 pb-1">
            <p
              className={cn(
                "text-sm font-medium",
                s.state === "upcoming" && "text-muted-foreground",
                s.state === "error" && "text-destructive",
              )}
            >
              {s.label}
              <span className="sr-only">
                {" "}
                (
                {s.state === "done"
                  ? "completed"
                  : s.state === "current"
                    ? "current step"
                    : s.state === "error"
                      ? "rejected"
                      : "not started"}
                )
              </span>
            </p>
            {s.caption && (
              <p className={cn("text-muted-foreground text-xs break-words", s.state === "error" && "text-destructive/90")}>{s.caption}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
