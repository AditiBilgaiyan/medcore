import { CalendarOff } from "lucide-react";
import { DAY_NAMES, DAY_SHORT, slotsInBlock, WEEK_ORDER } from "@/components/modules/appointments/utils";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AvailabilityException, AvailabilityRule, Department } from "@/types";

/** Read-only Mon→Sun view of a doctor's weekly schedule. */
export function WeeklyScheduleSummary({
  rules,
  exceptions,
  departments,
  className,
}: {
  rules: AvailabilityRule[];
  exceptions?: AvailabilityException[];
  departments?: Department[];
  className?: string;
}) {
  const totalSlots = rules.reduce((n, r) => n + slotsInBlock(r.startTime, r.endTime, r.slotMinutes), 0);
  const multiDept = new Set(rules.map((r) => r.departmentId)).size > 1;
  const deptName = (id: string) => departments?.find((d) => d.id === id)?.name;

  return (
    <div className={cn("space-y-3", className)}>
      <dl className="divide-y rounded-lg border">
        {WEEK_ORDER.map((day) => {
          const blocks = rules.filter((r) => r.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <div key={day} className="flex items-start gap-3 px-3 py-2 text-sm">
              <dt className="w-12 shrink-0 font-medium">
                <abbr title={DAY_NAMES[day]} className="no-underline">
                  {DAY_SHORT[day]}
                </abbr>
              </dt>
              <dd className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {blocks.length === 0 ? (
                  <span className="text-muted-foreground">Off</span>
                ) : (
                  blocks.map((b) => (
                    <span key={b.id} className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs tabular-nums">
                      {formatTime(b.startTime)} – {formatTime(b.endTime)}
                      <span className="text-muted-foreground">· {b.slotMinutes} min</span>
                      {multiDept && deptName(b.departmentId) && <span className="text-muted-foreground">· {deptName(b.departmentId)}</span>}
                    </span>
                  ))
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="text-muted-foreground text-xs tabular-nums">{totalSlots} bookable slots per week</p>
      {exceptions && exceptions.length > 0 && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">Upcoming leave</p>
          <ul className="space-y-1">
            {exceptions.map((x) => (
              <li key={x.id} className="flex items-start gap-2 text-sm">
                <CalendarOff className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium tabular-nums">{formatDate(x.date, "EEE, dd MMM")}</span>{" "}
                  <span className="text-muted-foreground">— {x.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
