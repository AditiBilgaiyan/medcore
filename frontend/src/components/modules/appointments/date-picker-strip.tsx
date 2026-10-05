"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AvailabilityException, AvailabilityRule } from "@/types";
import { BOOKING_WINDOW_DAYS, shiftISODate, todayISO, toISODate, worksOn } from "./utils";

interface DatePickerStripProps {
  value: string | undefined;
  onChange: (date: string) => void;
  /** Doctor's weekly schedule — used to mark days off. */
  rules?: AvailabilityRule[];
  exceptions?: AvailabilityException[];
  /** Number of selectable days from today (inclusive). */
  windowDays?: number;
  quickDays?: number;
  label?: string;
  className?: string;
}

/** Quick chips for the next few days plus a calendar for the rest of the booking window. */
export function DatePickerStrip({
  value,
  onChange,
  rules,
  exceptions,
  windowDays = BOOKING_WINDOW_DAYS,
  quickDays = 7,
  label = "Date",
  className,
}: DatePickerStripProps) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const today = todayISO();
  const last = shiftISODate(today, windowDays - 1);
  const quick = Array.from({ length: quickDays }, (_, i) => shiftISODate(today, i));
  const extra = value && !quick.includes(value) ? value : undefined;
  const chips = extra ? [...quick, extra] : quick;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" id={labelId}>
          {label}
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <CalendarDays aria-hidden /> More dates
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={value ? parseISO(value) : undefined}
              defaultMonth={value ? parseISO(value) : parseISO(today)}
              startMonth={parseISO(today)}
              endMonth={parseISO(last)}
              disabled={[{ before: parseISO(today) }, { after: parseISO(last) }]}
              modifiers={rules ? { off: (d: Date) => worksOn(toISODate(d), rules, exceptions) === false } : undefined}
              modifiersClassNames={{ off: "text-muted-foreground/70 line-through" }}
              onSelect={(d: Date | undefined) => {
                if (!d) return;
                onChange(toISODate(d));
                setOpen(false);
              }}
            />
            {rules && <p className="text-muted-foreground border-t px-3 py-2 text-xs">Struck-through days: doctor not available.</p>}
          </PopoverContent>
        </Popover>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1" aria-labelledby={labelId}>
        {chips.map((d, i) => {
          const selected = d === value;
          const works = worksOn(d, rules, exceptions);
          const date = parseISO(d);
          return (
            <li key={d} className="shrink-0">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${format(date, "EEEE, d MMMM")}${works === false ? ", doctor not available" : ""}`}
                onClick={() => onChange(d)}
                className={cn(
                  "flex h-16 w-15 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs transition-colors outline-none",
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "bg-background hover:border-primary/60 hover:bg-accent",
                  works === false && !selected && "text-muted-foreground border-dashed",
                )}
              >
                <span className="font-medium">{i === 0 && d === today ? "Today" : format(date, "EEE")}</span>
                <span className="text-base leading-none font-semibold tabular-nums">{format(date, "d")}</span>
                <span className={cn("text-[0.65rem]", !selected && "text-muted-foreground")}>
                  {works === false ? "Off" : format(date, "MMM")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
