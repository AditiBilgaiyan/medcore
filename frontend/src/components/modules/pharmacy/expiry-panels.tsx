"use client";

import { CalendarClock, Loader2, ScanLine } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useExpiryAlerts, useRunExpiryScan } from "@/services/pharmacy";
import type { ExpiryAlert, ExpiryScanReport } from "@/types";
import { daysLabel, EXPIRY_WINDOW_DAYS } from "./pharmacy-utils";
import { QuarantineButton } from "./quarantine-button";

function AlertRow({ alert, canManage }: { alert: ExpiryAlert; canManage: boolean }) {
  const expired = alert.status === "EXPIRED";
  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5", expired && "bg-destructive/5")}>
      <div className="min-w-0 flex-1">
        <Link
          href={ROUTES.medicine(alert.medicineId)}
          className="focus-visible:outline-ring rounded text-sm font-medium hover:underline focus-visible:outline-2"
        >
          {alert.medicineName}
        </Link>
        <p className="text-muted-foreground text-xs tabular-nums">
          Batch <span className="font-mono">{alert.batchNumber}</span> · {formatNumber(alert.quantity)} units · exp{" "}
          {formatDate(alert.expiryDate)}
        </p>
      </div>
      <StatusBadge status={alert.status} label={daysLabel(alert.daysToExpiry)} />
      {expired && canManage && (
        <QuarantineButton
          medicineId={alert.medicineId}
          medicineName={alert.medicineName}
          batchId={alert.batchId}
          batchNumber={alert.batchNumber}
          quantity={alert.quantity}
          expired
        />
      )}
    </li>
  );
}

export function ExpiryAlertsPanel({ className, action }: { className?: string; action?: React.ReactNode }) {
  const { can } = useAuth();
  const { data, isLoading, error, refetch } = useExpiryAlerts(EXPIRY_WINDOW_DAYS);
  const alerts = [...(data ?? [])].sort((a, b) =>
    a.status === b.status ? a.daysToExpiry - b.daysToExpiry : a.status === "EXPIRED" ? -1 : 1,
  );
  const expired = alerts.filter((a) => a.status === "EXPIRED").length;

  return (
    <SectionCard
      className={className}
      title="Expiry alerts"
      description={
        data
          ? `${expired} expired · ${alerts.length - expired} expiring within ${EXPIRY_WINDOW_DAYS} days`
          : `Batches expiring within ${EXPIRY_WINDOW_DAYS} days`
      }
      action={action}
      contentClassName="p-0"
    >
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No expiry alerts"
          description={`No active batches expire in the next ${EXPIRY_WINDOW_DAYS} days.`}
          compact
        />
      ) : (
        <ul className="max-h-96 divide-y overflow-y-auto" aria-label="Batches expired or expiring soon">
          {alerts.map((a) => (
            <AlertRow key={a.batchId} alert={a} canManage={can("pharmacy:manage")} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ScanList({ title, items, tone }: { title: string; items: ExpiryAlert[]; tone: "danger" | "warning" }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">
        {title} <span className="text-muted-foreground tabular-nums">({items.length})</span>
      </p>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">None</p>
      ) : (
        <ul className="max-h-40 divide-y overflow-y-auto rounded-lg border text-sm">
          {items.map((a) => (
            <li key={a.batchId} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="min-w-0 truncate">
                {a.medicineName} <span className="text-muted-foreground font-mono text-xs">{a.batchNumber}</span>
              </span>
              <StatusBadge status={a.status} tone={tone} label={daysLabel(a.daysToExpiry)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Simulates the nightly BullMQ expiry-scan job and shows its report. */
export function RunExpiryScanButton() {
  const scan = useRunExpiryScan();
  const [report, setReport] = useState<ExpiryScanReport | null>(null);
  return (
    <>
      <Button
        variant="outline"
        disabled={scan.isPending}
        onClick={() =>
          scan.mutate(undefined, {
            onSuccess: (r) => {
              setReport(r);
              toast.success("Expiry scan complete");
            },
          })
        }
      >
        {scan.isPending ? <Loader2 className="animate-spin" /> : <ScanLine />} Run expiry scan
      </Button>
      <Dialog open={!!report} onOpenChange={(v) => !v && setReport(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Expiry scan report</DialogTitle>
            <DialogDescription>Ran {formatDateTime(report?.scannedAt)} — the same check the nightly job performs.</DialogDescription>
          </DialogHeader>
          {report && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Expired", value: report.expired.length, cls: report.expired.length ? "text-destructive" : "" },
                  {
                    label: "Expiring ≤30d",
                    value: report.expiring.length,
                    cls: report.expiring.length ? "text-amber-700 dark:text-amber-400" : "",
                  },
                  { label: "Staff notified", value: report.notified, cls: "" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border p-2">
                    <p className={cn("font-heading text-2xl font-semibold tabular-nums", s.cls)}>{formatNumber(s.value)}</p>
                    <p className="text-muted-foreground text-xs">{s.label}</p>
                  </div>
                ))}
              </div>
              <ScanList title="Expired — quarantine now" items={report.expired} tone="danger" />
              <ScanList title="Expiring soon" items={report.expiring} tone="warning" />
              <p className="text-muted-foreground text-xs">Pharmacists and hospital admins received an email and in-app notification.</p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setReport(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
