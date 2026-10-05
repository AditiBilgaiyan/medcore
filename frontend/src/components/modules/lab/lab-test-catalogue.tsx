"use client";

import { ChevronDown, Clock, FlaskConical, TestTubes } from "lucide-react";
import { useMemo, useState } from "react";
import { SearchInput } from "@/components/shared/search-input";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRange } from "@/lib/clinical";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLabTests } from "@/services/lab";
import type { LabParameter, LabTest } from "@/types";

const range = (r?: [number, number]) => (r ? formatRange(r[0], r[1]) : "—");

function criticalText(p: LabParameter) {
  const parts = [p.criticalLow != null ? `< ${p.criticalLow}` : null, p.criticalHigh != null ? `> ${p.criticalHigh}` : null].filter(
    Boolean,
  );
  return parts.length ? parts.join(" or ") : "—";
}

function ParameterTable({ test }: { test: LabTest }) {
  const hasGender = test.parameters.some((p) => p.maleRange || p.femaleRange);
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">Parameters and reference ranges for {test.name}</caption>
        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
          <tr>
            <th scope="col" className="px-3 py-1.5 text-left font-semibold">
              Parameter
            </th>
            <th scope="col" className="px-3 py-1.5 text-left font-semibold">
              Unit
            </th>
            <th scope="col" className="px-3 py-1.5 text-left font-semibold">
              Reference
            </th>
            {hasGender && (
              <>
                <th scope="col" className="px-3 py-1.5 text-left font-semibold">
                  Male
                </th>
                <th scope="col" className="px-3 py-1.5 text-left font-semibold">
                  Female
                </th>
              </>
            )}
            <th scope="col" className="px-3 py-1.5 text-left font-semibold">
              Critical
            </th>
          </tr>
        </thead>
        <tbody>
          {test.parameters.map((p) => (
            <tr key={p.name} className="border-t">
              <th scope="row" className="px-3 py-1.5 text-left font-medium">
                {p.name}
              </th>
              <td className="text-muted-foreground px-3 py-1.5 whitespace-nowrap">{p.unit}</td>
              <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{formatRange(p.refLow, p.refHigh)}</td>
              {hasGender && (
                <>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{range(p.maleRange)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{range(p.femaleRange)}</td>
                </>
              )}
              <td
                className={cn(
                  "px-3 py-1.5 whitespace-nowrap tabular-nums",
                  (p.criticalLow != null || p.criticalHigh != null) && "text-destructive font-medium",
                )}
              >
                {criticalText(p)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TestCard({ test }: { test: LabTest }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="gap-0 py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{test.code}</span>
              <Badge variant="outline">{test.category}</Badge>
            </div>
            <h2 className="font-heading text-sm font-semibold">{test.name}</h2>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1">
                <TestTubes className="size-3.5" aria-hidden /> {test.sampleType}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="size-3.5" aria-hidden /> {test.turnaroundHours}h turnaround
              </span>
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
            <p className="font-heading text-base font-semibold tabular-nums">{formatCurrency(test.price)}</p>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${open ? "Hide" : "Show"} ${test.parameters.length} parameters for ${test.name}`}
              >
                {test.parameters.length} parameter{test.parameters.length === 1 ? "" : "s"}
                <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent className="border-t p-4">
          <ParameterTable test={test} />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function LabTestCatalogue() {
  const { data, isLoading, error, refetch } = useLabTests();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");

  const categories = useMemo(() => [...new Set((data ?? []).map((t) => t.category))].sort(), [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? [])
      .filter((t) => category === "ALL" || t.category === category)
      .filter(
        (t) =>
          !q || [t.name, t.code, t.category, t.sampleType, ...t.parameters.map((p) => p.name)].some((f) => f.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [data, search, category]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Test, code or parameter" aria-label="Search tests" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <p className="text-muted-foreground text-sm tabular-nums sm:ml-auto" aria-live="polite">
            {formatNumber(filtered.length)} of {formatNumber(data.length)} tests
          </p>
        )}
      </div>

      {isLoading ? (
        <CardsSkeleton count={6} />
      ) : error ? (
        <Card>
          <ErrorState error={error} onRetry={() => refetch()} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={FlaskConical} title="No tests match" description="Try a different search or category." />
        </Card>
      ) : (
        <div className="grid items-start gap-3 xl:grid-cols-2">
          {filtered.map((t) => (
            <TestCard key={t.id} test={t} />
          ))}
        </div>
      )}
    </div>
  );
}
