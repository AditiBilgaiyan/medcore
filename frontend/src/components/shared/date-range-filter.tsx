"use client";

import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: string;
  to: string;
}

export function lastNDays(n: number): DateRange {
  const today = new Date();
  return { from: format(subDays(today, n - 1), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
}

const PRESETS = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex rounded-lg border p-0.5" role="group" aria-label="Quick ranges">
        {PRESETS.map((p) => {
          const r = lastNDays(p.days);
          const active = r.from === value.from && r.to === value.to;
          return (
            <Button key={p.label} size="xs" variant={active ? "secondary" : "ghost"} aria-pressed={active} onClick={() => onChange(r)}>
              {p.label}
            </Button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="From date"
          className="h-8 w-36"
          value={value.from}
          max={value.to}
          onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
        />
        <span className="text-muted-foreground text-xs">to</span>
        <Input
          type="date"
          aria-label="To date"
          className="h-8 w-36"
          value={value.to}
          min={value.from}
          onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
        />
      </div>
    </div>
  );
}
