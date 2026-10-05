"use client";

import { CheckCircle2, ChevronRight, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FadeIn, InfoNote, ListSkeleton, Pager } from "@/components/modules/portal/portal-ui";
import { INVOICE_STATUS_COPY, PAYABLE_STATUSES } from "@/components/modules/portal/portal-utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useInvoices } from "@/services/billing";

function OutstandingSummary() {
  const due = useInvoices({ status: PAYABLE_STATUSES, limit: 100, sortBy: "createdAt", sortOrder: "asc" });
  const list = due.data?.data.filter((i) => i.balanceDue > 0) ?? [];
  const total = list.reduce((s, i) => s + i.balanceDue, 0);
  const owed = total > 0;

  return (
    <Card className={cn("gap-3 p-5 sm:flex-row sm:items-center sm:justify-between", owed && "border-amber-300 dark:border-amber-500/40")}>
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl",
            owed
              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
          )}
          aria-hidden
        >
          {owed ? <Wallet className="size-6" /> : <CheckCircle2 className="size-6" />}
        </span>
        <div>
          <p className="text-muted-foreground text-sm font-medium">Total outstanding</p>
          {due.isLoading ? (
            <Skeleton className="mt-1 h-8 w-32" />
          ) : due.error ? (
            <p className="text-destructive text-sm">Couldn&apos;t load your balance.</p>
          ) : (
            <>
              <p className="font-heading text-3xl font-semibold tabular-nums">{formatCurrency(total)}</p>
              <p className="text-muted-foreground text-sm">
                {owed ? `Across ${list.length} unpaid ${list.length === 1 ? "bill" : "bills"}` : "Nothing to pay right now. Thank you!"}
              </p>
            </>
          )}
        </div>
      </div>
      {owed && (
        <Button size="lg" className="w-full sm:w-auto" asChild>
          <Link href={ROUTES.portalInvoice(list[0].id)}>{list.length === 1 ? "Pay now" : "Pay oldest bill"}</Link>
        </Button>
      )}
    </Card>
  );
}

export default function PortalInvoicesPage() {
  const [page, setPage] = useState(1);
  const invoices = useInvoices({ page, limit: 10 });
  const list = invoices.data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Bills & payments"
        description="See what you've been charged, what you've paid, and pay securely online."
        breadcrumbs={[{ label: "Home", href: ROUTES.portal }, { label: "Bills" }]}
      />

      <FadeIn>
        <OutstandingSummary />
      </FadeIn>

      {invoices.isLoading ? (
        <ListSkeleton />
      ) : invoices.error && !invoices.data ? (
        <Card className="p-0">
          <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
        </Card>
      ) : !list.length ? (
        <Card className="p-0">
          <EmptyState icon={Receipt} title="No bills yet" description="Bills for consultations, tests and medicines will appear here." />
        </Card>
      ) : (
        <>
          <h2 className="pt-2 text-base font-semibold">All bills</h2>
          <ul className="space-y-3">
            {list.map((inv, i) => {
              const copy = INVOICE_STATUS_COPY[inv.status];
              const payable = PAYABLE_STATUSES.includes(inv.status) && inv.balanceDue > 0;
              return (
                <FadeIn as="li" key={inv.id} delay={Math.min(i, 5) * 0.03}>
                  <Link
                    href={ROUTES.portalInvoice(inv.id)}
                    className="group bg-card hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-ring block rounded-xl border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-base font-semibold md:text-sm">{inv.number}</p>
                        <p className="text-muted-foreground text-sm">
                          {formatDate(inv.issuedAt ?? inv.createdAt)}
                          {inv.items[0] && ` · ${inv.items[0].description}${inv.items.length > 1 ? ` +${inv.items.length - 1} more` : ""}`}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={inv.status} label={copy.label} />
                        <ChevronRight
                          className="text-muted-foreground size-5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-base md:text-sm">
                      <div>
                        <dt className="text-muted-foreground text-xs">Total</dt>
                        <dd className="font-medium tabular-nums">{formatCurrency(inv.total)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs">Paid</dt>
                        <dd className="tabular-nums">{formatCurrency(inv.amountPaid)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs">Balance</dt>
                        <dd className={cn("font-semibold tabular-nums", payable && "text-amber-800 dark:text-amber-300")}>
                          {formatCurrency(inv.balanceDue)}
                        </dd>
                      </div>
                    </dl>
                    {payable && inv.dueDate && (
                      <p className="text-muted-foreground mt-2 text-sm">Please pay by {formatDate(inv.dueDate)}.</p>
                    )}
                  </Link>
                </FadeIn>
              );
            })}
          </ul>
          <Pager meta={invoices.data?.meta} onPageChange={setPage} label="bills" />
        </>
      )}

      <InfoNote title="Paying online">
        Payments are handled securely by Stripe or Razorpay — we never see your card details. Your bill updates automatically once your bank
        confirms the payment.
      </InfoNote>
    </div>
  );
}
