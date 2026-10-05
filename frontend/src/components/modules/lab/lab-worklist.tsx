"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownWideNarrow, FlaskConical, Loader2, Play, TestTubeDiagonal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatNumber, formatRelative, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCollectSample, useLabOrders, useLabTests, useStartProcessing } from "@/services/lab";
import type { LabOrder, LabOrderQuery, LabPriority } from "@/types";
import { formatDuration, LAB_TABS, priorityLabel, targetTurnaroundHours, turnaround, type LabTab } from "./lab-utils";

const POLL_MS = 30_000;
const PRIORITIES: LabPriority[] = ["STAT", "URGENT", "ROUTINE"];

function TabCount({ query, enabled }: { query: Omit<LabOrderQuery, "sortBy">; enabled: boolean }) {
  const { data } = useLabOrders({ ...query, limit: 1 }, { enabled, refetchInterval: POLL_MS });
  if (!data) return null;
  return (
    <span className="bg-muted text-muted-foreground group-data-[state=active]/tabs-trigger:bg-primary/10 rounded-full px-1.5 text-[11px] leading-4 font-semibold tabular-nums">
      {formatNumber(data.meta.total)}
    </span>
  );
}

export function LabWorklist() {
  const { user, can } = useAuth();
  const [tab, setTab] = useState<LabTab>("open");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<LabPriority | "ALL">("ALL");
  const [prioritySort, setPrioritySort] = useState(true);
  const [page, setPage] = useState(1);

  const isDoctor = user?.role === "DOCTOR";
  const enabled = !isDoctor || !!user?.doctorId;
  const canCollect = can("lab:collect");
  const canProcess = can("lab:process");

  const baseQuery: Omit<LabOrderQuery, "sortBy"> = {
    search: search || undefined,
    priority: priority === "ALL" ? undefined : priority,
    doctorId: isDoctor ? user?.doctorId : undefined,
  };
  const current = LAB_TABS.find((t) => t.value === tab)!;
  const orders = useLabOrders(
    { ...baseQuery, status: current.status, sortBy: prioritySort ? "priority" : undefined, page, limit: 20 },
    { enabled, refetchInterval: POLL_MS },
  );
  const { data: catalogue } = useLabTests();

  const collect = useCollectSample();
  const start = useStartProcessing();

  const columns = useMemo<ColumnDef<LabOrder>[]>(() => {
    const cols: ColumnDef<LabOrder>[] = [
      {
        id: "number",
        header: "Order",
        cell: ({ row }) => <span className="font-mono text-xs whitespace-nowrap">{row.original.number}</span>,
      },
      {
        id: "patient",
        header: "Patient",
        cell: ({ row }) => (
          <div className="min-w-32">
            <p className="font-medium">{row.original.patientName}</p>
            <p className="text-muted-foreground text-xs">{humanize(row.original.patientGender)}</p>
          </div>
        ),
      },
      {
        id: "tests",
        header: "Tests",
        cell: ({ row }) => {
          const names = row.original.tests.map((t) => t.testName);
          return (
            <p className="line-clamp-2 max-w-64 min-w-40 text-sm" title={names.join(", ")}>
              {names.join(", ")}
            </p>
          );
        },
      },
      {
        id: "doctor",
        header: "Ordered by",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.doctorName}</span>,
      },
      {
        id: "priority",
        header: "Priority",
        cell: ({ row }) => <StatusBadge status={row.original.priority} label={priorityLabel(row.original.priority)} />,
      },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "ordered",
        header: "Ordered",
        cell: ({ row }) => (
          <time
            dateTime={row.original.createdAt}
            title={formatDateTime(row.original.createdAt)}
            className="text-muted-foreground text-sm whitespace-nowrap"
          >
            {formatRelative(row.original.createdAt)}
          </time>
        ),
      },
      {
        id: "tat",
        header: "Turnaround",
        cell: ({ row }) => {
          const o = row.original;
          if (o.status === "CANCELLED") return <span className="text-muted-foreground">—</span>;
          const tat = turnaround(o, targetTurnaroundHours(o, catalogue));
          return (
            <div className="text-sm whitespace-nowrap tabular-nums">
              <span className={cn(tat.overdue && "text-destructive font-semibold")}>{formatDuration(tat.elapsedMinutes)}</span>
              {tat.targetMinutes != null && <span className="text-muted-foreground"> / {formatDuration(tat.targetMinutes)}</span>}
              {tat.overdue && <span className="text-destructive block text-xs font-medium">{tat.done ? "Missed target" : "Overdue"}</span>}
            </div>
          );
        },
      },
    ];
    if (canCollect || canProcess) {
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const o = row.original;
          const stop = (e: React.SyntheticEvent) => e.stopPropagation();
          if (o.status === "ORDERED" && canCollect) {
            const pending = collect.isPending && collect.variables === o.id;
            return (
              <Button
                size="xs"
                variant="outline"
                disabled={pending}
                onKeyDown={stop}
                onClick={(e) => {
                  stop(e);
                  collect.mutate(o.id, { onSuccess: () => toast.success(`Sample collected for ${o.number}`) });
                }}
                aria-label={`Collect sample for ${o.number}`}
              >
                {pending ? <Loader2 className="animate-spin" /> : <TestTubeDiagonal />} Collect sample
              </Button>
            );
          }
          if (o.status === "SAMPLE_COLLECTED" && canProcess) {
            const pending = start.isPending && start.variables === o.id;
            return (
              <Button
                size="xs"
                variant="outline"
                disabled={pending}
                onKeyDown={stop}
                onClick={(e) => {
                  stop(e);
                  start.mutate(o.id, { onSuccess: () => toast.success(`Processing started for ${o.number}`) });
                }}
                aria-label={`Start processing ${o.number}`}
              >
                {pending ? <Loader2 className="animate-spin" /> : <Play />} Start
              </Button>
            );
          }
          return null;
        },
      });
    }
    return cols;
  }, [catalogue, canCollect, canProcess, collect, start]);

  const resetPage =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={resetPage((v: string) => setTab(v as LabTab))}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList aria-label="Order status">
            {LAB_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="group/tabs-trigger gap-1.5 px-2.5">
                {t.label}
                <TabCount query={{ ...baseQuery, status: t.status }} enabled={enabled} />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <DataTable
        caption="Lab orders"
        columns={columns}
        data={orders.data?.data}
        meta={orders.data?.meta}
        onPageChange={setPage}
        isLoading={orders.isLoading}
        isFetching={orders.isFetching}
        error={orders.error}
        onRetry={() => orders.refetch()}
        rowHref={(o) => ROUTES.labOrder(o.id)}
        getRowId={(o) => o.id}
        rowClassName={(o) =>
          o.priority === "STAT" && o.status !== "APPROVED" && o.status !== "CANCELLED" ? "bg-destructive/[0.03]" : undefined
        }
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={resetPage(setSearch)}
              placeholder="Order no., patient or test"
              aria-label="Search lab orders"
            />
            <Select value={priority} onValueChange={resetPage((v: string) => setPriority(v as LabPriority | "ALL"))}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {priorityLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Switch id="priority-sort" checked={prioritySort} onCheckedChange={resetPage(setPrioritySort)} />
              <Label htmlFor="priority-sort" className="flex items-center gap-1.5 text-sm font-normal">
                <ArrowDownWideNarrow className="text-muted-foreground size-4" aria-hidden />
                STAT &amp; urgent first
              </Label>
            </div>
          </>
        }
        emptyState={
          <EmptyState
            icon={FlaskConical}
            title={
              search || priority !== "ALL"
                ? "No orders match these filters"
                : `No ${tab === "all" ? "" : current.label.toLowerCase() + " "}orders`
            }
            description={
              tab === "open" && !search ? "New orders will appear here automatically." : "Try a different tab or clear the filters."
            }
          />
        }
      />
      <p className="text-muted-foreground text-xs" aria-live="polite">
        Refreshes every 30 seconds{orders.isFetching && !orders.isLoading ? " · updating…" : ""}
      </p>
    </div>
  );
}
