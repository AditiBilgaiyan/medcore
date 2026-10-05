"use client";

import { LineChart as LineChartIcon, Table2 } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { VITAL_RANGES } from "@/lib/clinical";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Vitals } from "@/types";

type Metric = "pulse" | "bpSystolic" | "temperatureC" | "spo2";

const METRICS: { key: Metric; label: string; unit: string; color: string; domain: [number | "auto", number | "auto"] }[] = [
  { key: "pulse", label: "Pulse", unit: "bpm", color: "var(--chart-1)", domain: ["auto", "auto"] },
  { key: "bpSystolic", label: "Systolic BP", unit: "mmHg", color: "var(--chart-2)", domain: ["auto", "auto"] },
  { key: "temperatureC", label: "Temperature", unit: "°C", color: "var(--chart-3)", domain: [35, 40] },
  { key: "spo2", label: "SpO₂", unit: "%", color: "var(--chart-4)", domain: [85, 100] },
];

const timeLabel = (iso: string) => formatDate(iso, "dd MMM HH:mm");

/**
 * Small multiples — one chart per vital so each keeps its own scale (no dual axes).
 * The shaded band is the normal range. A table view gives the same data without a chart.
 */
export function VitalsTrend({ vitals }: { vitals: Vitals[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const rows = [...vitals].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

  if (rows.length < 2) {
    return <p className="text-muted-foreground text-sm">Trends appear once two or more sets of vitals are recorded.</p>;
  }

  const data = rows.map((v) => ({
    t: timeLabel(v.recordedAt),
    pulse: v.pulse,
    bpSystolic: v.bpSystolic,
    temperatureC: v.temperatureC,
    spo2: v.spo2,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Trend · {rows.length} readings</h3>
        <div className="flex rounded-lg border p-0.5" role="group" aria-label="Trend view">
          <Button
            size="xs"
            variant={view === "chart" ? "secondary" : "ghost"}
            aria-pressed={view === "chart"}
            onClick={() => setView("chart")}
          >
            <LineChartIcon /> Chart
          </Button>
          <Button
            size="xs"
            variant={view === "table" ? "secondary" : "ghost"}
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            <Table2 /> Table
          </Button>
        </div>
      </div>

      {view === "chart" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {METRICS.map((m) => {
            const values = rows.map((r) => r[m.key]).filter((v): v is number => v != null);
            const config = { [m.key]: { label: m.label, color: m.color } } satisfies ChartConfig;
            const range = VITAL_RANGES[m.key];
            const latest = values.at(-1);
            return (
              <figure key={m.key} className="rounded-lg border p-2.5">
                <figcaption className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="size-2 rounded-full" style={{ background: m.color }} aria-hidden />
                    {m.label} <span className="text-muted-foreground font-normal">({m.unit})</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    Latest <span className="text-foreground font-semibold">{latest ?? "—"}</span>
                  </span>
                </figcaption>
                {values.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center text-xs">Not recorded</p>
                ) : (
                  <ChartContainer
                    config={config}
                    className="aspect-auto h-32 w-full"
                    role="img"
                    aria-label={`${m.label} over time: ${values.length} readings, from ${values[0]} to ${latest} ${m.unit}. Normal range ${range[0]} to ${range[1]}.`}
                  >
                    <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }} accessibilityLayer>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <ReferenceArea y1={range[0]} y2={range[1]} fill="var(--muted)" fillOpacity={0.6} ifOverflow="hidden" />
                      <XAxis dataKey="t" tickLine={false} axisLine={false} tickMargin={6} minTickGap={28} fontSize={10} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={42}
                        fontSize={10}
                        domain={m.domain}
                        allowDecimals={m.key === "temperatureC"}
                      />
                      <ChartTooltip cursor content={<ChartTooltipContent indicator="line" />} />
                      <Line
                        dataKey={m.key}
                        type="monotone"
                        stroke={`var(--color-${m.key})`}
                        strokeWidth={2}
                        dot={{ r: 3, strokeWidth: 0, fill: `var(--color-${m.key})` }}
                        activeDot={{ r: 5, stroke: "var(--background)", strokeWidth: 2 }}
                        connectNulls
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </figure>
            );
          })}
          <p className="text-muted-foreground text-xs sm:col-span-2">Shaded band = normal range.</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Vital signs recorded during this admission, newest first</caption>
            <thead className="bg-muted text-muted-foreground sticky top-0 text-xs uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  Time
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  BP
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Pulse
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Temp °C
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  SpO₂ %
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  RR
                </th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">
                  By
                </th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((v) => (
                <tr key={v.recordedAt} className="border-t">
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{formatDateTime(v.recordedAt)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {v.bpSystolic != null ? `${v.bpSystolic}/${v.bpDiastolic ?? "—"}` : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{v.pulse ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{v.temperatureC ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{v.spo2 ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{v.respiratoryRate ?? "—"}</td>
                  <td className="text-muted-foreground px-3 py-1.5 whitespace-nowrap">{v.recordedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
