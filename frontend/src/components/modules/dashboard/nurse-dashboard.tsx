"use client";

import { differenceInMinutes, parseISO } from "date-fns";
import { BedDouble, CalendarCheck2, HeartPulse, Users } from "lucide-react";
import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ROUTES } from "@/constants/routes";
import { formatNumber, formatPercent, formatRelative, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAppointments } from "@/services/appointments";
import { useAdmissions, useWards } from "@/services/misc";
import type { Admission } from "@/types";
import { CountPill, DashboardHeader, LinkRow, todayIso, ViewAllLink, WidgetState } from "./common";

const VITALS_DUE_MINUTES = 4 * 60;

function latestVitalsAt(a: Admission): string | undefined {
  return a.vitals.reduce<string | undefined>((max, v) => (!max || v.recordedAt > max ? v.recordedAt : max), undefined);
}

export function NurseDashboard() {
  const wards = useWards();
  const admissions = useAdmissions({ limit: 200 });
  const triage = useAppointments({ date: todayIso(), status: ["CONFIRMED"], limit: 100 }, { refetchInterval: 60_000 });

  const vitalsDue = useMemo(() => {
    const now = new Date();
    return (admissions.data?.data ?? [])
      .filter((a) => a.status === "ADMITTED")
      .map((a) => {
        const last = latestVitalsAt(a);
        return { a, last, overdueBy: last ? differenceInMinutes(now, parseISO(last)) : Number.POSITIVE_INFINITY };
      })
      .filter((x) => x.overdueBy >= VITALS_DUE_MINUTES)
      .sort((x, y) => y.overdueBy - x.overdueBy);
  }, [admissions.data]);

  const wardList = wards.data ?? [];
  const totalBeds = wardList.reduce((s, w) => s + w.totalBeds, 0);
  const occupied = wardList.reduce((s, w) => s + w.occupiedBeds, 0);
  const triageList = triage.data?.data ?? [];

  return (
    <div className="space-y-4">
      <DashboardHeader />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Admitted patients"
          value={formatNumber(admissions.data?.meta.total)}
          icon={Users}
          loading={admissions.isLoading}
          href={ROUTES.wards}
        />
        <StatCard
          label="Vitals due"
          value={vitalsDue.length}
          icon={HeartPulse}
          tone={vitalsDue.length ? "danger" : "success"}
          loading={admissions.isLoading}
          hint="No vitals in the last 4 h"
        />
        <StatCard
          label="Free beds"
          value={wards.isLoading ? "—" : formatNumber(totalBeds - occupied)}
          icon={BedDouble}
          tone="neutral"
          loading={wards.isLoading}
          hint={totalBeds ? `${occupied}/${totalBeds} occupied` : undefined}
        />
        <StatCard label="Awaiting triage" value={triageList.length} icon={CalendarCheck2} tone="warning" loading={triage.isLoading} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title={
            <>
              Vitals due
              <CountPill count={admissions.isLoading ? undefined : vitalsDue.length} label="patients" />
            </>
          }
          description="Admitted patients whose latest vitals are more than 4 hours old — longest wait first."
          action={<ViewAllLink href={ROUTES.wards}>Wards</ViewAllLink>}
        >
          <WidgetState
            isLoading={admissions.isLoading}
            error={admissions.error}
            onRetry={() => admissions.refetch()}
            isEmpty={vitalsDue.length === 0}
            rows={5}
            empty={{ icon: HeartPulse, title: "All vitals are up to date" }}
          >
            <ul className="-mx-2 max-h-[28rem] overflow-y-auto">
              {vitalsDue.map(({ a, last }) => (
                <li key={a.id}>
                  <LinkRow href={ROUTES.admission(a.id)}>
                    <span
                      className="bg-muted flex h-8 min-w-12 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums"
                      title="Bed"
                    >
                      <span className="sr-only">Bed </span>
                      {a.bedNumber}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.patientName}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {a.wardName} · {a.diagnosis}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs">
                      {last ? (
                        <>
                          <span className="text-muted-foreground block">Last vitals</span>
                          <span className="font-medium">{formatRelative(last)}</span>
                        </>
                      ) : (
                        <StatusBadge status="CRITICAL" tone="danger" label="Never recorded" />
                      )}
                    </span>
                  </LinkRow>
                </li>
              ))}
            </ul>
          </WidgetState>
        </SectionCard>
        <SectionCard title="Ward occupancy" description="Beds in use right now.">
          <WidgetState
            isLoading={wards.isLoading}
            error={wards.error}
            onRetry={() => wards.refetch()}
            isEmpty={wardList.length === 0}
            empty={{ icon: BedDouble, title: "No wards configured" }}
          >
            <ul className="space-y-3">
              {wardList.map((w) => {
                const pct = w.totalBeds ? w.occupiedBeds / w.totalBeds : 0;
                return (
                  <li key={w.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{w.name}</span>
                        <span className="text-muted-foreground text-xs"> · {w.departmentName}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums">
                        <span className="font-semibold">
                          {w.occupiedBeds}/{w.totalBeds}
                        </span>{" "}
                        <span className={cn("text-muted-foreground", pct >= 0.9 && "text-destructive font-medium")}>
                          ({formatPercent(pct)})
                        </span>
                      </span>
                    </div>
                    <Progress value={pct * 100} aria-label={`${w.name}: ${w.occupiedBeds} of ${w.totalBeds} beds occupied`} />
                  </li>
                );
              })}
            </ul>
          </WidgetState>
        </SectionCard>
      </div>
      <SectionCard
        title={
          <>
            Awaiting triage
            <CountPill count={triage.isLoading ? undefined : triageList.length} label="patients" />
          </>
        }
        description="Today's confirmed appointments — record vitals before the consultation."
        action={<ViewAllLink href={ROUTES.appointments}>Appointments</ViewAllLink>}
      >
        <WidgetState
          isLoading={triage.isLoading}
          error={triage.error}
          onRetry={() => triage.refetch()}
          isEmpty={triageList.length === 0}
          empty={{ icon: CalendarCheck2, title: "Nobody waiting for triage" }}
        >
          <ul className="-mx-2 grid gap-1 md:grid-cols-2 2xl:grid-cols-3">
            {triageList.map((a) => (
              <li key={a.id}>
                <LinkRow href={ROUTES.appointment(a.id)}>
                  <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{formatTime(a.startTime)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.patientName}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {a.doctorName} · {a.departmentName}
                    </span>
                  </span>
                  {a.isEmergency && <StatusBadge status="EMERGENCY" label="Emergency" />}
                </LinkRow>
              </li>
            ))}
          </ul>
        </WidgetState>
      </SectionCard>
    </div>
  );
}
