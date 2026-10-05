"use client";

import { addDays, format, parseISO } from "date-fns";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FlaskConical,
  Loader2,
  ScrollText,
  Search,
  Stethoscope,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { ageGender, formatRelative, formatTime, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppointments } from "@/services/appointments";
import { useLabOrders } from "@/services/lab";
import { usePatients } from "@/services/patients";
import { usePrescriptions } from "@/services/prescriptions";
import type { Appointment, LabOrder, LabOrderStatus } from "@/types";
import { CountPill, DashboardHeader, LinkRow, statusBarClass, todayIso, ViewAllLink, WidgetState } from "./common";

const OPEN_LAB: LabOrderStatus[] = ["ORDERED", "SAMPLE_COLLECTED", "PROCESSING", "PENDING_APPROVAL"];

export function DoctorDashboard() {
  const { user } = useAuth();
  const doctorId = user?.doctorId;
  const today = todayIso();
  const appts = useAppointments({ date: today, doctorId, limit: 100 }, { enabled: !!doctorId, refetchInterval: 60_000 });
  const openLabs = useLabOrders({ doctorId, status: OPEN_LAB, limit: 6 }, { enabled: !!doctorId });

  const list = useMemo(() => [...(appts.data?.data ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime)), [appts.data]);
  const completed = list.filter((a) => a.status === "COMPLETED").length;
  const remaining = list.filter((a) => ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(a.status)).length;

  if (!doctorId) {
    return (
      <div className="space-y-4">
        <DashboardHeader />
        <EmptyState
          icon={Stethoscope}
          title="No doctor profile linked"
          description="Ask your hospital admin to link your account to a doctor profile."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardHeader />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Today's appointments"
          value={list.length}
          icon={CalendarDays}
          loading={appts.isLoading}
          href={ROUTES.appointments}
        />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} tone="success" loading={appts.isLoading} />
        <StatCard label="Remaining" value={remaining} icon={CalendarClock} tone="warning" loading={appts.isLoading} />
        <StatCard
          label="Labs pending"
          value={openLabs.data?.meta.total ?? 0}
          icon={FlaskConical}
          tone="neutral"
          loading={openLabs.isLoading}
          href={ROUTES.lab}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <TodayTimeline
          className="xl:col-span-2"
          list={list}
          isLoading={appts.isLoading}
          error={appts.error}
          onRetry={() => appts.refetch()}
        />
        <div className="space-y-4">
          <PatientLookup />
          <FollowUpCalendar doctorId={doctorId} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PendingLabs doctorId={doctorId} open={openLabs} />
        <RecentPrescriptions doctorId={doctorId} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TodayTimeline({
  list,
  isLoading,
  error,
  onRetry,
  className,
}: {
  list: Appointment[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  className?: string;
}) {
  const nowTime = format(new Date(), "HH:mm");
  const nextId = list.find((a) => a.status === "CONFIRMED" && a.endTime >= nowTime)?.id;

  return (
    <SectionCard
      className={className}
      title={
        <>
          Today&apos;s schedule
          <CountPill count={isLoading ? undefined : list.length} label="appointments" />
        </>
      }
      description="Sorted by time. Open an encounter from any confirmed or in-progress visit."
      action={<ViewAllLink href={ROUTES.appointments}>All appointments</ViewAllLink>}
    >
      <WidgetState
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={list.length === 0}
        rows={5}
        empty={{ icon: CalendarDays, title: "No appointments today", description: "Enjoy the quiet — new bookings will appear here." }}
      >
        <ol className="space-y-2" aria-label="Today's appointments">
          {list.map((a) => {
            const actionable = a.status === "CONFIRMED" || a.status === "IN_PROGRESS";
            const href = actionable ? ROUTES.encounter(a.id) : ROUTES.appointment(a.id);
            const dim = a.status === "CANCELLED" || a.status === "NO_SHOW";
            return (
              <li key={a.id}>
                <Link
                  href={href}
                  className={cn(
                    "bg-card hover:bg-accent/40 focus-visible:outline-ring relative flex items-start gap-3 overflow-hidden rounded-lg border py-2.5 pr-3 pl-4 transition-colors focus-visible:outline-2",
                    a.id === nextId && "border-primary/50 bg-accent/20",
                    a.status === "IN_PROGRESS" && "border-violet-300 dark:border-violet-500/40",
                  )}
                >
                  <span className={cn("absolute inset-y-0 left-0 w-1", statusBarClass(a.status))} aria-hidden />
                  <div className="w-16 shrink-0 tabular-nums">
                    <p className="text-sm font-semibold">{formatTime(a.startTime)}</p>
                    <p className="text-muted-foreground text-xs">{formatTime(a.endTime)}</p>
                  </div>
                  <div className={cn("min-w-0 flex-1", dim && "opacity-70")}>
                    <p className={cn("truncate text-sm font-medium", dim && "decoration-muted-foreground/60 line-through")}>
                      {a.patientName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {a.patientMrn} · {humanize(a.type)}
                      {a.reason && ` · ${a.reason}`}
                    </p>
                    {actionable && (
                      <p className="text-primary mt-1 text-xs font-medium">
                        {a.status === "IN_PROGRESS" ? "Continue encounter" : "Start encounter"}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={a.status} />
                    {a.isEmergency && <StatusBadge status="EMERGENCY" label="Emergency" />}
                    {a.id === nextId && <span className="text-primary text-[11px] font-medium">Up next</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </WidgetState>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function PatientLookup() {
  const [text, setText] = useState("");
  const q = useDebounce(text.trim(), 300);
  const enabled = q.length >= 2;
  const { data, isFetching, isLoading } = usePatients({ search: q, limit: 6 }, { enabled });
  const results = enabled ? (data?.data ?? []) : [];

  return (
    <SectionCard title="Quick patient lookup" description="Search by name, MRN or phone.">
      <div className="space-y-3">
        <div className="relative">
          <Label htmlFor="doctor-patient-lookup" className="sr-only">
            Search patients
          </Label>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
          <Input
            id="doctor-patient-lookup"
            type="search"
            placeholder="e.g. Aarav or CCH-000123"
            className="pl-8"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
          />
          {enabled && isFetching && (
            <Loader2 className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" aria-hidden />
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {enabled && !isFetching ? `${results.length} patient${results.length === 1 ? "" : "s"} found` : ""}
        </p>
        {!enabled ? (
          <p className="text-muted-foreground text-xs">Type at least 2 characters.</p>
        ) : isLoading ? (
          <p className="text-muted-foreground text-xs">Searching…</p>
        ) : results.length === 0 ? (
          <EmptyState compact icon={UserRound} title="No matching patients" />
        ) : (
          <ul className="-mx-2">
            {results.map((p) => (
              <li key={p.id}>
                <LinkRow href={ROUTES.patient(p.id)}>
                  <UserAvatar name={`${p.firstName} ${p.lastName}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {p.mrn} · {ageGender(p.dob, p.gender)}
                    </span>
                  </span>
                  {p.allergies.length > 0 && (
                    <StatusBadge
                      status="SEVERE"
                      tone="danger"
                      label={`${p.allergies.length} allerg${p.allergies.length === 1 ? "y" : "ies"}`}
                    />
                  )}
                </LinkRow>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function FollowUpCalendar({ doctorId }: { doctorId: string }) {
  const today = new Date();
  const from = todayIso();
  const to = format(addDays(today, 30), "yyyy-MM-dd");
  const [selected, setSelected] = useState<Date | undefined>(today);
  const { data, isLoading, error, refetch } = useAppointments({ doctorId, from, to, status: ["PENDING", "CONFIRMED"], limit: 200 });

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of data?.data ?? []) map.set(a.date, [...(map.get(a.date) ?? []), a]);
    return map;
  }, [data]);

  const bookedDays = useMemo(() => [...byDate.keys()].map((d) => parseISO(d)), [byDate]);
  const followUpDays = useMemo(
    () => [...byDate.entries()].filter(([, l]) => l.some((a) => a.type === "FOLLOW_UP")).map(([d]) => parseISO(d)),
    [byDate],
  );
  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : undefined;
  const dayList = (selectedKey && byDate.get(selectedKey)) || [];
  const followUps = (data?.data ?? []).filter((a) => a.type === "FOLLOW_UP").length;

  return (
    <SectionCard
      title={
        <>
          Upcoming follow-ups
          <CountPill count={isLoading ? undefined : followUps} label="follow-ups in the next 30 days" />
        </>
      }
      description="Your next 30 days. Pick a day to see who's booked."
    >
      <WidgetState isLoading={isLoading} error={error} onRetry={() => refetch()} isEmpty={false} rows={3} empty={{ title: "" }}>
        <div className="space-y-3">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            startMonth={today}
            endMonth={addDays(today, 30)}
            className="mx-auto rounded-lg border p-2"
            modifiers={{ booked: bookedDays, followUp: followUpDays }}
            modifiersClassNames={{
              booked:
                "[&>button]:font-semibold after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:z-20 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
              followUp: "[&>button]:underline [&>button]:decoration-2 [&>button]:underline-offset-4 after:bg-amber-500",
            }}
            labels={{
              labelDayButton: (date, modifiers) => {
                const l = byDate.get(format(date, "yyyy-MM-dd"));
                const fu = l?.filter((a) => a.type === "FOLLOW_UP").length ?? 0;
                return [
                  modifiers.today ? "Today" : null,
                  format(date, "EEEE, d MMMM yyyy"),
                  l ? `${l.length} appointment${l.length === 1 ? "" : "s"}` : null,
                  fu ? `${fu} follow-up${fu === 1 ? "" : "s"}` : null,
                  modifiers.selected ? "selected" : null,
                ]
                  .filter(Boolean)
                  .join(", ");
              },
            }}
          />
          <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="bg-primary size-1.5 rounded-full" aria-hidden /> <span className="text-foreground font-semibold">Bold</span>{" "}
              = booked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
              <span className="text-foreground font-semibold underline decoration-2 underline-offset-4">Underlined</span> = follow-up
            </span>
          </div>
          <div aria-live="polite">
            <h2 className="text-muted-foreground mb-1.5 text-xs font-semibold uppercase">
              {selected ? format(selected, "EEE, d MMM") : "No day selected"}
            </h2>
            {dayList.length === 0 ? (
              <p className="text-muted-foreground text-sm">No appointments.</p>
            ) : (
              <ul className="-mx-2 max-h-56 overflow-y-auto">
                {dayList.map((a) => (
                  <li key={a.id}>
                    <LinkRow href={ROUTES.appointment(a.id)}>
                      <span className="w-16 shrink-0 text-xs font-semibold tabular-nums">{formatTime(a.startTime)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{a.patientName}</span>
                      {a.type === "FOLLOW_UP" ? (
                        <StatusBadge status="FOLLOW_UP" tone="warning" label="Follow-up" />
                      ) : (
                        <StatusBadge status={a.status} />
                      )}
                    </LinkRow>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </WidgetState>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function resultSummary(o: LabOrder) {
  const abnormal = o.results.filter((r) => r.flag !== "NORMAL");
  if (abnormal.some((r) => r.flag === "CRITICAL")) return <StatusBadge status="CRITICAL" label="Critical" />;
  if (abnormal.length) return <StatusBadge status="HIGH" tone="warning" label={`${abnormal.length} abnormal`} />;
  return <StatusBadge status="NORMAL" label="Normal" />;
}

function PendingLabs({ doctorId, open }: { doctorId: string; open: ReturnType<typeof useLabOrders> }) {
  const recent = useLabOrders({ doctorId, status: ["APPROVED"], limit: 5 });
  const openList = open.data?.data ?? [];
  const recentList = recent.data?.data ?? [];

  return (
    <SectionCard
      title="Lab results"
      description="Orders still in the lab, and recently approved reports."
      action={<ViewAllLink href={ROUTES.lab} />}
    >
      <div className="space-y-4">
        <div>
          <h2 className="text-muted-foreground mb-1.5 text-xs font-semibold uppercase">
            Pending <CountPill count={open.data?.meta.total} label="pending orders" />
          </h2>
          <WidgetState
            isLoading={open.isLoading}
            error={open.error}
            onRetry={() => open.refetch()}
            isEmpty={openList.length === 0}
            rows={3}
            empty={{ icon: FlaskConical, title: "Nothing pending in the lab" }}
          >
            <ul className="-mx-2">
              {openList.map((o) => (
                <li key={o.id}>
                  <LinkRow href={ROUTES.labOrder(o.id)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{o.patientName}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {o.number} · {o.tests.map((t) => t.testName).join(", ")}
                      </span>
                    </span>
                    {o.priority !== "ROUTINE" && <StatusBadge status={o.priority} />}
                    <StatusBadge status={o.status} />
                  </LinkRow>
                </li>
              ))}
            </ul>
          </WidgetState>
        </div>
        <div>
          <h2 className="text-muted-foreground mb-1.5 text-xs font-semibold uppercase">Recently approved</h2>
          <WidgetState
            isLoading={recent.isLoading}
            error={recent.error}
            onRetry={() => recent.refetch()}
            isEmpty={recentList.length === 0}
            rows={3}
            empty={{ icon: CalendarCheck2, title: "No approved reports yet" }}
          >
            <ul className="-mx-2">
              {recentList.map((o) => (
                <li key={o.id}>
                  <LinkRow href={ROUTES.labOrder(o.id)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{o.patientName}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {o.tests.map((t) => t.testName).join(", ")} · approved {formatRelative(o.approvedAt ?? o.updatedAt)}
                      </span>
                    </span>
                    {resultSummary(o)}
                  </LinkRow>
                </li>
              ))}
            </ul>
          </WidgetState>
        </div>
      </div>
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */

function RecentPrescriptions({ doctorId }: { doctorId: string }) {
  const { data, isLoading, error, refetch } = usePrescriptions({ doctorId, limit: 5 });
  const list = data?.data ?? [];
  return (
    <SectionCard title="Recent prescriptions" description="The last five you signed." action={<ViewAllLink href={ROUTES.prescriptions} />}>
      <WidgetState
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        isEmpty={list.length === 0}
        rows={5}
        empty={{ icon: ScrollText, title: "No prescriptions yet" }}
      >
        <ul className="-mx-2">
          {list.map((rx) => (
            <li key={rx.id}>
              <LinkRow href={ROUTES.prescription(rx.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {rx.patientName} <span className="text-muted-foreground font-normal">· {rx.number}</span>
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {rx.items.map((i) => i.medicineName).join(", ")} · {formatRelative(rx.createdAt)}
                  </span>
                </span>
                <StatusBadge status={rx.status} />
              </LinkRow>
            </li>
          ))}
        </ul>
      </WidgetState>
    </SectionCard>
  );
}
