"use client";

import { CalendarDays, CalendarX2, CheckCircle2, UserX } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { StatCard } from "@/components/shared/stat-card";
import { formatNumber, formatPercent, humanize } from "@/lib/format";
import { useAppointmentAnalytics } from "@/services/misc";
import type { AppointmentAnalytics, DateRangeQuery } from "@/types";
import { CategoryBarChart } from "../charts/category-bar-chart";
import { ChartCard } from "../charts/chart-card";
import { longDate, shortDate, tooltipFormatter } from "../charts/chart-utils";

type Row = AppointmentAnalytics["series"][number];

const config = {
  total: { label: "Total", color: "var(--chart-1)" },
  completed: { label: "Completed", color: "var(--chart-2)" },
  cancelled: { label: "Cancelled / no-show", color: "var(--chart-5)" },
} satisfies ChartConfig;
const KEYS = ["total", "completed", "cancelled"] as const;

export function AppointmentsSection({ query }: { query: DateRangeQuery }) {
  const { data: a, isLoading, error, refetch } = useAppointmentAnalytics(query);
  const rate = (n: number | undefined) => (a && a.total && n !== undefined ? formatPercent(n / a.total, 1) : undefined);

  return (
    <section aria-labelledby="analytics-appointments" className="space-y-4">
      <h2 id="analytics-appointments" className="sr-only">
        Appointments
      </h2>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Appointments" value={formatNumber(a?.total)} icon={CalendarDays} loading={isLoading} hint="Scheduled in range" />
        <StatCard
          label="Completed"
          value={formatNumber(a?.completed)}
          icon={CheckCircle2}
          tone="success"
          loading={isLoading}
          hint={rate(a?.completed) && `${rate(a?.completed)} completion rate`}
        />
        <StatCard
          label="Cancelled"
          value={formatNumber(a?.cancelled)}
          icon={CalendarX2}
          tone="neutral"
          loading={isLoading}
          hint={rate(a?.cancelled) && `${rate(a?.cancelled)} of bookings`}
        />
        <StatCard
          label="No-shows"
          value={formatNumber(a?.noShow)}
          icon={UserX}
          tone="danger"
          loading={isLoading}
          hint={rate(a?.noShow) && `${rate(a?.noShow)} of bookings`}
        />
      </div>
      <ChartCard
        headingLevel={3}
        title="Daily appointments"
        description="Total bookings per day with completed and cancelled / no-show counts."
        rows={a?.series}
        rowKey={(r) => r.date}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        isEmpty={!a?.series.some((r) => r.total > 0)}
        columns={[
          { key: "date", label: "Date", render: (r: Row) => longDate(r.date) },
          ...KEYS.map((k) => ({ key: k, label: config[k].label, numeric: true, render: (r: Row) => formatNumber(r[k]) })),
        ]}
      >
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <LineChart data={a?.series} accessibilityLayer={false} margin={{ left: 0, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={shortDate} />
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
            <Line dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2} dot={false} />
            <Line dataKey="completed" type="monotone" stroke="var(--color-completed)" strokeWidth={2} dot={false} />
            <Line dataKey="cancelled" type="monotone" stroke="var(--color-cancelled)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
          </LineChart>
        </ChartContainer>
      </ChartCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryBarChart
          headingLevel={3}
          title="By status"
          description="Current status of appointments in range."
          data={a?.byStatus.map((s) => ({ label: humanize(s.status), value: s.count }))}
          valueLabel="Appointments"
          format={formatNumber}
          layout="vertical"
          multicolor
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
        />
        <CategoryBarChart
          headingLevel={3}
          title="By department"
          data={a?.byDepartment.map((d) => ({ label: d.department, value: d.count }))}
          valueLabel="Appointments"
          format={formatNumber}
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    </section>
  );
}
