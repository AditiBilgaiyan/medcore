"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, FlaskConical, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LabResultsTable } from "@/components/shared/clinical";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { formatCurrency, formatDate, formatDateTime, formatTime, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppointments } from "@/services/appointments";
import { useInvoices } from "@/services/billing";
import { usePatientRecords } from "@/services/emr";
import { useLabOrders } from "@/services/lab";
import { usePrescriptions } from "@/services/prescriptions";
import type { Appointment, Invoice, MedicalRecord, PaginationMeta, Prescription } from "@/types";
import { RecordDetails } from "@/components/modules/emr/record-details";

function Pager({ meta, onPage }: { meta?: PaginationMeta; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 pt-3">
      <Button variant="outline" size="sm" onClick={() => onPage(meta.page - 1)} disabled={meta.page <= 1}>
        <ChevronLeft /> Previous
      </Button>
      <span className="text-muted-foreground text-xs tabular-nums">
        Page {meta.page} of {meta.totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={() => onPage(meta.page + 1)} disabled={meta.page >= meta.totalPages}>
        Next <ChevronRight />
      </Button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

/* ---------------- Visits ---------------- */

export function VisitsTab({ patientId }: { patientId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = usePatientRecords(patientId, { page, limit: 10 });
  if (isLoading) return <ListSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data?.data.length)
    return (
      <EmptyState icon={Stethoscope} title="No visits yet" description="Encounter records appear here once a doctor starts a visit." />
    );
  return (
    <div>
      <ol className="before:bg-border relative space-y-3 before:absolute before:top-4 before:bottom-4 before:left-[0.6875rem] before:w-px">
        {data.data.map((r, i) => (
          <VisitItem key={r.id} record={r} defaultOpen={i === 0 && page === 1} />
        ))}
      </ol>
      <Pager meta={data.meta} onPage={setPage} />
    </div>
  );
}

function VisitItem({ record, defaultOpen }: { record: MedicalRecord; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const primary = record.diagnoses[0];
  return (
    <li className="relative pl-8">
      <span
        className={cn(
          "ring-background absolute top-4 left-1.5 size-3 rounded-full ring-4",
          record.isFinalised ? "bg-primary" : "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      <Collapsible open={open} onOpenChange={setOpen}>
        <Card className="gap-0 py-0">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="hover:bg-muted/40 focus-visible:outline-ring flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline-2"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <time dateTime={record.createdAt} className="font-medium tabular-nums">
                    {formatDate(record.createdAt)}
                  </time>
                  <span className="text-muted-foreground">
                    {record.doctorName} · {record.departmentName}
                  </span>
                  {!record.isFinalised && <StatusBadge status="IN_PROGRESS" label="In progress" />}
                </p>
                <p className="text-muted-foreground truncate text-sm">
                  {primary ? (
                    <>
                      <span className="font-mono text-xs">{primary.code}</span> {primary.description}
                      {record.diagnoses.length > 1 && ` +${record.diagnoses.length - 1} more`}
                    </>
                  ) : (
                    record.chiefComplaint || "No diagnosis recorded"
                  )}
                </p>
              </div>
              <ChevronDown
                className={cn("text-muted-foreground mt-1 size-4 shrink-0 transition-transform", open && "rotate-180")}
                aria-hidden
              />
              <span className="sr-only">{open ? "Collapse" : "Expand"} visit details</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t px-4 py-4">
              <RecordDetails record={record} />
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </li>
  );
}

/* ---------------- Appointments ---------------- */

export function AppointmentsTab({ patientId }: { patientId: string }) {
  const [page, setPage] = useState(1);
  const q = useAppointments({ patientId, sortOrder: "desc", page, limit: 10 });
  const columns = useMemo<ColumnDef<Appointment>[]>(
    () => [
      {
        id: "when",
        header: "Date & time",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatDate(row.original.date)} · {formatTime(row.original.startTime)}
          </span>
        ),
      },
      { id: "doctor", header: "Doctor", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.doctorName}</span> },
      { id: "dept", header: "Department", cell: ({ row }) => row.original.departmentName },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => (row.original.isEmergency ? <StatusBadge status="EMERGENCY" /> : <span>{humanize(row.original.type)}</span>),
      },
      { id: "reason", header: "Reason", cell: ({ row }) => <span className="line-clamp-1 max-w-64">{row.original.reason}</span> },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );
  return (
    <DataTable
      caption="Appointments"
      columns={columns}
      data={q.data?.data}
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      error={q.error}
      onRetry={() => q.refetch()}
      meta={q.data?.meta}
      onPageChange={setPage}
      rowHref={(a) => ROUTES.appointment(a.id)}
      skeletonRows={4}
      emptyState={<EmptyState title="No appointments" description="This patient has no appointments yet." />}
    />
  );
}

/* ---------------- Lab results ---------------- */

export function LabResultsTab({ patientId }: { patientId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useLabOrders({ patientId, page, limit: 10 });
  if (isLoading) return <ListSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data?.data.length)
    return <EmptyState icon={FlaskConical} title="No lab orders" description="Tests ordered during visits appear here." />;
  return (
    <div className="space-y-3">
      {data.data.map((o) => (
        <Card key={o.id} className="gap-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={ROUTES.labOrder(o.id)} className="font-mono font-medium hover:underline">
                  {o.number}
                </Link>
                <StatusBadge status={o.status} />
                {o.priority !== "ROUTINE" && <StatusBadge status={o.priority} />}
              </p>
              <p className="text-sm">{o.tests.map((t) => t.testName).join(", ")}</p>
              <p className="text-muted-foreground text-xs">
                Ordered {formatDateTime(o.createdAt)} by {o.doctorName}
                {o.approvedAt && ` · Reported ${formatDateTime(o.approvedAt)}`}
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={ROUTES.labOrder(o.id)}>
                View report <ExternalLink />
              </Link>
            </Button>
          </div>
          {o.results.length > 0 && (o.status === "APPROVED" || o.status === "PENDING_APPROVAL") && (
            <div className="space-y-1">
              {o.status === "PENDING_APPROVAL" && <p className="text-muted-foreground text-xs">Preliminary — awaiting approval.</p>}
              <LabResultsTable results={o.results} tests={o.tests} />
            </div>
          )}
        </Card>
      ))}
      <Pager meta={data.meta} onPage={setPage} />
    </div>
  );
}

/* ---------------- Prescriptions ---------------- */

export function PrescriptionsTab({ patientId }: { patientId: string }) {
  const [page, setPage] = useState(1);
  const q = usePrescriptions({ patientId, page, limit: 10 });
  const columns = useMemo<ColumnDef<Prescription>[]>(
    () => [
      {
        id: "number",
        header: "Prescription",
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-sm font-medium">{row.original.number}</p>
            <p className="text-muted-foreground text-xs tabular-nums">{formatDate(row.original.signedAt)}</p>
          </div>
        ),
      },
      { id: "doctor", header: "Prescriber", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.doctorName}</span> },
      {
        id: "items",
        header: "Medicines",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-md">
            {row.original.items.map((i) => `${i.medicineName} ${i.frequency} × ${i.durationDays}d`).join(", ")}
          </span>
        ),
      },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );
  return (
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
      skeletonRows={4}
      emptyState={<EmptyState title="No prescriptions" description="Prescriptions issued during visits appear here." />}
    />
  );
}

/* ---------------- Invoices ---------------- */

export function InvoicesTab({ patientId }: { patientId: string }) {
  const [page, setPage] = useState(1);
  const q = useInvoices({ patientId, page, limit: 10 });
  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        id: "number",
        header: "Invoice",
        cell: ({ row }) => (
          <Link
            href={ROUTES.invoice(row.original.id)}
            className="font-mono text-sm font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            {row.original.number}
          </Link>
        ),
      },
      {
        id: "date",
        header: "Date",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">{formatDate(row.original.issuedAt ?? row.original.createdAt)}</span>
        ),
      },
      {
        id: "total",
        header: () => <span className="block text-right">Total</span>,
        cell: ({ row }) => <span className="block text-right tabular-nums">{formatCurrency(row.original.total)}</span>,
      },
      {
        id: "balance",
        header: () => <span className="block text-right">Balance</span>,
        cell: ({ row }) => (
          <span className={cn("block text-right tabular-nums", row.original.balanceDue > 0 && "font-medium")}>
            {formatCurrency(row.original.balanceDue)}
          </span>
        ),
      },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );
  return (
    <DataTable
      caption="Invoices"
      columns={columns}
      data={q.data?.data}
      isLoading={q.isLoading}
      isFetching={q.isFetching}
      error={q.error}
      onRetry={() => q.refetch()}
      meta={q.data?.meta}
      onPageChange={setPage}
      rowHref={(inv) => ROUTES.invoice(inv.id)}
      skeletonRows={4}
      emptyState={<EmptyState title="No invoices" description="Bills for this patient appear here." />}
    />
  );
}
