"use client";

import { Activity, BedDouble, FlaskConical, IndianRupee, PackageX, Stethoscope, Users } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { lastNDays } from "@/components/shared/date-range-filter";
import { ROLE_LABELS } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { formatCurrency, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { useAuditLogs } from "@/services/admin";
import { useAppointmentAnalytics, useHospitalOverview } from "@/services/misc";
import { useMedicines } from "@/services/pharmacy";
import { AppointmentVolumeChart } from "../charts/appointment-volume-chart";
import { AUDIT_ACTION_TONE, CountPill, DashboardHeader, LinkRow, ViewAllLink, WidgetState } from "./common";
import { OccupancyHeatmap } from "./occupancy-heatmap";

export function AdminDashboard() {
  const overview = useHospitalOverview();
  const o = overview.data;
  const range = lastNDays(7);
  const volume = useAppointmentAnalytics(range);
  const bedPct = o && o.totalBeds ? o.occupiedBeds / o.totalBeds : undefined;

  return (
    <div className="space-y-4">
      <DashboardHeader />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Patients today"
          value={formatNumber(o?.patientsToday)}
          icon={Users}
          loading={overview.isLoading}
          hint={o ? `${formatNumber(o.appointmentsToday)} appointments booked` : undefined}
          href={ROUTES.appointments}
        />
        <StatCard
          label="Revenue today"
          value={formatCurrency(o?.revenueToday)}
          icon={IndianRupee}
          tone="success"
          loading={overview.isLoading}
          hint="Payments received"
          href={ROUTES.billing}
        />
        <StatCard
          label="Occupied beds"
          value={o ? `${formatNumber(o.occupiedBeds)}/${formatNumber(o.totalBeds)}` : "—"}
          icon={BedDouble}
          tone={bedPct !== undefined && bedPct >= 0.85 ? "danger" : bedPct !== undefined && bedPct >= 0.7 ? "warning" : "primary"}
          loading={overview.isLoading}
          hint={bedPct !== undefined ? `${formatPercent(bedPct)} occupancy` : undefined}
          href={ROUTES.wards}
        />
        <StatCard
          label="Active doctors"
          value={formatNumber(o?.activeDoctors)}
          icon={Stethoscope}
          tone="neutral"
          loading={overview.isLoading}
          href={ROUTES.doctors}
        />
      </div>
      {o && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
            <FlaskConical className="text-muted-foreground size-3.5" aria-hidden />
            <span className="font-semibold tabular-nums">{formatNumber(o.pendingLabOrders)}</span> lab orders open
          </span>
          <span className="bg-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
            <PackageX className="text-muted-foreground size-3.5" aria-hidden />
            <span className="font-semibold tabular-nums">{formatNumber(o.lowStockCount)}</span> medicines at or below reorder level
          </span>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <AppointmentVolumeChart
          title="Appointments — last 7 days"
          description="Daily bookings with completed and cancelled / no-show counts."
          series={volume.data?.series}
          isLoading={volume.isLoading}
          error={volume.error}
          onRetry={() => volume.refetch()}
        />
        <OccupancyHeatmap
          data={o?.departmentOccupancy}
          isLoading={overview.isLoading}
          error={overview.error}
          onRetry={() => overview.refetch()}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <LowStockPanel />
        <RecentActivity />
      </div>
    </div>
  );
}

/** Low + out-of-stock medicines. Shared with the pharmacist dashboard. */
export function LowStockPanel({ className }: { className?: string }) {
  const low = useMedicines({ stock: "LOW", limit: 10 });
  const out = useMedicines({ stock: "OUT", limit: 10 });
  const items = [...(out.data?.data ?? []).map((m) => ({ m, out: true })), ...(low.data?.data ?? []).map((m) => ({ m, out: false }))];
  const total = (low.data?.meta.total ?? 0) + (out.data?.meta.total ?? 0);
  const loading = low.isLoading || out.isLoading;

  return (
    <SectionCard
      className={className}
      title={
        <>
          Low-stock alerts
          <CountPill count={loading ? undefined : total} label="medicines" />
        </>
      }
      description="Out of stock first, then at or below reorder level."
      action={<ViewAllLink href={ROUTES.pharmacy}>Inventory</ViewAllLink>}
    >
      <WidgetState
        isLoading={loading}
        error={low.error ?? out.error}
        onRetry={() => {
          void low.refetch();
          void out.refetch();
        }}
        isEmpty={items.length === 0}
        empty={{ icon: PackageX, title: "Stock levels look healthy" }}
      >
        <ul className="-mx-2 max-h-80 overflow-y-auto">
          {items.map(({ m, out: isOut }) => (
            <li key={m.id}>
              <LinkRow href={ROUTES.medicine(m.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {m.name} {m.strength}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {m.genericName} · reorder at {formatNumber(m.reorderLevel)}
                  </span>
                </span>
                <span className="text-right text-sm font-semibold tabular-nums">
                  {formatNumber(m.totalStock)}
                  <span className="sr-only"> in stock</span>
                </span>
                {isOut ? (
                  <StatusBadge status="OUT" tone="danger" label="Out of stock" />
                ) : (
                  <StatusBadge status="LOW" tone="warning" label="Low" />
                )}
              </LinkRow>
            </li>
          ))}
        </ul>
      </WidgetState>
    </SectionCard>
  );
}

function RecentActivity() {
  const { data, isLoading, error, refetch } = useAuditLogs({ limit: 10 });
  const list = data?.data ?? [];
  return (
    <SectionCard
      title="Recent activity"
      description="Latest actions across your hospital."
      action={<ViewAllLink href={ROUTES.auditLogs}>Audit log</ViewAllLink>}
    >
      <WidgetState
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        isEmpty={list.length === 0}
        rows={6}
        empty={{ icon: Activity, title: "No activity yet" }}
      >
        <ol className="space-y-3">
          {list.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <UserAvatar name={a.userName} className="size-7" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{a.userName}</span>{" "}
                  <span className="text-muted-foreground">({ROLE_LABELS[a.userRole]})</span>
                </p>
                <p className="text-muted-foreground truncate text-xs" title={a.summary}>
                  {a.summary}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={a.action} tone={AUDIT_ACTION_TONE[a.action]} />
                <time dateTime={a.createdAt} className="text-muted-foreground text-[11px]">
                  {formatRelative(a.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </WidgetState>
    </SectionCard>
  );
}
