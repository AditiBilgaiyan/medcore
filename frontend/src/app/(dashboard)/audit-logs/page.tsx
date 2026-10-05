"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FileSearch, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { DateRangeFilter, lastNDays, type DateRange } from "@/components/shared/date-range-filter";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { AUDIT_ACTION_TONE } from "@/components/modules/dashboard/common";
import { ROLE_LABELS } from "@/constants/roles";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime, formatRelative, humanize } from "@/lib/format";
import { useAuditLogs } from "@/services/admin";
import type { AuditAction, AuditLog } from "@/types";

const ACTIONS: AuditAction[] = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"];

/** Entity types written by the API's audit interceptor. */
const ENTITY_TYPES = [
  "Admission",
  "Appointment",
  "Attachment",
  "Availability",
  "Department",
  "Doctor",
  "Hospital",
  "InsuranceClaim",
  "Invoice",
  "LabOrder",
  "MedicalRecord",
  "MedicationAdministration",
  "Medicine",
  "MedicineBatch",
  "Patient",
  "Prescription",
  "RecordNote",
  "User",
  "Vaccination",
  "Vitals",
];

const ALL = "all";
const DEFAULT_DAYS = 30;

/** "InsuranceClaim" -> "Insurance claim" */
function entityLabel(type: string) {
  const s = type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function AuditLogsPage() {
  const { role } = useAuth();
  const [action, setAction] = useState<string>(ALL);
  const [entityType, setEntityType] = useState<string>(ALL);
  const [range, setRange] = useState<DateRange>(() => lastNDays(DEFAULT_DAYS));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, error, refetch } = useAuditLogs({
    page,
    limit: 25,
    action: action === ALL ? undefined : [action],
    entityType: entityType === ALL ? undefined : [entityType],
    from: range.from,
    to: range.to,
    search: search.trim() || undefined,
  });

  const defaults = lastNDays(DEFAULT_DAYS);
  const filtered = action !== ALL || entityType !== ALL || !!search || range.from !== defaults.from || range.to !== defaults.to;
  const reset = () => {
    setAction(ALL);
    setEntityType(ALL);
    setRange(lastNDays(DEFAULT_DAYS));
    setSearch("");
    setPage(1);
  };
  const withPageReset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        id: "time",
        header: "When",
        size: 150,
        cell: ({ row }) => (
          <time dateTime={row.original.createdAt} className="block whitespace-nowrap">
            <span className="block text-sm tabular-nums">{formatDateTime(row.original.createdAt)}</span>
            <span className="text-muted-foreground block text-xs">{formatRelative(row.original.createdAt)}</span>
          </time>
        ),
      },
      {
        id: "user",
        header: "User",
        cell: ({ row }) => (
          <div className="flex min-w-40 items-center gap-2">
            <UserAvatar name={row.original.userName} className="size-7" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.original.userName}</p>
              <p className="text-muted-foreground truncate text-xs">{ROLE_LABELS[row.original.userRole]}</p>
            </div>
          </div>
        ),
      },
      {
        id: "action",
        header: "Action",
        size: 100,
        cell: ({ row }) => <StatusBadge status={row.original.action} tone={AUDIT_ACTION_TONE[row.original.action]} />,
      },
      {
        id: "entity",
        header: "Entity",
        cell: ({ row }) => (
          <div className="min-w-32">
            <p className="text-sm">{entityLabel(row.original.entityType)}</p>
            <p className="text-muted-foreground truncate font-mono text-xs" title={row.original.entityId}>
              {row.original.entityId}
            </p>
          </div>
        ),
      },
      {
        id: "summary",
        header: "Summary",
        cell: ({ row }) => <p className="max-w-md min-w-48 text-sm text-pretty">{row.original.summary}</p>,
      },
      {
        id: "ip",
        header: "IP address",
        size: 110,
        cell: ({ row }) => <span className="text-muted-foreground font-mono text-xs">{row.original.ip}</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        description={
          role === "SUPER_ADMIN"
            ? "Every create, update, delete and sign-in across the platform. Entries are append-only."
            : "Every create, update, delete and sign-in in your hospital. Entries are append-only."
        }
      />
      <DataTable
        columns={columns}
        data={data?.data}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => refetch()}
        meta={data?.meta}
        onPageChange={setPage}
        getRowId={(r) => r.id}
        caption="Audit log entries"
        emptyState={
          <EmptyState
            icon={FileSearch}
            title="No matching entries"
            description={filtered ? "Try widening the date range or clearing filters." : "Activity will appear here as people use MedCore."}
            action={
              filtered ? (
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw aria-hidden /> Reset filters
                </Button>
              ) : undefined
            }
          />
        }
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={withPageReset(setSearch)}
              placeholder="Search user, summary or ID…"
              aria-label="Search audit log"
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="audit-action" className="sr-only">
                Action
              </Label>
              <Select value={action} onValueChange={withPageReset(setAction)}>
                <SelectTrigger id="audit-action" className="w-full sm:w-36">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All actions</SelectItem>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {humanize(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label htmlFor="audit-entity" className="sr-only">
                Entity type
              </Label>
              <Select value={entityType} onValueChange={withPageReset(setEntityType)}>
                <SelectTrigger id="audit-entity" className="w-full sm:w-44">
                  <SelectValue placeholder="Entity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All entity types</SelectItem>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {entityLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateRangeFilter value={range} onChange={withPageReset(setRange)} />
            {filtered && (
              <Button variant="ghost" size="sm" onClick={reset} className="sm:ml-auto">
                <RotateCcw aria-hidden /> Reset
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}
