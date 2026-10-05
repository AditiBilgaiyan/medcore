"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ChartCard } from "./chart-card";
import { CHART_COLORS, tooltipFormatter } from "./chart-utils";

export interface CategoryDatum {
  label: string;
  value: number;
}

/**
 * Single-series horizontal (default) or vertical bar chart for categorical
 * breakdowns — by department, payment method, status, plan, age group …
 */
export function CategoryBarChart({
  title,
  description,
  data,
  valueLabel,
  format,
  isLoading,
  error,
  onRetry,
  headingLevel,
  layout = "horizontal",
  multicolor,
  className,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  data: CategoryDatum[] | undefined;
  /** Column heading / tooltip label for the value, e.g. "Revenue". */
  valueLabel: string;
  format: (n: number) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  headingLevel?: 2 | 3;
  /** "horizontal" = bars run left→right with category labels on the Y axis. */
  layout?: "horizontal" | "vertical";
  multicolor?: boolean;
  className?: string;
  footer?: React.ReactNode;
}) {
  const config = { value: { label: valueLabel, color: "var(--chart-1)" } } satisfies ChartConfig;
  const total = data?.reduce((s, d) => s + d.value, 0) ?? 0;
  const horizontal = layout === "horizontal";
  const height = horizontal ? Math.max(160, (data?.length ?? 0) * 34 + 24) : 240;
  const labelWidth = Math.min(140, Math.max(60, ...(data ?? []).map((d) => d.label.length * 6.5)));

  return (
    <ChartCard
      title={title}
      description={description}
      headingLevel={headingLevel}
      rows={data}
      rowKey={(r) => r.label}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!data?.some((d) => d.value > 0)}
      className={className}
      footer={footer}
      columns={[
        { key: "label", label: "Category", render: (r) => r.label },
        { key: "value", label: valueLabel, numeric: true, render: (r) => format(r.value) },
        {
          key: "share",
          label: "Share",
          numeric: true,
          render: (r) => (total ? `${((r.value / total) * 100).toFixed(1)}%` : "—"),
        },
      ]}
    >
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          accessibilityLayer={false}
          margin={{ left: 0, right: horizontal ? 16 : 4 }}
        >
          <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={format} />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={labelWidth} tick={{ fontSize: 11 }} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={format} allowDecimals={false} />
            </>
          )}
          <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={tooltipFormatter(config, format)} />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} maxBarSize={28}>
            {multicolor && data?.map((d, i) => <Cell key={d.label} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}
