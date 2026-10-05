"use client";

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/types";
import { EmptyState, ErrorState } from "./states";

export interface DataTableProps<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  data: T[] | undefined;
  isLoading?: boolean;
  /** True while refetching with stale data on screen. */
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Server pagination metadata. Omit for client-side lists. */
  meta?: PaginationMeta;
  onPageChange?: (page: number) => void;
  /** Make rows navigable; rendered as keyboard-accessible links. */
  rowHref?: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  emptyState?: React.ReactNode;
  toolbar?: React.ReactNode;
  caption?: string;
  getRowId?: (row: T) => string;
  skeletonRows?: number;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  isFetching,
  error,
  onRetry,
  meta,
  onPageChange,
  rowHref,
  onRowClick,
  rowClassName,
  emptyState,
  toolbar,
  caption,
  getRowId,
  skeletonRows = 8,
  className,
}: DataTableProps<T>) {
  const router = useRouter();
  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  const clickable = !!rowHref || !!onRowClick;
  const activate = (row: T) => {
    if (onRowClick) onRowClick(row);
    else if (rowHref) router.push(rowHref(row));
  };

  const from = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  return (
    <div className={cn("bg-card overflow-hidden rounded-xl border", className)}>
      {toolbar && <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:flex-wrap sm:items-center">{toolbar}</div>}

      {error && !data ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <div
          className={cn("relative overflow-x-auto transition-opacity", isFetching && !isLoading && "opacity-70")}
          aria-busy={isLoading || isFetching}
        >
          <Table>
            {caption && <caption className="sr-only">{caption}</caption>}
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      className="text-muted-foreground h-9 text-xs font-semibold tracking-wide whitespace-nowrap uppercase"
                      style={{ width: h.column.columnDef.size !== 150 ? h.column.columnDef.size : undefined }}
                    >
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: skeletonRows }).map((_, i) => (
                    <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                      {columns.map((_, j) => (
                        <TableCell key={j} className="py-3">
                          <Skeleton className="h-4 w-full max-w-40" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(clickable && "cursor-pointer", rowClassName?.(row.original))}
                      onClick={clickable ? () => activate(row.original) : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === "Enter" && e.target === e.currentTarget) activate(row.original);
                            }
                          : undefined
                      }
                      tabIndex={clickable ? 0 : undefined}
                      role={clickable ? "link" : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {!isLoading &&
            (data?.length ?? 0) === 0 &&
            (emptyState ?? <EmptyState title="Nothing here yet" description="Try changing the filters." />)}
        </div>
      )}

      {meta && meta.total > 0 && (
        <div className="flex flex-col items-center justify-between gap-2 border-t px-3 py-2 text-sm sm:flex-row">
          <p className="text-muted-foreground">
            Showing <span className="text-foreground font-medium tabular-nums">{formatNumber(from)}</span>–
            <span className="text-foreground font-medium tabular-nums">{formatNumber(to)}</span> of{" "}
            <span className="text-foreground font-medium tabular-nums">{formatNumber(meta.total)}</span>
          </p>
          {meta.totalPages > 1 && onPageChange && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1}>
                <ChevronLeft /> Previous
              </Button>
              <span className="text-muted-foreground text-xs tabular-nums">
                Page {meta.page} of {meta.totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.totalPages}>
                Next <ChevronRight />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
