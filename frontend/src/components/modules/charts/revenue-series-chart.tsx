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
import { formatCurrency } from "@/lib/format";
import type { RevenueAnalytics } from "@/types";
import { ChartCard } from "./chart-card";
import { longDate, shortDate, tooltipFormatter } from "./chart-utils";

type Row = RevenueAnalytics["series"][number];

const config = {
  consultation: { label: "Consultation", color: "var(--chart-1)" },
  lab: { label: "Lab", color: "var(--chart-2)" },
  pharmacy: { label: "Pharmacy", color: "var(--chart-3)" },
  other: { label: "Other", color: "var(--chart-4)" },
} satisfies ChartConfig;

const KEYS = ["consultation", "lab", "pharmacy", "other"] as const;
const rowTotal = (r: Row) => r.consultation + r.lab + r.pharmacy + r.other;

/** Daily revenue stacked by source (consultation / lab / pharmacy / other). */
export function RevenueSeriesChart({
  title = "Revenue by source",
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
  const isEmpty = !series?.some((r) => rowTotal(r) > 0);
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
      isEmpty={isEmpty}
      className={className}
      columns={[
        { key: "date", label: "Date", render: (r) => longDate(r.date) },
        ...KEYS.map((k) => ({ key: k, label: config[k].label, numeric: true, render: (r: Row) => formatCurrency(r[k]) })),
        { key: "total", label: "Total", numeric: true, render: (r) => formatCurrency(rowTotal(r)) },
      ]}
    >
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={series} accessibilityLayer={false} margin={{ left: 4, right: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={shortDate} />
          <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatCurrency(v, true)} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => longDate(String(payload?.[0]?.payload?.date ?? ""))}
                formatter={tooltipFormatter(config, (n) => formatCurrency(n))}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {KEYS.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="rev" fill={`var(--color-${k})`} radius={i === KEYS.length - 1 ? [3, 3, 0, 0] : 0} />
          ))}
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}
