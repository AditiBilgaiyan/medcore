"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BedDouble, Clock, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AdmitPatientDialog } from "@/components/modules/wards/admit-patient-dialog";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAdmissions, useWards } from "@/services/misc";
import type { Admission } from "@/types";

const VITALS_DUE_MS = 4 * 60 * 60 * 1000;
const ADMIT_ROLES = ["NURSE", "DOCTOR", "HOSPITAL_ADMIN"];

export default function WardsPage() {
  const { role } = useAuth();
  const wards = useWards();
  const [wardId, setWardId] = useState<string>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const admissions = useAdmissions({ wardId, search, page, limit: 25 });
  const selectedWard = wards.data?.find((w) => w.id === wardId);

  const totals = useMemo(() => {
    const list = wards.data ?? [];
    return { beds: list.reduce((s, w) => s + w.totalBeds, 0), occupied: list.reduce((s, w) => s + w.occupiedBeds, 0) };
  }, [wards.data]);

  const columns = useMemo<ColumnDef<Admission>[]>(
    () => [
      {
        id: "bed",
        header: "Bed",
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-sm font-medium">{row.original.bedNumber}</p>
            <p className="text-muted-foreground text-xs whitespace-nowrap">{row.original.wardName}</p>
          </div>
        ),
      },
      {
        id: "patient",
        header: "Patient",
        cell: ({ row }) => (
          <div className="min-w-36">
            <p className="font-medium">{row.original.patientName}</p>
            <p className="text-muted-foreground font-mono text-xs">{row.original.patientMrn}</p>
          </div>
        ),
      },
      { id: "dx", header: "Diagnosis", cell: ({ row }) => <span className="line-clamp-2 max-w-64">{row.original.diagnosis}</span> },
      {
        id: "doctor",
        header: "Attending",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.attendingDoctorName}</span>,
      },
      {
        id: "admitted",
        header: "Admitted",
        cell: ({ row }) => (
          <time
            dateTime={row.original.admittedAt}
            title={formatDateTime(row.original.admittedAt)}
            className="whitespace-nowrap tabular-nums"
          >
            {formatRelative(row.original.admittedAt)}
          </time>
        ),
      },
      {
        id: "vitals",
        header: "Last vitals",
        cell: ({ row }) => {
          const last = row.original.vitals[0]?.recordedAt;
          const due = !last || Date.now() - new Date(last).getTime() > VITALS_DUE_MS;
          return (
            <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
              <span className="text-sm tabular-nums">{last ? formatRelative(last) : "Never"}</span>
              {due && <StatusBadge status="DUE" tone="warning" label="Due" />}
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Wards"
        description={
          wards.data ? (
            <span className="tabular-nums">
              {totals.occupied} of {totals.beds} beds occupied across {wards.data.length} wards
            </span>
          ) : (
            "Bed occupancy and current inpatients."
          )
        }
        actions={
          role && ADMIT_ROLES.includes(role) && wards.data ? <AdmitPatientDialog wards={wards.data} defaultWardId={wardId} /> : undefined
        }
      />

      {wards.isLoading ? (
        <CardsSkeleton count={4} />
      ) : wards.error ? (
        <ErrorState error={wards.error} onRetry={() => wards.refetch()} />
      ) : !wards.data?.length ? (
        <EmptyState icon={BedDouble} title="No wards configured" description="Your hospital admin can add wards to departments." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Wards">
          {wards.data.map((w) => {
            const pct = w.totalBeds ? Math.round((w.occupiedBeds / w.totalBeds) * 100) : 0;
            const free = w.totalBeds - w.occupiedBeds;
            const active = w.id === wardId;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setWardId(active ? undefined : w.id);
                    setPage(1);
                  }}
                  className={cn(
                    "bg-card hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-ring w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                    active && "border-primary bg-accent/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{w.name}</p>
                      <p className="text-muted-foreground truncate text-xs">{w.departmentName}</p>
                    </div>
                    {free <= 0 ? (
                      <StatusBadge status="FULL" tone="danger" label="Full" />
                    ) : pct >= 85 ? (
                      <StatusBadge status="NEAR" tone="warning" label="Near full" />
                    ) : null}
                  </div>
                  <p className="font-heading mt-3 text-2xl font-semibold tabular-nums">
                    {w.occupiedBeds}
                    <span className="text-muted-foreground text-sm font-normal"> / {w.totalBeds} beds</span>
                  </p>
                  <Progress value={pct} className="mt-2" aria-label={`${w.name} occupancy ${pct}%`} />
                  <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
                    {pct}% occupied · {Math.max(free, 0)} free
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="inpatients-heading" className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="inpatients-heading" className="text-base font-semibold">
            Current inpatients
          </h2>
          {selectedWard && (
            <Button
              size="xs"
              variant="secondary"
              onClick={() => setWardId(undefined)}
              aria-label={`Clear ward filter ${selectedWard.name}`}
            >
              {selectedWard.name} <X />
            </Button>
          )}
          <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 text-xs">
            <Clock className="size-3.5" aria-hidden /> Vitals are due every 4 hours
          </span>
        </div>
        <DataTable
          caption="Current inpatients"
          columns={columns}
          data={admissions.data?.data}
          isLoading={admissions.isLoading}
          isFetching={admissions.isFetching}
          error={admissions.error}
          onRetry={() => admissions.refetch()}
          meta={admissions.data?.meta}
          onPageChange={setPage}
          rowHref={(a) => ROUTES.admission(a.id)}
          getRowId={(a) => a.id}
          toolbar={
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search patient, MRN, bed or diagnosis"
              aria-label="Search inpatients"
              className="sm:w-80"
            />
          }
          emptyState={
            <EmptyState
              icon={BedDouble}
              title={search || wardId ? "No inpatients match" : "No current inpatients"}
              description={search || wardId ? "Try another ward or search term." : undefined}
            />
          }
        />
      </section>
    </div>
  );
}
