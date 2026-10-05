"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatNumber } from "@/lib/format";
import type { AppointmentAnalytics } from "@/types";
import { ChartCard } from "./chart-card";
import { longDate, shortDate, tooltipFormatter } from "./chart-utils";

type Row = AppointmentAnalytics["series"][number];

const config = {
  total: { label: "Total", color: "var(--chart-1)" },
  completed: { label: "Completed", color: "var(--chart-2)" },
  cancelled: { label: "Cancelled / no-show", color: "var(--chart-5)" },
} satisfies ChartConfig;

const KEYS = ["total", "completed", "cancelled"] as const;

/** Grouped daily bars: total vs completed vs cancelled/no-show. */
export function AppointmentVolumeChart({
  title = "Appointment volume",
  description,
  series,
  isLoading,
  error,
  onRetry,
  headingLevel,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  series: Row[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  return (
    <ChartCard
      title={title}
      description={description}
      headingLevel={headingLevel}
      rows={series}
      rowKey={(r) => r.date}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!series?.some((r) => r.total > 0)}
      className={className}
      columns={[
        { key: "date", label: "Date", render: (r) => longDate(r.date) },
        ...KEYS.map((k) => ({ key: k, label: config[k].label, numeric: true, render: (r: Row) => formatNumber(r[k]) })),
      ]}
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={series} accessibilityLayer={false} margin={{ left: 0, right: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={shortDate} />
          <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => longDate(String(payload?.[0]?.payload?.date ?? ""))}
                formatter={tooltipFormatter(config, formatNumber)}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {KEYS.map((k) => (
            <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={[3, 3, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}
