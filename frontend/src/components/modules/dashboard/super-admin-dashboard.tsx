"use client";

import { BarChart3, Building2, CheckCircle2, Clock, IndianRupee, Plus, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ROUTES } from "@/constants/routes";
import { formatCurrency, formatDate, formatNumber, humanize } from "@/lib/format";
import { useHospitals } from "@/services/admin";
import { usePlatformOverview } from "@/services/misc";
import { CategoryBarChart } from "../charts/category-bar-chart";
import { CountPill, DashboardHeader, LinkRow, ListSkeleton, ViewAllLink, WidgetState } from "./common";

export function SuperAdminDashboard() {
  const { data: p, isLoading, error, refetch } = usePlatformOverview();

  return (
    <div className="space-y-4">
      <DashboardHeader
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={ROUTES.analytics}>
                <BarChart3 aria-hidden /> Analytics
              </Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.hospitalNew}>
                <Plus aria-hidden /> Onboard hospital
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Hospitals" value={formatNumber(p?.hospitals)} icon={Building2} loading={isLoading} href={ROUTES.hospitals} />
        <StatCard label="Active" value={formatNumber(p?.activeHospitals)} icon={CheckCircle2} tone="success" loading={isLoading} />
        <StatCard
          label="Pending verification"
          value={formatNumber(p?.pendingVerification)}
          icon={Clock}
          tone={p?.pendingVerification ? "warning" : "neutral"}
          loading={isLoading}
        />
        <StatCard label="Users" value={formatNumber(p?.totalUsers)} icon={Users} tone="neutral" loading={isLoading} />
        <StatCard label="Patients" value={formatNumber(p?.totalPatients)} icon={UserRound} tone="neutral" loading={isLoading} />
        <StatCard
          label="MRR"
          value={formatCurrency(p?.monthlyRecurringRevenue, true)}
          icon={IndianRupee}
          tone="success"
          loading={isLoading}
          hint="Active subscriptions"
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <CategoryBarChart
          title="Hospitals by plan"
          description="All hospitals, any status."
          data={p?.hospitalsByPlan.map((x) => ({ label: humanize(x.plan), value: x.count }))}
          valueLabel="Hospitals"
          format={formatNumber}
          layout="vertical"
          multicolor
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
        />
        <SectionCard
          className="xl:col-span-2"
          title="Top hospitals"
          description="Ranked by revenue collected in the last 30 days."
          contentClassName="p-0"
        >
          {isLoading ? (
            <ListSkeleton className="p-4" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <caption className="sr-only">Top hospitals by revenue, last 30 days</caption>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead scope="col" className="pl-4">
                      Hospital
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Appointments (30d)
                    </TableHead>
                    <TableHead scope="col" className="pr-4 text-right">
                      Revenue (30d)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(p?.topHospitals ?? []).slice(0, 8).map((h, i) => (
                    <TableRow key={h.hospitalId}>
                      <TableCell className="pl-4">
                        <Link
                          href={ROUTES.hospital(h.hospitalId)}
                          className="focus-visible:outline-ring rounded font-medium hover:underline focus-visible:outline-2"
                        >
                          <span className="text-muted-foreground mr-2 text-xs tabular-nums">{i + 1}.</span>
                          {h.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(h.appointments)}</TableCell>
                      <TableCell className="pr-4 text-right font-medium tabular-nums">{formatCurrency(h.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>
      <PendingHospitals />
    </div>
  );
}

function PendingHospitals() {
  const { data, isLoading, error, refetch } = useHospitals({ status: ["PENDING_VERIFICATION"], limit: 10 });
  const list = data?.data ?? [];
  return (
    <SectionCard
      title={
        <>
          Awaiting verification
          <CountPill count={data?.meta.total} label="hospitals" />
        </>
      }
      description="Review registration details and activate these hospitals."
      action={<ViewAllLink href={ROUTES.hospitals}>All hospitals</ViewAllLink>}
    >
      <WidgetState
        isLoading={isLoading}
        error={error}
        onRetry={() => refetch()}
        isEmpty={list.length === 0}
        rows={3}
        empty={{ icon: CheckCircle2, title: "No hospitals waiting", description: "Every onboarded hospital has been verified." }}
      >
        <ul className="-mx-2 grid gap-1 md:grid-cols-2">
          {list.map((h) => (
            <li key={h.id}>
              <LinkRow href={ROUTES.hospital(h.id)}>
                <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg" aria-hidden>
                  <Building2 className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{h.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {h.address.city} · {humanize(h.type)} · {humanize(h.plan)} · registered {formatDate(h.createdAt)}
                  </span>
                </span>
                <StatusBadge status={h.status} label="Pending" />
              </LinkRow>
            </li>
          ))}
        </ul>
      </WidgetState>
    </SectionCard>
  );
}
