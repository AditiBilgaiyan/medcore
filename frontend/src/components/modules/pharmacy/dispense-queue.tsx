"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/constants/routes";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { usePrescriptions } from "@/services/prescriptions";
import type { Prescription, PrescriptionStatus } from "@/types";

type QueueTab = "queue" | "dispensed";
const TAB_STATUS: Record<QueueTab, PrescriptionStatus[]> = {
  queue: ["ISSUED", "PARTIALLY_DISPENSED"],
  dispensed: ["DISPENSED"],
};

function QueueCount({ status, search }: { status: PrescriptionStatus[]; search?: string }) {
  const { data } = usePrescriptions({ status, search, limit: 1 });
  if (!data) return null;
  return (
    <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[11px] leading-4 font-semibold tabular-nums">
      {formatNumber(data.meta.total)}
    </span>
  );
}

export function DispenseQueue() {
  const [tab, setTab] = useState<QueueTab>("queue");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const list = usePrescriptions({
    status: TAB_STATUS[tab],
    search: search || undefined,
    page,
    limit: 20,
    // Oldest first in the queue so nobody waits too long; newest first in history.
    sortBy: "createdAt",
    sortOrder: tab === "queue" ? "asc" : "desc",
  });

  const columns = useMemo<ColumnDef<Prescription>[]>(
    () => [
      {
        id: "number",
        header: "Rx no.",
        cell: ({ row }) => <span className="font-mono text-xs whitespace-nowrap">{row.original.number}</span>,
      },
      {
        id: "patient",
        header: "Patient",
        cell: ({ row }) => <span className="font-medium whitespace-nowrap">{row.original.patientName}</span>,
      },
      { id: "doctor", header: "Prescriber", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.doctorName}</span> },
      {
        id: "items",
        header: "Items",
        cell: ({ row }) => {
          const items = row.original.items;
          const names = items.map((i) => i.medicineName).join(", ");
          return (
            <div className="max-w-72 min-w-40">
              <p className="text-sm tabular-nums">
                {items.length} item{items.length === 1 ? "" : "s"}
              </p>
              <p className="text-muted-foreground truncate text-xs" title={names}>
                {names}
              </p>
            </div>
          );
        },
      },
      {
        id: "issued",
        header: "Issued",
        cell: ({ row }) => (
          <time
            dateTime={row.original.signedAt}
            title={formatDateTime(row.original.signedAt)}
            className="text-muted-foreground text-sm whitespace-nowrap"
          >
            {formatRelative(row.original.signedAt)}
          </time>
        ),
      },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );

  return (
    <div className="space-y-3">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as QueueTab);
          setPage(1);
        }}
      >
        <TabsList aria-label="Prescription status">
          <TabsTrigger value="queue" className="gap-1.5 px-2.5">
            To dispense <QueueCount status={TAB_STATUS.queue} search={search || undefined} />
          </TabsTrigger>
          <TabsTrigger value="dispensed" className="gap-1.5 px-2.5">
            Recently dispensed
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        caption="Prescriptions"
        columns={columns}
        data={list.data?.data}
        meta={list.data?.meta}
        onPageChange={setPage}
        isLoading={list.isLoading}
        isFetching={list.isFetching}
        error={list.error}
        onRetry={() => list.refetch()}
        rowHref={(rx) => ROUTES.dispensePrescription(rx.id)}
        getRowId={(rx) => rx.id}
        toolbar={
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Rx no., patient, doctor or medicine"
            aria-label="Search prescriptions"
          />
        }
        emptyState={
          <EmptyState
            icon={ClipboardList}
            title={search ? "No prescriptions match" : tab === "queue" ? "Queue is clear" : "Nothing dispensed yet"}
            description={
              search
                ? "Try a different search."
                : tab === "queue"
                  ? "New prescriptions appear here as soon as doctors sign them."
                  : undefined
            }
          />
        }
      />
    </div>
  );
}
