"use client";

import { BarChart3, Table2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { cn } from "@/lib/utils";

export interface ChartTableColumn<T> {
  key: string;
  label: string;
  /** Right-align and use tabular figures. */
  numeric?: boolean;
  render: (row: T) => React.ReactNode;
}

interface ChartCardProps<T> {
  title: string;
  description?: React.ReactNode;
  /** h2 on dashboards, h3 when nested under a section heading. */
  headingLevel?: 2 | 3;
  /** Data behind the chart, rendered as an accessible table alternative. */
  rows: T[] | undefined;
  columns: ChartTableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Show the empty state instead of the chart (defaults to rows.length === 0). */
  isEmpty?: boolean;
  emptyTitle?: string;
  action?: React.ReactNode;
  /** Optional summary row(s) shown under the chart, e.g. totals. */
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Card wrapper for every chart: heading, loading/error/empty states, and a
 * "View as table" toggle. While the chart is shown, the same data is also
 * rendered as a visually-hidden table so screen readers always get the numbers.
 */
export function ChartCard<T>({
  title,
  description,
  headingLevel = 2,
  rows,
  columns,
  rowKey,
  children,
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyTitle = "No data for this period",
  action,
  footer,
  className,
  bodyClassName,
}: ChartCardProps<T>) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const empty = isEmpty ?? (rows?.length ?? 0) === 0;
  const ready = !isLoading && !(error && !rows) && !empty;

  return (
    <Card className={cn("min-w-0 gap-0 py-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <Heading className="font-heading text-sm font-semibold">{title}</Heading>
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {action}
          {ready && (
            <Button
              variant="ghost"
              size="xs"
              aria-pressed={view === "table"}
              onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
            >
              {view === "chart" ? <Table2 aria-hidden /> : <BarChart3 aria-hidden />}
              {view === "chart" ? "View as table" : "View as chart"}
              <span className="sr-only">: {title}</span>
            </Button>
          )}
        </div>
      </div>
      <div className={cn("p-4", bodyClassName)}>
        {isLoading ? (
          <Skeleton className="h-60 w-full" aria-label={`Loading ${title}`} />
        ) : error && !rows ? (
          <ErrorState error={error} onRetry={onRetry} className="py-8" />
        ) : empty ? (
          <EmptyState compact icon={BarChart3} title={emptyTitle} />
        ) : view === "table" ? (
          <DataTableView title={title} rows={rows ?? []} columns={columns} rowKey={rowKey} />
        ) : (
          <>
            <div aria-hidden="true">{children}</div>
            <DataTableView title={title} rows={rows ?? []} columns={columns} rowKey={rowKey} srOnly />
          </>
        )}
        {ready && footer && <div className="mt-3 border-t pt-3">{footer}</div>}
      </div>
    </Card>
  );
}

function DataTableView<T>({
  title,
  rows,
  columns,
  rowKey,
  srOnly,
}: {
  title: string;
  rows: T[];
  columns: ChartTableColumn<T>[];
  rowKey: (row: T, index: number) => string;
  srOnly?: boolean;
}) {
  const table = (
    <Table>
      <caption className="sr-only">{title}</caption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((c) => (
            <TableHead key={c.key} scope="col" className={cn("h-8 text-xs", c.numeric && "text-right")}>
              {c.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={rowKey(row, i)}>
            {columns.map((c, j) =>
              j === 0 ? (
                <TableHead key={c.key} scope="row" className="text-foreground h-auto py-1.5 font-normal">
                  {c.render(row)}
                </TableHead>
              ) : (
                <TableCell key={c.key} className={cn("py-1.5", c.numeric && "text-right tabular-nums")}>
                  {c.render(row)}
                </TableCell>
              ),
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  if (srOnly) return <div className="sr-only">{table}</div>;
  return <div className="max-h-72 overflow-auto rounded-md border">{table}</div>;
}
