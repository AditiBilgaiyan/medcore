"use client";

import { TrendingUp, UserPlus, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { StatCard } from "@/components/shared/stat-card";
import { formatNumber, formatPercent, humanize } from "@/lib/format";
import { usePatientAnalytics } from "@/services/misc";
import type { DateRangeQuery, PatientGrowthAnalytics } from "@/types";
import { CategoryBarChart } from "../charts/category-bar-chart";
import { ChartCard } from "../charts/chart-card";
import { CHART_COLORS, longDate, shortDate, tooltipFormatter } from "../charts/chart-utils";

const growthConfig = { value: { label: "Registered patients", color: "var(--chart-1)" } } satisfies ChartConfig;

export function PatientsSection({ query }: { query: DateRangeQuery }) {
  const { data: p, isLoading, error, refetch } = usePatientAnalytics(query);
  const base = p ? p.total - p.newInPeriod : 0;
  const growth = p && base > 0 ? p.newInPeriod / base : undefined;

  return (
    <section aria-labelledby="analytics-patients" className="space-y-4">
      <h2 id="analytics-patients" className="sr-only">
        Patients
      </h2>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        <StatCard
          label="Total patients"
          value={formatNumber(p?.total)}
          icon={Users}
          loading={isLoading}
          hint="All registered, not archived"
        />
        <StatCard label="New in period" value={formatNumber(p?.newInPeriod)} icon={UserPlus} tone="success" loading={isLoading} />
        <StatCard
          label="Growth"
          value={growth !== undefined ? formatPercent(growth, 1) : "—"}
          icon={TrendingUp}
          tone="neutral"
          loading={isLoading}
          hint="New patients vs. base at start of period"
        />
      </div>
      <ChartCard
        headingLevel={3}
        title="Cumulative patient registrations"
        description="Total registered patients at the end of each day."
        rows={p?.series}
        rowKey={(r) => r.date}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        isEmpty={!p?.series.length}
        columns={[
          { key: "date", label: "Date", render: (r) => longDate(r.date) },
          { key: "value", label: "Registered patients", numeric: true, render: (r) => formatNumber(r.value) },
        ]}
      >
        <ChartContainer config={growthConfig} className="aspect-auto h-64 w-full">
          <AreaChart data={p?.series} accessibilityLayer={false} margin={{ left: 0, right: 8, top: 4 }}>
            <defs>
              <linearGradient id="patient-growth-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={shortDate} />
            <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} domain={["dataMin", "auto"]} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => longDate(String(payload?.[0]?.payload?.date ?? ""))}
                  formatter={tooltipFormatter(growthConfig, formatNumber)}
                />
              }
            />
            <Area dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} fill="url(#patient-growth-fill)" />
          </AreaChart>
        </ChartContainer>
      </ChartCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <GenderChart data={p?.byGender} isLoading={isLoading} error={error} onRetry={() => refetch()} />
        <CategoryBarChart
          headingLevel={3}
          title="By age group"
          description="All registered patients, age in years."
          data={p?.byAgeGroup.map((g) => ({ label: g.group, value: g.count }))}
          valueLabel="Patients"
          format={formatNumber}
          layout="vertical"
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    </section>
  );
}

function GenderChart({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data: PatientGrowthAnalytics["byGender"] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const rows = data?.map((g, i) => ({
    key: g.gender,
    label: humanize(g.gender),
    value: g.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const total = rows?.reduce((s, r) => s + r.value, 0) ?? 0;
  const config = Object.fromEntries((rows ?? []).map((r) => [r.key, { label: r.label, color: r.fill }])) satisfies ChartConfig;

  return (
    <ChartCard
      headingLevel={3}
      title="By gender"
      description="All registered patients."
      rows={rows}
      rowKey={(r) => r.key}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      isEmpty={!total}
      columns={[
        { key: "label", label: "Gender", render: (r) => r.label },
        { key: "value", label: "Patients", numeric: true, render: (r) => formatNumber(r.value) },
        { key: "share", label: "Share", numeric: true, render: (r) => (total ? formatPercent(r.value / total, 1) : "—") },
      ]}
    >
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <ChartContainer config={config} className="aspect-square h-52 shrink-0">
          <PieChart accessibilityLayer={false}>
            <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel formatter={tooltipFormatter(config, formatNumber)} />} />
            <Pie data={rows} dataKey="value" nameKey="key" innerRadius="55%" outerRadius="85%" strokeWidth={2} stroke="var(--card)">
              {rows?.map((r) => (
                <Cell key={r.key} fill={r.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <ul className="w-full space-y-2 text-sm">
          {rows?.map((r) => (
            <li key={r.key} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: r.fill }} aria-hidden />
              <span className="flex-1">{r.label}</span>
              <span className="font-semibold tabular-nums">{formatNumber(r.value)}</span>
              <span className="text-muted-foreground w-14 text-right text-xs tabular-nums">
                {total ? formatPercent(r.value / total, 1) : "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}
