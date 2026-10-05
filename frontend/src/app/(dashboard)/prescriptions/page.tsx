"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pill } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime } from "@/lib/format";
import { usePrescriptions } from "@/services/prescriptions";
import type { Prescription, PrescriptionStatus } from "@/types";

const STATUSES: { value: PrescriptionStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "ISSUED", label: "Issued" },
  { value: "PARTIALLY_DISPENSED", label: "Partially dispensed" },
  { value: "DISPENSED", label: "Dispensed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function PrescriptionsPage() {
  const { user, role } = useAuth();
  const isDoctor = role === "DOCTOR" && !!user?.doctorId;
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState<PrescriptionStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const mine = isDoctor && scope === "mine";

  const q = usePrescriptions({
    page,
    limit: 20,
    search,
    status: status === "ALL" ? undefined : [status],
    doctorId: mine ? user?.doctorId : undefined,
  });

  const columns = useMemo<ColumnDef<Prescription>[]>(
    () => [
      {
        id: "number",
        header: "Prescription",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="font-mono text-sm font-medium">{row.original.number}</p>
            <p className="text-muted-foreground text-xs tabular-nums">{formatDateTime(row.original.signedAt)}</p>
          </div>
        ),
      },
      {
        id: "patient",
        header: "Patient",
        cell: ({ row }) => <span className="font-medium whitespace-nowrap">{row.original.patientName}</span>,
      },
      { id: "doctor", header: "Prescriber", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.doctorName}</span> },
      {
        id: "items",
        header: "Medicines",
        cell: ({ row }) => {
          const items = row.original.items;
          return (
            <span className="line-clamp-1 max-w-md">
              <span className="tabular-nums">{items.length}</span> · {items.map((i) => i.medicineName).join(", ")}
            </span>
          );
        },
      },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );

  const filtered = !!search || status !== "ALL";

  return (
    <div>
      <PageHeader
        title="Prescriptions"
        description={mine ? "Prescriptions you've signed." : "E-prescriptions issued across the hospital."}
      />
      <DataTable
        caption="Prescriptions"
        columns={columns}
        data={q.data?.data}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        onRetry={() => q.refetch()}
        meta={q.data?.meta}
        onPageChange={setPage}
        rowHref={(rx) => ROUTES.prescription(rx.id)}
        getRowId={(rx) => rx.id}
        toolbar={
          <>
            {isDoctor && (
              <div className="flex w-fit rounded-lg border p-0.5" role="group" aria-label="Show prescriptions">
                {(["mine", "all"] as const).map((s) => (
                  <Button
                    key={s}
                    size="xs"
                    variant={scope === s ? "secondary" : "ghost"}
                    aria-pressed={scope === s}
                    onClick={() => {
                      setScope(s);
                      setPage(1);
                    }}
                  >
                    {s === "mine" ? "Mine" : "All"}
                  </Button>
                ))}
              </div>
            )}
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search number, patient or medicine"
              aria-label="Search prescriptions"
            />
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as PrescriptionStatus | "ALL");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        emptyState={
          <EmptyState
            icon={Pill}
            title={filtered ? "No prescriptions match" : "No prescriptions yet"}
            description={
              filtered ? "Try a different search or status." : mine ? "Prescriptions you issue during encounters appear here." : undefined
            }
          />
        }
      />
    </div>
  );
}
