"use client";

import { CalendarOff, Check, Moon, Sun, Sunrise } from "lucide-react";
import { useMemo, useRef } from "react";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TimeSlot } from "@/types";
import { groupSlots, type DayPart } from "./utils";

const PART_ICON: Record<DayPart, typeof Sun> = { Morning: Sunrise, Afternoon: Sun, Evening: Moon };

interface SlotGridProps {
  slots: TimeSlot[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Selected start time */
  value?: string;
  onChange?: (startTime: string) => void;
  /** Display only (availability preview) */
  readOnly?: boolean;
  /** Accessible name for the group, e.g. "Available times on Tue, 06 Oct" */
  label: string;
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  className?: string;
  gridClassName?: string;
}

/**
 * Time-slot picker grouped Morning / Afternoon / Evening.
 * One tab stop; arrow keys / Home / End move between available slots (roving tabindex).
 */
export function SlotGrid({
  slots,
  isLoading,
  error,
  onRetry,
  value,
  onChange,
  readOnly,
  label,
  emptyTitle = "No slots on this day",
  emptyDescription = "The doctor doesn't see patients on this day. Pick another date.",
  className,
  gridClassName,
}: SlotGridProps) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const groups = useMemo(() => groupSlots(slots ?? []), [slots]);
  const available = useMemo(() => (slots ?? []).filter((s) => s.available), [slots]);
  const tabStop = value && available.some((s) => s.startTime === value) ? value : available[0]?.startTime;

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading time slots">
        <Skeleton className="h-4 w-24" />
        <div className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6", gridClassName)}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      </div>
    );
  }
  if (error && !slots) return <ErrorState error={error} onRetry={onRetry} className="py-8" />;
  if (!slots?.length)
    return <EmptyState icon={CalendarOff} title={emptyTitle} description={emptyDescription} compact className={className} />;

  const move = (from: string, delta: number | "first" | "last") => {
    const idx = available.findIndex((s) => s.startTime === from);
    let next: number;
    if (delta === "first") next = 0;
    else if (delta === "last") next = available.length - 1;
    else next = Math.min(Math.max(idx + delta, 0), available.length - 1);
    const target = available[next];
    if (target) refs.current.get(target.startTime)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, start: string) => {
    const keys: Record<string, number | "first" | "last"> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
      Home: "first",
      End: "last",
    };
    const delta = keys[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    move(start, delta);
  };

  return (
    <div className={cn("space-y-4", className)} role="group" aria-label={label}>
      <p className="text-muted-foreground text-xs tabular-nums">
        {available.length} of {slots.length} slots available
        {!readOnly && available.length > 0 && <span className="sr-only">. Use arrow keys to move between available times.</span>}
      </p>
      {groups.map(({ part, slots: partSlots }) => {
        const Icon = PART_ICON[part];
        const free = partSlots.filter((s) => s.available).length;
        return (
          <section key={part} aria-label={part} className="space-y-2">
            <h4 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
              <Icon className="size-3.5" aria-hidden />
              {part}
              <span className="font-normal tracking-normal normal-case tabular-nums">· {free} open</span>
            </h4>
            <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6", gridClassName)}>
              {partSlots.map((s) => {
                const selected = s.startTime === value;
                if (readOnly) {
                  return (
                    <li
                      key={s.startTime}
                      className={cn(
                        "flex min-h-9 items-center justify-center rounded-md border px-2 text-sm tabular-nums",
                        s.available ? "bg-background" : "bg-muted text-muted-foreground line-through",
                      )}
                    >
                      {formatTime(s.startTime)}
                      {!s.available && <span className="sr-only"> (booked)</span>}
                    </li>
                  );
                }
                return (
                  <li key={s.startTime}>
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) refs.current.set(s.startTime, el);
                        else refs.current.delete(s.startTime);
                      }}
                      tabIndex={s.available && s.startTime === tabStop ? 0 : -1}
                      aria-pressed={selected}
                      aria-disabled={!s.available || undefined}
                      aria-label={`${formatTime(s.startTime)} to ${formatTime(s.endTime)}${s.available ? "" : ", unavailable"}`}
                      onClick={() => s.available && onChange?.(s.startTime)}
                      onKeyDown={(e) => onKeyDown(e, s.startTime)}
                      className={cn(
                        "flex min-h-9 w-full items-center justify-center gap-1 rounded-md border px-2 text-sm font-medium tabular-nums transition-colors outline-none",
                        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
                        s.available && !selected && "bg-background hover:border-primary/60 hover:bg-accent",
                        selected && "border-primary bg-primary text-primary-foreground shadow-sm",
                        !s.available && "bg-muted/60 text-muted-foreground cursor-not-allowed border-dashed font-normal line-through",
                      )}
                    >
                      {selected && <Check className="size-3.5" aria-hidden />}
                      {formatTime(s.startTime)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
