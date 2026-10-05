import { format, parseISO } from "date-fns";
import type { ChartConfig, ChartTooltipContent } from "@/components/ui/chart";

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;

/** "2026-10-04" -> "4 Oct" */
export function shortDate(value: string | number): string {
  try {
    return format(parseISO(String(value)), "d MMM");
  } catch {
    return String(value);
  }
}

/** "2026-10-04" -> "Sun, 04 Oct 2026" */
export function longDate(value: string): string {
  try {
    return format(parseISO(value), "EEE, dd MMM yyyy");
  } catch {
    return value;
  }
}

type TooltipFormatter = NonNullable<React.ComponentProps<typeof ChartTooltipContent>["formatter"]>;

/** Tooltip row: colour swatch, series label from the chart config, formatted value. */
export function tooltipFormatter(config: ChartConfig, fmt: (n: number) => string): TooltipFormatter {
  return function TooltipRow(value, name, item) {
    const key = String(name);
    const color =
      (item as { color?: string; payload?: { fill?: string } }).color ?? (item as { payload?: { fill?: string } }).payload?.fill;
    return (
      <div className="flex w-full items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} aria-hidden />
        <span className="text-muted-foreground">{config[key]?.label ?? key}</span>
        <span className="text-foreground ml-auto pl-3 font-mono font-medium tabular-nums">{fmt(Number(value))}</span>
      </div>
    );
  };
}

/** Fractional change vs. a previous value; undefined when there's no baseline. */
export function deltaOf(current: number, previous: number): number | undefined {
  if (!previous) return undefined;
  return (current - previous) / previous;
}
