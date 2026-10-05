"use client";

import { BarChart3, FileText, IndianRupee, Receipt, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { lastNDays } from "@/components/shared/date-range-filter";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ROUTES } from "@/constants/routes";
import { formatCurrency, formatDate, formatNumber, formatRelative } from "@/lib/format";
import { useBillingSummary, useClaims, useInvoices } from "@/services/billing";
import { useRevenueAnalytics } from "@/services/misc";
import { RevenueSeriesChart } from "../charts/revenue-series-chart";
import { deltaOf } from "../charts/chart-utils";
import { CountPill, DashboardHeader, LinkRow, ViewAllLink, WidgetState } from "./common";

export function AccountantDashboard() {
  const summary = useBillingSummary();
  const s = summary.data;
  const revenue = useRevenueAnalytics(lastNDays(30));
  const r = revenue.data;
  const claims = useClaims({ status: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"], limit: 8 });
  const invoices = useInvoices({ status: ["ISSUED", "PARTIALLY_PAID"], limit: 8 });
  const claimList = claims.data?.data ?? [];
  const invoiceList = invoices.data?.data ?? [];

  return (
    <div className="space-y-4">
      <DashboardHeader
        actions={
          <Button variant="outline" asChild>
            <Link href={ROUTES.analytics}>
              <BarChart3 aria-hidden /> Full analytics
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Collected today"
          value={formatCurrency(s?.collectedToday)}
          icon={Wallet}
          tone="success"
          loading={summary.isLoading}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(s?.outstanding, true)}
          icon={IndianRupee}
          tone="danger"
          loading={summary.isLoading}
          hint="Issued, part-paid & insurance"
          href={ROUTES.billing}
        />
        <StatCard
          label="Pending claims"
          value={formatNumber(s?.pendingClaims)}
          icon={ShieldCheck}
          tone="warning"
          loading={summary.isLoading}
          href={ROUTES.claims}
        />
        <StatCard
          label="Invoices today"
          value={formatNumber(s?.invoicesToday)}
          icon={Receipt}
          tone="neutral"
          loading={summary.isLoading}
          hint={s ? `${formatNumber(s.draftInvoices)} drafts open` : undefined}
        />
      </div>
      <RevenueSeriesChart
        title="Revenue — last 30 days"
        description={
          r ? (
            <>
              <span className="text-foreground font-medium tabular-nums">{formatCurrency(r.total)}</span> billed ·{" "}
              <span className="tabular-nums">{formatCurrency(r.collected)}</span> collected
              {deltaOf(r.total, r.previousPeriodTotal) !== undefined && (
                <> · {formatDelta(deltaOf(r.total, r.previousPeriodTotal)!)} vs previous 30 days</>
              )}
            </>
          ) : (
            "Daily billed amount by source."
          )
        }
        series={r?.series}
        isLoading={revenue.isLoading}
        error={revenue.error}
        onRetry={() => revenue.refetch()}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={
            <>
              Pending insurance claims
              <CountPill count={claims.data?.meta.total} label="claims" />
            </>
          }
          description="Submitted, under review or approved but not yet settled."
          action={<ViewAllLink href={ROUTES.claims}>All claims</ViewAllLink>}
        >
          <WidgetState
            isLoading={claims.isLoading}
            error={claims.error}
            onRetry={() => claims.refetch()}
            isEmpty={claimList.length === 0}
            rows={5}
            empty={{ icon: ShieldCheck, title: "No open claims" }}
          >
            <ul className="-mx-2">
              {claimList.map((c) => (
                <li key={c.id}>
                  <LinkRow href={ROUTES.invoice(c.invoiceId)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {c.patientName} <span className="text-muted-foreground font-normal">· {c.invoiceNumber}</span>
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {c.tpaName} · submitted {formatRelative(c.submittedAt)}
                      </span>
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums">
                      {formatCurrency(c.approvedAmount ?? c.claimAmount)}
                    </span>
                    <StatusBadge status={c.status} />
                  </LinkRow>
                </li>
              ))}
            </ul>
          </WidgetState>
        </SectionCard>
        <SectionCard
          title={
            <>
              Outstanding invoices
              <CountPill count={invoices.data?.meta.total} label="invoices" />
            </>
          }
          description="Issued or partially paid, newest first."
          action={<ViewAllLink href={ROUTES.billing}>All invoices</ViewAllLink>}
        >
          <WidgetState
            isLoading={invoices.isLoading}
            error={invoices.error}
            onRetry={() => invoices.refetch()}
            isEmpty={invoiceList.length === 0}
            rows={5}
            empty={{ icon: FileText, title: "Nothing outstanding" }}
          >
            <ul className="-mx-2">
              {invoiceList.map((i) => (
                <li key={i.id}>
                  <LinkRow href={ROUTES.invoice(i.id)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {i.patientName} <span className="text-muted-foreground font-normal">· {i.number}</span>
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {i.dueDate ? `Due ${formatDate(i.dueDate)}` : `Issued ${formatDate(i.issuedAt ?? i.createdAt)}`} · total{" "}
                        {formatCurrency(i.total)}
                      </span>
                    </span>
                    <span className="text-right text-sm font-semibold tabular-nums">
                      {formatCurrency(i.balanceDue)}
                      <span className="sr-only"> due</span>
                    </span>
                    <StatusBadge status={i.status} />
                  </LinkRow>
                </li>
              ))}
            </ul>
          </WidgetState>
        </SectionCard>
      </div>
    </div>
  );
}

function formatDelta(d: number) {
  const pct = Math.abs(d * 100).toFixed(0);
  return d >= 0 ? `up ${pct}%` : `down ${pct}%`;
}
