"use client";

import { AlertTriangle, ClipboardCheck, FlaskConical, Info, Siren, TestTube, TestTubes, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatRelative, humanize } from "@/lib/format";
import { useLabOrders } from "@/services/lab";
import type { LabOrderStatus } from "@/types";
import { CountPill, DashboardHeader, LinkRow, ViewAllLink, WidgetState } from "./common";

const OPEN: LabOrderStatus[] = ["ORDERED", "SAMPLE_COLLECTED", "PROCESSING", "PENDING_APPROVAL"];
const STATUS_ICON: Record<string, LucideIcon> = {
  ORDERED: FlaskConical,
  SAMPLE_COLLECTED: TestTube,
  PROCESSING: Timer,
  PENDING_APPROVAL: ClipboardCheck,
};

function StatusCount({ status }: { status: LabOrderStatus }) {
  const { data, isLoading } = useLabOrders({ status: [status], limit: 1 }, { refetchInterval: 60_000 });
  return (
    <StatCard
      label={humanize(status)}
      value={data?.meta.total ?? 0}
      icon={STATUS_ICON[status]}
      tone={status === "PENDING_APPROVAL" ? "warning" : status === "PROCESSING" ? "primary" : "neutral"}
      loading={isLoading}
      href={ROUTES.lab}
    />
  );
}

export function LabDashboard() {
  const { user } = useAuth();
  const urgent = useLabOrders({ sortBy: "priority", status: OPEN, limit: 50 }, { refetchInterval: 60_000 });
  const approval = useLabOrders({ status: ["PENDING_APPROVAL"], limit: 10 });
  const urgentList = (urgent.data?.data ?? []).filter((o) => o.priority !== "ROUTINE");
  const approvalList = approval.data?.data ?? [];
  const ownCount = approvalList.filter((o) => o.processedById === user?.id).length;

  return (
    <div className="space-y-4">
      <DashboardHeader />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {OPEN.map((s) => (
          <StatusCount key={s} status={s} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={
            <>
              STAT &amp; urgent orders
              <CountPill count={urgent.isLoading ? undefined : urgentList.length} label="open orders" />
            </>
          }
          description="Open orders by priority, oldest first within each priority."
          action={<ViewAllLink href={ROUTES.lab}>Worklist</ViewAllLink>}
        >
          <WidgetState
            isLoading={urgent.isLoading}
            error={urgent.error}
            onRetry={() => urgent.refetch()}
            isEmpty={urgentList.length === 0}
            rows={5}
            empty={{ icon: Siren, title: "No STAT or urgent orders", description: "Routine orders are on the worklist." }}
          >
            <ul className="-mx-2 max-h-[28rem] overflow-y-auto">
              {urgentList.map((o) => (
                <li key={o.id}>
                  <LinkRow href={ROUTES.labOrder(o.id)}>
                    <StatusBadge status={o.priority} className="w-16 justify-center" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {o.patientName} <span className="text-muted-foreground font-normal">· {o.number}</span>
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {o.tests.map((t) => t.testName).join(", ")} · ordered {formatRelative(o.createdAt)}
                      </span>
                    </span>
                    <StatusBadge status={o.status} />
                  </LinkRow>
                </li>
              ))}
            </ul>
          </WidgetState>
        </SectionCard>
        <SectionCard
          title={
            <>
              Awaiting approval
              <CountPill count={approval.data?.meta.total} label="orders" />
            </>
          }
          description="Results submitted and ready for a second technician to review."
        >
          <div className="space-y-3">
            <p className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg border border-dashed p-2.5 text-xs">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Four-eyes rule: you can&apos;t approve results you processed yourself.
                {ownCount > 0 &&
                  ` ${ownCount} of these ${ownCount === 1 ? "is" : "are"} yours and need${ownCount === 1 ? "s" : ""} another technician.`}
              </span>
            </p>
            <WidgetState
              isLoading={approval.isLoading}
              error={approval.error}
              onRetry={() => approval.refetch()}
              isEmpty={approvalList.length === 0}
              rows={4}
              empty={{ icon: TestTubes, title: "Nothing waiting for approval" }}
            >
              <ul className="-mx-2">
                {approvalList.map((o) => {
                  const mine = o.processedById === user?.id;
                  const abnormal = o.results.filter((r) => r.flag !== "NORMAL").length;
                  const critical = o.results.some((r) => r.flag === "CRITICAL");
                  return (
                    <li key={o.id}>
                      <LinkRow href={ROUTES.labOrder(o.id)}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {o.patientName} <span className="text-muted-foreground font-normal">· {o.number}</span>
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            Processed by {mine ? "you" : (o.processedByName ?? "—")} · {formatRelative(o.updatedAt)}
                          </span>
                        </span>
                        {critical ? (
                          <StatusBadge status="CRITICAL" label="Critical" />
                        ) : abnormal ? (
                          <StatusBadge status="HIGH" label={`${abnormal} abnormal`} />
                        ) : null}
                        {mine ? (
                          <StatusBadge status="MINE" tone="neutral" label="Needs another approver" dot={false} />
                        ) : (
                          <StatusBadge status="PENDING_APPROVAL" label="Ready to review" />
                        )}
                      </LinkRow>
                    </li>
                  );
                })}
              </ul>
            </WidgetState>
            {approvalList.some((o) => o.results.some((r) => r.flag === "CRITICAL")) && (
              <p className="text-destructive flex items-center gap-1.5 text-xs font-medium">
                <AlertTriangle className="size-3.5" aria-hidden /> Critical values — review and notify the ordering doctor promptly.
              </p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
