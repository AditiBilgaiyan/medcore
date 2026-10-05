"use client";

import { AlertTriangle, CalendarX2, ClipboardList, IndianRupee, PackageX, Pill, TriangleAlert } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ROUTES } from "@/constants/routes";
import { formatCurrency, formatDate, formatNumber, formatRelative } from "@/lib/format";
import { useExpiryAlerts, usePharmacySummary } from "@/services/pharmacy";
import { usePrescriptions } from "@/services/prescriptions";
import { LowStockPanel } from "./admin-dashboard";
import { CountPill, DashboardHeader, LinkRow, ViewAllLink, WidgetState } from "./common";

export function PharmacistDashboard() {
  const summary = usePharmacySummary();
  const s = summary.data;
  const queue = usePrescriptions({ status: ["ISSUED", "PARTIALLY_DISPENSED"], limit: 10 });
  const expiry = useExpiryAlerts(30);
  const alerts = [...(expiry.data ?? [])].sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  const queueList = queue.data?.data ?? [];

  return (
    <div className="space-y-4">
      <DashboardHeader />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-5">
        <StatCard
          label="Medicines"
          value={formatNumber(s?.totalMedicines)}
          icon={Pill}
          loading={summary.isLoading}
          href={ROUTES.pharmacy}
        />
        <StatCard
          label="Low stock"
          value={formatNumber(s?.lowStock)}
          icon={TriangleAlert}
          tone={s?.lowStock ? "warning" : "neutral"}
          loading={summary.isLoading}
        />
        <StatCard
          label="Out of stock"
          value={formatNumber(s?.outOfStock)}
          icon={PackageX}
          tone={s?.outOfStock ? "danger" : "neutral"}
          loading={summary.isLoading}
        />
        <StatCard
          label="Expiring ≤ 30 days"
          value={formatNumber(s?.expiringSoon)}
          icon={CalendarX2}
          tone={s?.expiredNotQuarantined ? "danger" : "warning"}
          loading={summary.isLoading}
          hint={s?.expiredNotQuarantined ? `${s.expiredNotQuarantined} expired, not quarantined` : undefined}
        />
        <StatCard
          label="Stock value"
          value={formatCurrency(s?.stockValue, true)}
          icon={IndianRupee}
          tone="success"
          loading={summary.isLoading}
          hint="At cost"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          title={
            <>
              Prescription queue
              <CountPill count={queue.data?.meta.total} label="prescriptions to dispense" />
            </>
          }
          description="Issued and partially dispensed prescriptions."
          action={<ViewAllLink href={ROUTES.dispense}>Dispensing</ViewAllLink>}
        >
          <WidgetState
            isLoading={queue.isLoading}
            error={queue.error}
            onRetry={() => queue.refetch()}
            isEmpty={queueList.length === 0}
            rows={5}
            empty={{ icon: ClipboardList, title: "Queue is empty", description: "New prescriptions appear here as doctors sign them." }}
          >
            <ul className="-mx-2">
              {queueList.map((rx) => {
                const pending = rx.items.filter((i) => i.dispensedQty < i.quantity).length;
                return (
                  <li key={rx.id}>
                    <LinkRow href={ROUTES.dispensePrescription(rx.id)} label={`Dispense ${rx.number} for ${rx.patientName}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {rx.patientName} <span className="text-muted-foreground font-normal">· {rx.number}</span>
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {rx.doctorName} · {pending} of {rx.items.length} item{rx.items.length === 1 ? "" : "s"} to dispense ·{" "}
                          {formatRelative(rx.createdAt)}
                        </span>
                      </span>
                      <StatusBadge status={rx.status} />
                    </LinkRow>
                  </li>
                );
              })}
            </ul>
          </WidgetState>
        </SectionCard>
        <SectionCard
          title={
            <>
              Expiry alerts
              <CountPill count={expiry.isLoading ? undefined : alerts.length} label="batches" />
            </>
          }
          description="Batches expiring within 30 days, or already expired."
        >
          <WidgetState
            isLoading={expiry.isLoading}
            error={expiry.error}
            onRetry={() => expiry.refetch()}
            isEmpty={alerts.length === 0}
            empty={{ icon: CalendarX2, title: "No batches expiring soon" }}
          >
            <ul className="-mx-2 max-h-96 overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.batchId}>
                  <LinkRow href={ROUTES.medicine(a.medicineId)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.medicineName}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        Batch {a.batchNumber} · {formatNumber(a.quantity)} units · {formatDate(a.expiryDate)}
                      </span>
                    </span>
                    <StatusBadge
                      status={a.status}
                      label={a.status === "EXPIRED" ? "Expired" : `${a.daysToExpiry} day${a.daysToExpiry === 1 ? "" : "s"}`}
                    />
                  </LinkRow>
                </li>
              ))}
            </ul>
          </WidgetState>
          {alerts.some((a) => a.status === "EXPIRED") && (
            <p className="text-destructive mt-3 flex items-center gap-1.5 text-xs font-medium">
              <AlertTriangle className="size-3.5" aria-hidden /> Quarantine expired batches so they can&apos;t be dispensed.
            </p>
          )}
        </SectionCard>
      </div>
      <LowStockPanel />
    </div>
  );
}
