"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarCheck2,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  FlaskConical,
  Pill,
  Receipt,
  Stethoscope,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { CancelAppointmentDialog } from "@/components/modules/portal/appointment-card";
import { FadeIn } from "@/components/modules/portal/portal-ui";
import {
  abnormalCount,
  APPOINTMENT_STATUS_COPY,
  countdownLabel,
  greeting,
  longDay,
  PRESCRIPTION_STATUS_COPY,
  shortDay,
  todayIso,
} from "@/components/modules/portal/portal-utils";
import { RescheduleDialog } from "@/components/modules/portal/reschedule-dialog";
import { AllergyBadges } from "@/components/shared/clinical";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate, formatRelative, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppointments } from "@/services/appointments";
import { useInvoices } from "@/services/billing";
import { useLabOrders } from "@/services/lab";
import { useMarkNotificationRead, useNotifications } from "@/services/misc";
import { usePatient } from "@/services/patients";
import { usePrescriptions } from "@/services/prescriptions";
import type { Appointment } from "@/types";

const QUICK_ACTIONS = [
  { label: "Book appointment", hint: "See a doctor", href: ROUTES.portalBook, icon: CalendarPlus },
  { label: "Medical records", hint: "Past visits", href: ROUTES.portalRecords, icon: ClipboardList },
  { label: "Lab reports", hint: "Test results", href: ROUTES.portalReports, icon: FlaskConical },
  { label: "Prescriptions", hint: "Your medicines", href: ROUTES.portalPrescriptions, icon: Pill },
  { label: "Bills", hint: "View and pay", href: ROUTES.portalInvoices, icon: Receipt },
];

function RowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function ViewAll({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href={href} aria-label={label}>
        View all <ArrowRight />
      </Link>
    </Button>
  );
}

function NextAppointment() {
  const appts = useAppointments({ from: todayIso(), status: ["PENDING", "CONFIRMED"], limit: 5, sortOrder: "asc" });
  const next: Appointment | undefined = appts.data?.data[0];
  const more = (appts.data?.meta.total ?? 0) - 1;

  if (appts.isLoading) {
    return (
      <Card className="gap-3 p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-9 w-40" />
      </Card>
    );
  }
  if (appts.error) {
    return (
      <Card className="p-0">
        <ErrorState error={appts.error} onRetry={() => appts.refetch()} />
      </Card>
    );
  }
  if (!next) {
    return (
      <Card className="gap-4 p-5">
        <div className="flex items-start gap-3">
          <span
            className="bg-secondary text-secondary-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
            aria-hidden
          >
            <CalendarPlus className="size-5" />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">No upcoming appointments</h2>
            <p className="text-muted-foreground text-base md:text-sm">
              Need to see a doctor? Pick a department, doctor and a time that suits you.
            </p>
          </div>
        </div>
        <Button size="lg" className="w-full sm:w-fit" asChild>
          <Link href={ROUTES.portalBook}>
            <CalendarPlus /> Book an appointment
          </Link>
        </Button>
      </Card>
    );
  }

  const copy = APPOINTMENT_STATUS_COPY[next.status];
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="bg-primary/5 flex items-center justify-between gap-2 border-b px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <CalendarCheck2 className="text-primary size-4" aria-hidden />
          Your next appointment
        </p>
        <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-0.5 text-sm font-semibold">
          {countdownLabel(next.date)}
        </span>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-xl font-semibold">{next.doctorName}</h2>
            <p className="text-muted-foreground flex items-center gap-1.5 text-base md:text-sm">
              <Stethoscope className="size-4" aria-hidden /> {next.departmentName}
            </p>
          </div>
          <StatusBadge status={next.status} label={copy.label} />
        </div>
        <p className="flex items-center gap-2 text-base font-medium">
          <Clock className="text-muted-foreground size-4" aria-hidden />
          {longDay(next.date)} · {formatTime(next.startTime)}
        </p>
        {next.reason && <p className="text-muted-foreground text-base md:text-sm">Reason: {next.reason}</p>}
        <p className="text-muted-foreground text-sm">{copy.help}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <RescheduleDialog appointment={next} trigger={<Button size="lg">Reschedule</Button>} />
          <Button variant="outline" size="lg" asChild>
            <Link href={ROUTES.portalAppointments}>All appointments{more > 0 ? ` (${more + 1})` : ""}</Link>
          </Button>
          <CancelAppointmentDialog
            appointment={next}
            trigger={
              <Button variant="link" size="lg" className="text-destructive sm:ml-auto">
                Cancel appointment
              </Button>
            }
          />
        </div>
      </div>
    </Card>
  );
}

function BalanceCard() {
  const invoices = useInvoices({ status: ["ISSUED", "PARTIALLY_PAID"], limit: 100, sortBy: "createdAt", sortOrder: "asc" });
  const list = invoices.data?.data.filter((i) => i.balanceDue > 0) ?? [];
  const total = list.reduce((sum, i) => sum + i.balanceDue, 0);
  const first = list[0];

  return (
    <Card className="gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm font-medium">Amount due</p>
          {invoices.isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="font-heading text-3xl font-semibold tabular-nums">{formatCurrency(total)}</p>
          )}
        </div>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            total > 0
              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
          )}
          aria-hidden
        >
          {total > 0 ? <Wallet className="size-5" /> : <CheckCircle2 className="size-5" />}
        </span>
      </div>
      {invoices.error ? (
        <p className="text-destructive text-sm">Couldn&apos;t load your bills.</p>
      ) : invoices.isLoading ? null : total > 0 ? (
        <>
          <p className="text-muted-foreground text-base md:text-sm">
            {list.length === 1 ? `1 unpaid bill (${first.number})` : `${list.length} unpaid bills`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <Button size="lg" className="flex-1" asChild>
              <Link href={ROUTES.portalInvoice(first.id)}>Pay now</Link>
            </Button>
            {list.length > 1 && (
              <Button variant="outline" size="lg" className="flex-1" asChild>
                <Link href={ROUTES.portalInvoices}>View bills</Link>
              </Button>
            )}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-base md:text-sm">You&apos;re all paid up. Thank you!</p>
      )}
    </Card>
  );
}

function HealthSummary({ patientId }: { patientId?: string }) {
  const patient = usePatient(patientId);
  return (
    <SectionCard title="Allergies & conditions" action={<ViewAll href={ROUTES.portalProfile} label="View health profile" />}>
      {patient.isLoading ? (
        <RowSkeleton rows={2} />
      ) : patient.error ? (
        <p className="text-destructive text-sm">Couldn&apos;t load your health profile.</p>
      ) : patient.data ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase">Allergies</p>
            <AllergyBadges allergies={patient.data.allergies} />
          </div>
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium uppercase">Long-term conditions</p>
            {patient.data.chronicConditions.length ? (
              <p className="text-base md:text-sm">{patient.data.chronicConditions.join(", ")}</p>
            ) : (
              <p className="text-muted-foreground text-sm">None recorded</p>
            )}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function LatestReports() {
  const labs = useLabOrders({ limit: 3 });
  const list = labs.data?.data ?? [];
  return (
    <SectionCard
      title="Latest lab reports"
      action={<ViewAll href={ROUTES.portalReports} label="View all lab reports" />}
      contentClassName="p-2"
    >
      {labs.isLoading ? (
        <div className="p-2">
          <RowSkeleton />
        </div>
      ) : labs.error ? (
        <ErrorState error={labs.error} onRetry={() => labs.refetch()} className="py-6" />
      ) : !list.length ? (
        <EmptyState
          compact
          icon={FlaskConical}
          title="No lab reports yet"
          description="Reports appear here once the lab has checked them."
        />
      ) : (
        <ul className="divide-y">
          {list.map((o) => {
            const { abnormal, critical } = abnormalCount(o.results);
            return (
              <li key={o.id}>
                <Link
                  href={ROUTES.portalReport(o.id)}
                  className="hover:bg-muted/60 focus-visible:outline-ring flex items-start justify-between gap-3 rounded-lg p-2 transition-colors focus-visible:outline-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium md:text-sm">{o.tests.map((t) => t.testName).join(", ")}</p>
                    <p className="text-muted-foreground text-sm">{formatDate(o.approvedAt ?? o.createdAt)}</p>
                  </div>
                  {abnormal > 0 ? (
                    <StatusBadge status={critical ? "CRITICAL" : "HIGH"} label={`${abnormal} to review`} />
                  ) : (
                    <StatusBadge status="NORMAL" label="All normal" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function RecentPrescriptions() {
  const rx = usePrescriptions({ limit: 3 });
  const list = rx.data?.data ?? [];
  return (
    <SectionCard
      title="Prescriptions"
      action={<ViewAll href={ROUTES.portalPrescriptions} label="View all prescriptions" />}
      contentClassName="p-2"
    >
      {rx.isLoading ? (
        <div className="p-2">
          <RowSkeleton />
        </div>
      ) : rx.error ? (
        <ErrorState error={rx.error} onRetry={() => rx.refetch()} className="py-6" />
      ) : !list.length ? (
        <EmptyState compact icon={Pill} title="No prescriptions yet" />
      ) : (
        <ul className="divide-y">
          {list.map((p) => {
            const copy = PRESCRIPTION_STATUS_COPY[p.status];
            return (
              <li key={p.id}>
                <Link
                  href={`${ROUTES.portalPrescriptions}?open=${p.id}`}
                  className="hover:bg-muted/60 focus-visible:outline-ring flex items-start justify-between gap-3 rounded-lg p-2 transition-colors focus-visible:outline-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium md:text-sm">{p.items.map((i) => i.medicineName).join(", ")}</p>
                    <p className="text-muted-foreground text-sm">
                      {shortDay(p.signedAt.slice(0, 10))} · {p.doctorName}
                    </p>
                  </div>
                  <StatusBadge status={p.status} label={copy.label} tone={copy.tone} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function RecentNotifications() {
  const notifications = useNotifications({ limit: 5 });
  const markRead = useMarkNotificationRead();
  const list = notifications.data?.data ?? [];
  return (
    <SectionCard title="Updates" description="Messages from the hospital" contentClassName="p-2">
      {notifications.isLoading ? (
        <div className="p-2">
          <RowSkeleton />
        </div>
      ) : notifications.error ? (
        <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} className="py-6" />
      ) : !list.length ? (
        <EmptyState
          compact
          icon={Bell}
          title="You're all caught up"
          description="We'll let you know about appointments, reports and bills."
        />
      ) : (
        <ul className="divide-y">
          {list.map((n) => {
            const unread = !n.readAt;
            const body = (
              <>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-base md:text-sm", unread && "font-semibold")}>
                    {n.title}
                    {unread && <span className="sr-only"> (unread)</span>}
                  </span>
                  <span className="text-muted-foreground line-clamp-2 block text-sm">{n.body}</span>
                  <span className="text-muted-foreground block text-xs">{formatRelative(n.createdAt)}</span>
                </span>
              </>
            );
            const cls =
              "flex gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring";
            return (
              <li key={n.id}>
                {n.link?.startsWith("/portal") ? (
                  <Link href={n.link} className={cls} onClick={() => unread && markRead.mutate(n.id)}>
                    {body}
                  </Link>
                ) : (
                  <div className={cn(cls, "hover:bg-transparent")}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

export default function PortalHomePage() {
  const { user } = useAuth();
  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <FadeIn>
        <header className="space-y-1">
          <p className="text-muted-foreground text-sm">{longDay(now)}</p>
          <h1 className="text-2xl font-semibold">
            {greeting(now)}
            {user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-muted-foreground text-base md:text-sm">
            {user?.hospitalName ? `Your health at ${user.hospitalName}, all in one place.` : "Your health, all in one place."}
          </p>
        </header>
      </FadeIn>

      <FadeIn delay={0.04} className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NextAppointment />
        </div>
        <BalanceCard />
      </FadeIn>

      <FadeIn delay={0.08}>
        <nav aria-label="Quick actions">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {QUICK_ACTIONS.map((a, i) => (
              <li key={a.href} className={cn(i === 0 && "col-span-2 sm:col-span-1")}>
                <Link
                  href={a.href}
                  className="group bg-card hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-ring flex h-full min-h-20 items-center gap-3 rounded-xl border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-col sm:items-start sm:gap-2 sm:p-4"
                >
                  <span
                    className="bg-secondary text-secondary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
                    aria-hidden
                  >
                    <a.icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-medium md:text-sm">{a.label}</span>
                    <span className="text-muted-foreground block text-sm">{a.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </FadeIn>

      <FadeIn delay={0.12} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <LatestReports />
        <RecentPrescriptions />
        <div className="space-y-4 md:col-span-2 lg:col-span-1">
          <HealthSummary patientId={user?.patientId} />
          <RecentNotifications />
        </div>
      </FadeIn>

      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        In an emergency, call your local emergency number or go to the nearest emergency department. Don&apos;t use this portal for urgent
        medical help.
      </p>
    </div>
  );
}
