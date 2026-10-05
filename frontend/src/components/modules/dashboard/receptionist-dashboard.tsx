"use client";

import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  FileText,
  IndianRupee,
  Loader2,
  Receipt,
  UserPlus,
  UserX,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Can } from "@/components/shared/guards";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ROUTES } from "@/constants/routes";
import { hasPermission } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth-store";
import { formatCurrency, formatDate, formatNumber, formatTime, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppointments, useUpdateAppointmentStatus } from "@/services/appointments";
import { useBillingSummary } from "@/services/billing";
import type { Appointment, AppointmentStatus } from "@/types";
import { CountPill, DashboardHeader, statusBarClass, todayIso, ViewAllLink, WidgetState } from "./common";

type QueueFilter = "active" | "all";

export function ReceptionistDashboard() {
  const today = todayIso();
  const queue = useAppointments({ date: today, limit: 100 }, { refetchInterval: 30_000 });
  const pending = useAppointments({ from: today, status: ["PENDING"], limit: 20 });
  const billing = useBillingSummary();
  const list = useMemo(() => queue.data?.data ?? [], [queue.data]);
  const b = billing.data;

  const counts = useMemo(() => {
    const c: Partial<Record<AppointmentStatus, number>> = {};
    list.forEach((a) => (c[a.status] = (c[a.status] ?? 0) + 1));
    return c;
  }, [list]);

  return (
    <div className="space-y-4">
      <DashboardHeader
        actions={
          <>
            <Can permission="patients:write">
              <Button variant="outline" asChild>
                <Link href={ROUTES.patientNew}>
                  <UserPlus aria-hidden /> Register patient
                </Link>
              </Button>
            </Can>
            <Can permission="appointments:create">
              <Button asChild>
                <Link href={ROUTES.appointmentNew}>
                  <CalendarPlus aria-hidden /> Book appointment
                </Link>
              </Button>
            </Can>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Today's appointments"
          value={list.length}
          icon={CalendarDays}
          loading={queue.isLoading}
          hint={`${counts.COMPLETED ?? 0} completed`}
        />
        <StatCard
          label="Awaiting confirmation"
          value={pending.data?.meta.total ?? 0}
          icon={CalendarClock}
          tone="warning"
          loading={pending.isLoading}
          hint="Online bookings, today onwards"
        />
        <StatCard
          label="Collected today"
          value={formatCurrency(b?.collectedToday)}
          icon={Wallet}
          tone="success"
          loading={billing.isLoading}
          href={ROUTES.billing}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(b?.outstanding, true)}
          icon={IndianRupee}
          tone="danger"
          loading={billing.isLoading}
          href={ROUTES.billing}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <TodayQueue className="xl:col-span-2" list={list} isLoading={queue.isLoading} error={queue.error} onRetry={() => queue.refetch()} />
        <div className="space-y-4">
          <SectionCard
            title={
              <>
                Pending online bookings
                <CountPill count={pending.data?.meta.total} label="bookings" />
              </>
            }
            description="Confirm to lock in the slot for the patient."
          >
            <WidgetState
              isLoading={pending.isLoading}
              error={pending.error}
              onRetry={() => pending.refetch()}
              isEmpty={(pending.data?.data.length ?? 0) === 0}
              rows={3}
              empty={{ icon: CalendarClock, title: "No bookings waiting" }}
            >
              <ul className="divide-y">
                {pending.data?.data.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <Link
                      href={ROUTES.appointment(a.id)}
                      className="focus-visible:outline-ring min-w-0 flex-1 rounded focus-visible:outline-2"
                    >
                      <span className="block truncate text-sm font-medium hover:underline">{a.patientName}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {a.date === today ? "Today" : formatDate(a.date, "EEE d MMM")} · {formatTime(a.startTime)} · {a.doctorName}
                      </span>
                    </Link>
                    <QueueActions appointment={a} />
                  </li>
                ))}
              </ul>
            </WidgetState>
          </SectionCard>
          <SectionCard title="Billing summary" action={<ViewAllLink href={ROUTES.billing}>Invoices</ViewAllLink>}>
            <WidgetState
              isLoading={billing.isLoading}
              error={billing.error}
              onRetry={() => billing.refetch()}
              isEmpty={!b}
              rows={3}
              empty={{ icon: Receipt, title: "No billing data" }}
            >
              <dl className="grid grid-cols-2 gap-3">
                {[
                  { label: "Invoices today", value: formatNumber(b?.invoicesToday), icon: Receipt },
                  { label: "Draft invoices", value: formatNumber(b?.draftInvoices), icon: FileText },
                  { label: "Collected today", value: formatCurrency(b?.collectedToday), icon: Wallet },
                  { label: "Pending claims", value: formatNumber(b?.pendingClaims), icon: CalendarClock },
                ].map((it) => (
                  <div key={it.label} className="rounded-lg border p-2.5">
                    <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <it.icon className="size-3.5" aria-hidden />
                      {it.label}
                    </dt>
                    <dd className="mt-0.5 text-base font-semibold tabular-nums">{it.value}</dd>
                  </div>
                ))}
              </dl>
            </WidgetState>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function TodayQueue({
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
  const [filter, setFilter] = useState<QueueFilter>("active");
  const shown = filter === "active" ? list.filter((a) => ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(a.status)) : list;

  return (
    <SectionCard
      className={className}
      title={
        <>
          Today&apos;s queue
          <CountPill count={isLoading ? undefined : shown.length} label="appointments shown" />
        </>
      }
      description="Confirm arrivals and mark no-shows. Updates every 30 seconds."
      action={
        <Tabs value={filter} onValueChange={(v) => setFilter(v as QueueFilter)}>
          <TabsList aria-label="Queue filter">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <WidgetState
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        isEmpty={shown.length === 0}
        rows={6}
        empty={{
          icon: CalendarDays,
          title: filter === "active" ? "Queue is clear" : "No appointments today",
          description: filter === "active" ? "Everyone booked for today has been seen or closed." : undefined,
        }}
      >
        <ol className="space-y-2">
          {shown.map((a) => (
            <li
              key={a.id}
              className="relative flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-lg border py-2 pr-2 pl-4 sm:flex-nowrap"
            >
              <span className={cn("absolute inset-y-0 left-0 w-1", statusBarClass(a.status))} aria-hidden />
              <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{formatTime(a.startTime)}</span>
              <Link href={ROUTES.appointment(a.id)} className="focus-visible:outline-ring min-w-0 flex-1 rounded focus-visible:outline-2">
                <span className="block truncate text-sm font-medium hover:underline">{a.patientName}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {a.patientMrn} · {a.doctorName} · {humanize(a.type)}
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {a.isEmergency && <StatusBadge status="EMERGENCY" label="Emergency" />}
                <StatusBadge status={a.status} />
                <QueueActions appointment={a} />
              </div>
            </li>
          ))}
        </ol>
      </WidgetState>
    </SectionCard>
  );
}

/** Confirm (PENDING) / No-show (CONFIRMED) quick actions with optimistic-concurrency version. */
function QueueActions({ appointment: a }: { appointment: Appointment }) {
  const role = useAuthStore((s) => s.user?.role);
  const update = useUpdateAppointmentStatus();
  const [target, setTarget] = useState<AppointmentStatus | null>(null);
  if (!hasPermission(role, "appointments:status")) return null;

  const run = (status: AppointmentStatus) => {
    setTarget(status);
    update.mutate(
      { id: a.id, status, version: a.version },
      {
        onSuccess: () => toast.success(status === "CONFIRMED" ? `Confirmed ${a.patientName}` : `Marked ${a.patientName} as no-show`),
        onSettled: () => setTarget(null),
      },
    );
  };

  if (a.status === "PENDING") {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => run("CONFIRMED")}
        disabled={update.isPending}
        aria-label={`Confirm ${a.patientName}'s appointment`}
      >
        {target === "CONFIRMED" ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        Confirm
      </Button>
    );
  }
  if (a.status === "CONFIRMED") {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => run("NO_SHOW")}
        disabled={update.isPending}
        aria-label={`Mark ${a.patientName} as no-show`}
        className="text-destructive hover:text-destructive"
      >
        {target === "NO_SHOW" ? <Loader2 className="animate-spin" aria-hidden /> : <UserX aria-hidden />}
        No-show
      </Button>
    );
  }
  return null;
}
