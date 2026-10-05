"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HOSPITAL_STATUS_TABS, HOSPITAL_TYPE_LABEL, PLAN_BY_VALUE } from "@/components/modules/admin/constants";
import { HospitalStatusActions } from "@/components/modules/admin/hospital-status-actions";
import { ROUTES } from "@/constants/routes";
import { formatDate, formatNumber } from "@/lib/format";
import { useHospitals } from "@/services/admin";
import type { Hospital } from "@/types";

const columns: ColumnDef<Hospital>[] = [
  {
    accessorKey: "name",
    header: "Hospital",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.name}</p>
        <p className="text-muted-foreground font-mono text-xs">{row.original.code}</p>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <span className="whitespace-nowrap">{HOSPITAL_TYPE_LABEL[row.original.type] ?? row.original.type}</span>,
  },
  {
    id: "city",
    header: "City",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.address.city}
        <span className="text-muted-foreground">, {row.original.address.state}</span>
      </span>
    ),
  },
  {
    accessorKey: "plan",
    header: "Plan",
    cell: ({ row }) => <Badge variant="outline">{PLAN_BY_VALUE[row.original.plan]?.name ?? row.original.plan}</Badge>,
  },
  {
    accessorKey: "bedCount",
    header: () => <div className="text-right">Beds</div>,
    cell: ({ row }) => <div className="text-right tabular-nums">{formatNumber(row.original.bedCount)}</div>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      // Keep clicks and key presses (including from the dialog portal) from opening the row.
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <HospitalStatusActions hospital={row.original} size="xs" />
      </div>
    ),
  },
];

export default function HospitalsPage() {
  const [status, setStatus] = useState<(typeof HOSPITAL_STATUS_TABS)[number]["value"]>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error, refetch } = useHospitals({
    status: status === "ALL" ? undefined : [status],
    search: search || undefined,
    page,
    limit: 20,
  });
  const filtered = status !== "ALL" || !!search;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hospitals"
        description="Every tenant on the MedCore platform. New hospitals stay pending until you verify them."
        actions={
          <Button asChild>
            <Link href={ROUTES.hospitalNew}>
              <Plus /> Onboard hospital
            </Link>
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <Tabs
            value={status}
            onValueChange={(v) => {
              setStatus(v as typeof status);
              setPage(1);
            }}
          >
            <TabsList aria-label="Filter by hospital status">
              {HOSPITAL_STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="px-2.5">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <DataTable
          columns={columns}
          data={data?.data}
          isLoading={isLoading}
          isFetching={isFetching}
          error={error}
          onRetry={() => void refetch()}
          meta={data?.meta}
          onPageChange={setPage}
          rowHref={(h) => ROUTES.hospital(h.id)}
          getRowId={(h) => h.id}
          caption="Hospitals"
          toolbar={
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search name, code, city or email"
              className="sm:w-80"
            />
          }
          emptyState={
            <EmptyState
              icon={Building2}
              title={filtered ? "No hospitals match these filters" : "No hospitals yet"}
              description={filtered ? "Try another status or search." : "Onboard the first hospital to get started."}
              action={
                !filtered ? (
                  <Button asChild size="sm">
                    <Link href={ROUTES.hospitalNew}>
                      <Plus /> Onboard hospital
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </div>
    </div>
  );
}
