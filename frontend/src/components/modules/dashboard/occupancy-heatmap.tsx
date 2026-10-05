"use client";

import { Grid3x3 } from "lucide-react";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import type { HospitalOverview } from "@/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

/**
 * Department × weekday occupancy as an accessible HTML table. Cell shading
 * scales with occupancy; the percentage is always printed as text so colour
 * is never the only signal.
 */
export function OccupancyHeatmap({
  data,
  isLoading,
  error,
  onRetry,
  className,
}: {
  data: HospitalOverview["departmentOccupancy"] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { departments, lookup } = useMemo(() => {
    const lookup = new Map<string, number>();
    const departments: string[] = [];
    for (const d of data ?? []) {
      if (!departments.includes(d.department)) departments.push(d.department);
      lookup.set(`${d.department}|${d.day}`, d.value);
    }
    return { departments, lookup };
  }, [data]);

  return (
    <SectionCard
      className={className}
      title="Department occupancy"
      description="Share of bookable slots filled, by weekday (last 4 weeks)."
    >
      {isLoading ? (
        <Skeleton className="h-56 w-full" aria-label="Loading occupancy" />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={onRetry} className="py-6" />
      ) : departments.length === 0 ? (
        <EmptyState compact icon={Grid3x3} title="No departments yet" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-separate border-spacing-1 text-xs">
              <caption className="sr-only">Department occupancy by weekday, as a percentage of bookable slots</caption>
              <thead>
                <tr>
                  <th scope="col" className="text-muted-foreground w-36 text-left font-medium">
                    Department
                  </th>
                  {DAYS.map((d) => (
                    <th key={d} scope="col" className="text-muted-foreground text-center font-medium">
                      <abbr title={DAY_NAMES[d]} className="no-underline">
                        {d}
                      </abbr>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept}>
                    <th scope="row" className="max-w-36 truncate pr-2 text-left font-medium" title={dept}>
                      {dept}
                    </th>
                    {DAYS.map((day) => {
                      const v = lookup.get(`${dept}|${day}`) ?? 0;
                      const pct = Math.round(v * 100);
                      return (
                        <td
                          key={day}
                          className="border-border/60 h-9 rounded-md border text-center"
                          style={{ backgroundColor: `color-mix(in oklch, var(--chart-1) ${pct}%, transparent)` }}
                        >
                          <span className="bg-background/85 rounded px-1 py-0.5 font-medium tabular-nums">
                            {pct}%<span className="sr-only"> on {DAY_NAMES[day]}</span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-muted-foreground mt-3 flex items-center justify-end gap-2 text-xs" aria-hidden>
            <span>0%</span>
            <span
              className="h-2 w-24 rounded-full border"
              style={{ backgroundImage: "linear-gradient(to right, transparent, var(--chart-1))" }}
            />
            <span>100%</span>
          </div>
        </>
      )}
    </SectionCard>
  );
}
