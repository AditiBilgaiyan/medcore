"use client";

import { CircleDollarSign, History, IndianRupee, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useRevenueAnalytics } from "@/services/misc";
import type { DateRangeQuery, PaymentMethod } from "@/types";
import { CategoryBarChart } from "../charts/category-bar-chart";
import { deltaOf } from "../charts/chart-utils";
import { RevenueSeriesChart } from "../charts/revenue-series-chart";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  STRIPE_CARD: "Card (Stripe)",
  RAZORPAY_UPI: "UPI (Razorpay)",
  RAZORPAY_NETBANKING: "Net banking (Razorpay)",
  CASH: "Cash",
  INSURANCE: "Insurance",
};

export function RevenueSection({ query }: { query: DateRangeQuery }) {
  const { data: r, isLoading, error, refetch } = useRevenueAnalytics(query);
  const delta = r ? deltaOf(r.total, r.previousPeriodTotal) : undefined;
  const collectionRate = r && r.total ? r.collected / r.total : undefined;
  const fmt = (n: number) => formatCurrency(n, true);

  return (
    <section aria-labelledby="analytics-revenue" className="space-y-4">
      <h2 id="analytics-revenue" className="sr-only">
        Revenue
      </h2>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total billed"
          value={formatCurrency(r?.total)}
          icon={IndianRupee}
          loading={isLoading}
          delta={delta}
          hint={delta !== undefined ? "vs previous period" : "No previous-period data"}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(r?.collected)}
          icon={Wallet}
          tone="success"
          loading={isLoading}
          hint={collectionRate !== undefined ? `${formatPercent(collectionRate, 1)} of billed` : undefined}
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(r?.outstanding)}
          icon={CircleDollarSign}
          tone="danger"
          loading={isLoading}
          hint="Balance due on invoices in range"
        />
        <StatCard
          label="Previous period"
          value={formatCurrency(r?.previousPeriodTotal)}
          icon={History}
          tone="neutral"
          loading={isLoading}
          hint="Same number of days before"
        />
      </div>
      <RevenueSeriesChart
        headingLevel={3}
        title="Daily revenue by source"
        description="Billed amount per day, stacked by consultation, lab, pharmacy and other charges."
        series={r?.series}
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryBarChart
          headingLevel={3}
          title="Collections by payment method"
          description="Successful payments only."
          data={r?.byMethod.map((m) => ({ label: METHOD_LABELS[m.method] ?? m.method, value: m.amount }))}
          valueLabel="Amount"
          format={fmt}
          multicolor
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
        />
        <CategoryBarChart
          headingLevel={3}
          title="Revenue by department"
          description="Invoice totals, attributed via the linked appointment."
          data={r?.byDepartment.map((d) => ({ label: d.department, value: d.amount }))}
          valueLabel="Revenue"
          format={fmt}
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    </section>
  );
}
