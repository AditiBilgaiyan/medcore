"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FilePlus2, FileText, HandCoins, Hourglass, ReceiptIndianRupee, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { DateRangeFilter, lastNDays, type DateRange } from "@/components/shared/date-range-filter";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { INVOICE_TABS } from "@/components/modules/billing/constants";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBillingSummary, useInvoices } from "@/services/billing";
import type { Invoice } from "@/types";

function RightHeader({ label }: { label: string }) {
  return <div className="text-right">{label}</div>;
}

const columns: ColumnDef<Invoice>[] = [
  {
    accessorKey: "number",
    header: "Invoice",
    cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.number}</span>,
  },
  {
    id: "patient",
    header: "Patient",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.patientName}</p>
        <p className="text-muted-foreground font-mono text-xs">{row.original.patientMrn}</p>
      </div>
    ),
  },
  {
    id: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">{formatDate(row.original.issuedAt ?? row.original.createdAt)}</span>
    ),
  },
  {
    id: "items",
    header: () => <RightHeader label="Items" />,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.items.length}</div>,
  },
  {
    accessorKey: "total",
    header: () => <RightHeader label="Total" />,
    cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.original.total)}</div>,
  },
  {
    accessorKey: "amountPaid",
    header: () => <RightHeader label="Paid" />,
    cell: ({ row }) => <div className="text-muted-foreground text-right tabular-nums">{formatCurrency(row.original.amountPaid)}</div>,
  },
  {
    accessorKey: "balanceDue",
    header: () => <RightHeader label="Balance due" />,
    cell: ({ row }) => {
      const due = row.original.balanceDue;
      const open = due > 0 && row.original.status !== "VOID";
      return <div className={cn("text-right tabular-nums", open ? "font-semibold" : "text-muted-foreground")}>{formatCurrency(due)}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

const SUMMARY_ROLES = ["RECEPTIONIST", "ACCOUNTANT", "HOSPITAL_ADMIN"];

function BillingSummaryCards() {
  const { can } = useAuth();
  const { data, isLoading } = useBillingSummary();
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatCard
        label="Outstanding"
        value={formatCurrency(data?.outstanding)}
        icon={Wallet}
        tone="warning"
        loading={isLoading}
        hint="Issued, part-paid & insurance"
      />
      <StatCard
        label="Collected today"
        value={formatCurrency(data?.collectedToday)}
        icon={HandCoins}
        tone="success"
        loading={isLoading}
        hint="All payment methods"
      />
      <StatCard label="Invoices today" value={formatNumber(data?.invoicesToday)} icon={ReceiptIndianRupee} loading={isLoading} />
      <StatCard
        label="Drafts"
        value={formatNumber(data?.draftInvoices)}
        icon={FileText}
        tone="neutral"
        loading={isLoading}
        href={`${ROUTES.billing}?status=DRAFT`}
        hint="Not yet shared"
      />
      <StatCard
        label="Pending claims"
        value={formatNumber(data?.pendingClaims)}
        icon={can("claims:manage") ? ShieldCheck : Hourglass}
        tone="primary"
        loading={isLoading}
        href={can("claims:manage") ? ROUTES.claims : `${ROUTES.billing}?status=INSURANCE_PENDING`}
        hint="Awaiting insurer"
        className="col-span-2 md:col-span-1"
      />
    </div>
  );
}

function BillingPageInner() {
  const { user, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const statusParam = params.get("status");
  const status = INVOICE_TABS.some((t) => t.value === statusParam) ? (statusParam as (typeof INVOICE_TABS)[number]["value"]) : "ALL";

  const patientId = params.get("patientId") ?? undefined;
  const [search, setSearch] = useState("");
  // When opened for one patient (e.g. from the pharmacy), show their whole history.
  const [range, setRange] = useState<DateRange>(() => (patientId ? { from: "", to: "" } : lastNDays(30)));
  const [page, setPage] = useState(1);

  const query = useMemo(
    () => ({
      status: status === "ALL" ? undefined : status,
      patientId,
      search: search || undefined,
      from: range.from || undefined,
      to: range.to || undefined,
      page,
      limit: 20,
    }),
    [status, patientId, search, range, page],
  );
  const { data, isLoading, isFetching, error, refetch } = useInvoices(query);

  const setStatus = (v: string) => {
    setPage(1);
    const next = new URLSearchParams(params.toString());
    if (v === "ALL") next.delete("status");
    else next.set("status", v);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const allTime = !range.from && !range.to;
  const filtered = status !== "ALL" || !!search || !allTime || !!patientId;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing"
        description="Invoices, payments and balances for your hospital."
        actions={
          <>
            {can("claims:manage") && (
              <Button asChild variant="outline">
                <Link href={ROUTES.claims}>
                  <ShieldCheck /> Insurance claims
                </Link>
              </Button>
            )}
            {can("billing:write") && (
              <Button asChild>
                <Link href={ROUTES.invoiceNew}>
                  <FilePlus2 /> New invoice
                </Link>
              </Button>
            )}
          </>
        }
      />

      {user && SUMMARY_ROLES.includes(user.role) && <BillingSummaryCards />}

      {patientId && (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
          <span>
            Showing invoices for{" "}
            <span className="font-medium">
              {data?.data[0] ? `${data.data[0].patientName} (${data.data[0].patientMrn})` : "one patient"}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(params.toString());
              next.delete("patientId");
              const qs = next.toString();
              router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
            }}
          >
            Show all patients
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <Tabs value={status} onValueChange={setStatus}>
            <TabsList aria-label="Filter by invoice status">
              {INVOICE_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="px-2.5">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <DataTable
          columns={columns}
          data={data?.data}
          isLoading={isLoading}
          isFetching={isFetching}
          error={error}
          onRetry={() => void refetch()}
          meta={data?.meta}
          onPageChange={setPage}
          rowHref={(inv) => ROUTES.invoice(inv.id)}
          getRowId={(inv) => inv.id}
          caption="Invoices"
          toolbar={
            <>
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder="Search invoice no., patient or MRN"
                className="sm:w-80"
              />
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <DateRangeFilter
                  value={range}
                  onChange={(r) => {
                    setRange(r);
                    setPage(1);
                  }}
                />
                <Button
                  size="xs"
                  variant={allTime ? "secondary" : "ghost"}
                  aria-pressed={allTime}
                  onClick={() => {
                    setRange({ from: "", to: "" });
                    setPage(1);
                  }}
                >
                  All time
                </Button>
              </div>
            </>
          }
          emptyState={
            <EmptyState
              icon={ReceiptIndianRupee}
              title={filtered ? "No invoices match these filters" : "No invoices yet"}
              description={
                filtered ? "Try another status, a wider date range or a different search." : "Invoices you create will appear here."
              }
              action={
                !filtered && can("billing:write") ? (
                  <Button asChild size="sm">
                    <Link href={ROUTES.invoiceNew}>
                      <FilePlus2 /> New invoice
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingPageInner />
    </Suspense>
  );
}
