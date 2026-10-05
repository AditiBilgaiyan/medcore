"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { CalendarPlus, CalendarX2, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AppointmentActions } from "@/components/modules/appointments/appointment-actions";
import { DayBoard } from "@/components/modules/appointments/day-board";
import { friendlyDate, shiftISODate, STATUS_LABEL, todayISO } from "@/components/modules/appointments/utils";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { DetailSkeleton, EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_PAGE_SIZE } from "@/constants/config";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatTime } from "@/lib/format";
import { useDepartments } from "@/services/admin";
import { useAppointments } from "@/services/appointments";
import { useDoctors } from "@/services/doctors";
import { APPOINTMENT_STATUSES, type Appointment, type AppointmentStatus } from "@/types";

const ALL = "all";
const POLL_MS = 60_000;

const columns: ColumnDef<Appointment>[] = [
  {
    id: "time",
    header: "Time",
    size: 110,
    cell: ({ row: { original: a } }) => (
      <div className="tabular-nums">
        <p className="font-medium">{formatTime(a.startTime)}</p>
        <p className="text-muted-foreground text-xs">{formatTime(a.endTime)}</p>
      </div>
    ),
  },
  {
    id: "patient",
    header: "Patient",
    cell: ({ row: { original: a } }) => (
      <div className="min-w-36">
        <p className="font-medium">{a.patientName}</p>
        <p className="text-muted-foreground text-xs tabular-nums">{a.patientMrn}</p>
      </div>
    ),
  },
  { id: "doctor", header: "Doctor", cell: ({ row: { original: a } }) => <span className="whitespace-nowrap">{a.doctorName}</span> },
  {
    id: "department",
    header: "Department",
    cell: ({ row: { original: a } }) => <span className="text-muted-foreground whitespace-nowrap">{a.departmentName}</span>,
  },
  {
    id: "type",
    header: "Type",
    cell: ({ row: { original: a } }) =>
      a.isEmergency || a.type === "EMERGENCY" ? (
        <StatusBadge status="EMERGENCY" label="Emergency" />
      ) : (
        <span className="text-muted-foreground whitespace-nowrap">{a.type === "FOLLOW_UP" ? "Follow-up" : "Consultation"}</span>
      ),
  },
  { id: "status", header: "Status", cell: ({ row: { original: a } }) => <StatusBadge status={a.status} /> },
  {
    id: "reason",
    header: "Reason",
    cell: ({ row: { original: a } }) => (
      <p className="text-muted-foreground max-w-56 truncate" title={a.reason}>
        {a.reason}
      </p>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    size: 56,
    cell: ({ row: { original: a } }) => <AppointmentActions appt={a} variant="menu" />,
  },
];

function AppointmentsView() {
  const { user, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const date = params.get("date") || todayISO();
  const view = params.get("view") === "board" ? "board" : "list";
  const doctorParam = params.get("doctorId");
  const doctorId = doctorParam === ALL ? "" : doctorParam || (user?.role === "DOCTOR" ? (user.doctorId ?? "") : "");
  const departmentId = params.get("departmentId") ?? "";

  const [statuses, setStatuses] = useState<AppointmentStatus[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    setPage(1);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const departments = useDepartments();
  const doctors = useDoctors({ departmentId: departmentId || undefined });

  const baseQuery = {
    date,
    doctorId: doctorId || undefined,
    departmentId: departmentId || undefined,
    status: statuses.length ? statuses : undefined,
    search: search || undefined,
  };
  const list = useAppointments({ ...baseQuery, page, limit: DEFAULT_PAGE_SIZE }, { enabled: view === "list", refetchInterval: POLL_MS });
  const board = useAppointments({ ...baseQuery, limit: 200 }, { enabled: view === "board", refetchInterval: POLL_MS });

  const filtersActive = !!(statuses.length || search || departmentId || (doctorId && user?.role !== "DOCTOR"));
  const clearFilters = () => {
    setStatuses([]);
    setSearch("");
    setParams({ departmentId: null, doctorId: user?.role === "DOCTOR" ? ALL : null });
  };

  const statusLabel = useMemo(
    () => (statuses.length === 0 ? "All statuses" : statuses.length === 1 ? STATUS_LABEL[statuses[0]] : `${statuses.length} statuses`),
    [statuses],
  );

  return (
    <>
      <PageHeader
        title="Appointments"
        description={
          <>
            {format(parseISO(date), "EEEE, dd MMMM yyyy")}
            {date === todayISO() && " · Today"} · refreshes every minute
          </>
        }
        actions={
          can("appointments:create") && (
            <Button asChild>
              <Link href={ROUTES.appointmentNew}>
                <CalendarPlus /> Book appointment
              </Link>
            </Button>
          )
        }
      />

      <Tabs value={view} onValueChange={(v) => setParams({ view: v === "board" ? "board" : null })} className="gap-3">
        <div className="bg-card flex flex-col gap-3 rounded-xl border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1" role="group" aria-label="Date">
              <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => setParams({ date: shiftISODate(date, -1) })}>
                <ChevronLeft />
              </Button>
              <Label htmlFor="appt-date" className="sr-only">
                Date
              </Label>
              <Input
                id="appt-date"
                type="date"
                value={date}
                onChange={(e) => e.target.value && setParams({ date: e.target.value })}
                className="w-40 tabular-nums"
              />
              <Button variant="outline" size="icon" aria-label="Next day" onClick={() => setParams({ date: shiftISODate(date, 1) })}>
                <ChevronRight />
              </Button>
              {date !== todayISO() && (
                <Button variant="ghost" onClick={() => setParams({ date: null })}>
                  Today
                </Button>
              )}
            </div>
            <TabsList className="ml-auto">
              <TabsTrigger value="list">
                <List aria-hidden /> List
              </TabsTrigger>
              <TabsTrigger value="board">
                <LayoutGrid aria-hidden /> Day board
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Select
              value={doctorId || ALL}
              onValueChange={(v) => setParams({ doctorId: v === ALL ? (user?.role === "DOCTOR" ? ALL : null) : v })}
            >
              <SelectTrigger className="w-full sm:w-52" aria-label="Doctor">
                <SelectValue placeholder="All doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All doctors</SelectItem>
                {doctors.data?.data.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Dr. {d.firstName} {d.lastName}
                    {d.id === user?.doctorId ? " (me)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={departmentId || ALL} onValueChange={(v) => setParams({ departmentId: v === ALL ? null : v })}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Department">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {departments.data?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between sm:w-44" aria-label={`Status filter: ${statusLabel}`}>
                  {statusLabel} <ChevronDown className="opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {APPOINTMENT_STATUSES.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={statuses.includes(s)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) => {
                      setPage(1);
                      setStatuses((prev) => (checked ? [...prev, s] : prev.filter((x) => x !== s)));
                    }}
                  >
                    {STATUS_LABEL[s]}
                  </DropdownMenuCheckboxItem>
                ))}
                {statuses.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setStatuses([])}>Clear status filter</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <SearchInput
              value={search}
              onChange={(v) => {
                setPage(1);
                setSearch(v);
              }}
              placeholder="Search patient, MRN, reason…"
              className="sm:ml-auto"
            />
            {filtersActive && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="list">
          <DataTable
            caption={`Appointments on ${friendlyDate(date)}`}
            columns={columns}
            data={list.data?.data}
            isLoading={list.isLoading}
            isFetching={list.isFetching}
            error={list.error}
            onRetry={() => void list.refetch()}
            meta={list.data?.meta}
            onPageChange={setPage}
            rowHref={(a) => ROUTES.appointment(a.id)}
            getRowId={(a) => a.id}
            rowClassName={(a) => (a.isEmergency ? "bg-destructive/5 hover:bg-destructive/10" : undefined)}
            emptyState={
              <EmptyState
                icon={CalendarX2}
                title={
                  filtersActive
                    ? "No appointments match these filters"
                    : `No appointments ${date === todayISO() ? "today" : `on ${friendlyDate(date)}`}`
                }
                description={filtersActive ? "Try clearing the filters." : "Pick another date, or book one now."}
                action={
                  filtersActive ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </TabsContent>
        <TabsContent value="board">
          <DayBoard
            appointments={board.data?.data}
            doctors={doctors.data?.data}
            isLoading={board.isLoading}
            isFetching={board.isFetching}
            error={board.error}
            onRetry={() => void board.refetch()}
            pinnedDoctorId={doctorId || undefined}
            truncated={(board.data?.meta.total ?? 0) > (board.data?.data.length ?? 0)}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <AppointmentsView />
    </Suspense>
  );
}
