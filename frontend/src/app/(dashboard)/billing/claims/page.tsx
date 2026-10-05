"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClaimActions } from "@/components/modules/billing/claim-actions";
import { CLAIM_TABS } from "@/components/modules/billing/constants";
import { ROUTES } from "@/constants/routes";
import { formatCurrency, formatDate } from "@/lib/format";
import { useClaims } from "@/services/billing";
import type { InsuranceClaim } from "@/types";

const columns: ColumnDef<InsuranceClaim>[] = [
  {
    accessorKey: "invoiceNumber",
    header: "Invoice",
    cell: ({ row }) => (
      <Link
        href={ROUTES.invoice(row.original.invoiceId)}
        className="text-primary focus-visible:outline-ring rounded font-mono text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-2"
      >
        {row.original.invoiceNumber}
      </Link>
    ),
  },
  {
    accessorKey: "patientName",
    header: "Patient",
    cell: ({ row }) => <span className="font-medium">{row.original.patientName}</span>,
  },
  {
    accessorKey: "tpaName",
    header: "Insurer / TPA",
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.tpaName}</span>,
  },
  {
    accessorKey: "policyNumber",
    header: "Policy",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.policyNumber}</span>,
  },
  {
    accessorKey: "claimAmount",
    header: () => <div className="text-right">Claimed</div>,
    cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.original.claimAmount)}</div>,
  },
  {
    accessorKey: "approvedAmount",
    header: () => <div className="text-right">Approved</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {row.original.approvedAmount != null ? (
          formatCurrency(row.original.approvedAmount)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <div className="space-y-0.5">
        <StatusBadge status={row.original.status} />
        {row.original.remarks && (
          <p className="text-muted-foreground max-w-48 truncate text-xs" title={row.original.remarks}>
            {row.original.remarks}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "submittedAt",
    header: "Submitted",
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatDate(row.original.submittedAt)}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <ClaimActions claim={row.original} />,
  },
];

function ClaimsPageInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState<(typeof CLAIM_TABS)[number]["value"]>("ALL");
  const [search, setSearch] = useState(() => params.get("search") ?? "");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, error, refetch } = useClaims({
    status: status === "ALL" ? undefined : [status],
    search: search || undefined,
    page,
    limit: 20,
  });

  const filtered = status !== "ALL" || !!search;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Insurance claims"
        description="Track TPA claims from submission to settlement. Settling a claim records the insurer's payment on the invoice."
        breadcrumbs={[{ label: "Billing", href: ROUTES.billing }, { label: "Claims" }]}
      />

      <div className="space-y-3">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <Tabs
            value={status}
            onValueChange={(v) => {
              setStatus(v as typeof status);
              setPage(1);
            }}
          >
            <TabsList aria-label="Filter by claim status">
              {CLAIM_TABS.map((t) => (
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
          getRowId={(c) => c.id}
          caption="Insurance claims"
          toolbar={
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search invoice, patient, TPA or policy"
              className="sm:w-80"
            />
          }
          emptyState={
            <EmptyState
              icon={ShieldCheck}
              title={filtered ? "No claims match these filters" : "No insurance claims yet"}
              description={filtered ? "Try another status or search." : "Raise a claim from an issued invoice of an insured patient."}
            />
          }
        />
      </div>
    </div>
  );
}

export default function ClaimsPage() {
  return (
    <Suspense>
      <ClaimsPageInner />
    </Suspense>
  );
}
