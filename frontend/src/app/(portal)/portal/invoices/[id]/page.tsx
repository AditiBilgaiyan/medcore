"use client";

import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FadeIn, InfoNote } from "@/components/modules/portal/portal-ui";
import { INVOICE_STATUS_COPY, PAYABLE_STATUSES } from "@/components/modules/portal/portal-utils";
import { InvoiceDocument, PrintActions } from "@/components/shared/documents";
import { PageHeader } from "@/components/shared/page-header";
import { PaymentDialog } from "@/components/shared/payment-dialog";
import { KeyValueGrid, SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { formatCurrency, formatDate } from "@/lib/format";
import { useInvoice } from "@/services/billing";
import type { ClaimStatus } from "@/types";

const CLAIM_COPY: Record<ClaimStatus, string> = {
  SUBMITTED: "We've sent this bill to your insurer. They usually respond within a few working days.",
  UNDER_REVIEW: "Your insurer is reviewing the claim. You don't need to do anything right now.",
  APPROVED: "Your insurer has approved the claim. The approved amount will be settled with the hospital.",
  REJECTED: "Your insurer declined this claim. The remaining balance is payable by you — contact the billing desk if you have questions.",
  SETTLED: "Your insurer has paid the hospital.",
};

/** How long to keep checking for the gateway's confirmation after paying. */
const CONFIRM_WINDOW_MS = 30_000;

export default function PortalInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [confirming, setConfirming] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invoice = useInvoice(id, { refetchInterval: confirming ? 3000 : false });
  const crumbs = [
    { label: "Home", href: ROUTES.portal },
    { label: "Bills", href: ROUTES.portalInvoices },
  ];

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (invoice.isLoading) return <DetailSkeleton />;
  if (invoice.error || !invoice.data) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Bill" breadcrumbs={[...crumbs, { label: "Bill" }]} />
        <ErrorState error={invoice.error} onRetry={() => invoice.refetch()} />
      </div>
    );
  }

  const inv = invoice.data;
  const copy = INVOICE_STATUS_COPY[inv.status];
  const payable = PAYABLE_STATUSES.includes(inv.status) && inv.balanceDue > 0;
  const stillConfirming = confirming && payable;

  // The server marks the invoice paid when the gateway's signed webhook arrives —
  // we only refetch (and briefly poll) to pick up the new status.
  const onPaid = () => {
    setPaidAmount(inv.balanceDue);
    void invoice.refetch();
    setConfirming(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
  };

  // Stay mounted while confirming so the dialog's success screen isn't torn down
  // when the refetched invoice flips to PAID.
  const payButton = (payable || confirming) && (
    <PaymentDialog
      invoiceId={inv.id}
      amount={confirming ? paidAmount : inv.balanceDue}
      onPaid={onPaid}
      trigger={
        <Button size="lg" className="w-full sm:w-auto" disabled={!payable || stillConfirming}>
          <CreditCard /> {payable ? `Pay ${formatCurrency(inv.balanceDue)}` : "Paid"}
        </Button>
      }
    />
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title={`Bill ${inv.number}`}
        description={`Issued ${formatDate(inv.issuedAt ?? inv.createdAt)}${inv.dueDate && payable ? ` · Due ${formatDate(inv.dueDate)}` : ""}`}
        breadcrumbs={[...crumbs, { label: inv.number }]}
        actions={<PrintActions pdfPath={`/invoices/${inv.id}/pdf`} />}
      />

      <FadeIn className="no-print">
        <Card className="gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={inv.status} label={copy.label} />
              {stillConfirming && (
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm" role="status">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Confirming your payment with the bank…
                </span>
              )}
            </div>
            <p className="font-heading text-3xl font-semibold tabular-nums">
              {formatCurrency(inv.balanceDue)}
              <span className="text-muted-foreground ml-2 text-base font-normal">{payable ? "to pay" : "balance"}</span>
            </p>
            <p className="text-muted-foreground text-base md:text-sm">
              {copy.help} Total {formatCurrency(inv.total)}, paid so far {formatCurrency(inv.amountPaid)}.
            </p>
          </div>
          {payButton}
        </Card>
      </FadeIn>

      {inv.claim && (
        <FadeIn delay={0.03} className="no-print">
          <SectionCard
            title="Insurance claim"
            description={CLAIM_COPY[inv.claim.status]}
            action={<StatusBadge status={inv.claim.status} />}
          >
            <KeyValueGrid
              columns={4}
              items={[
                { label: "Insurer / TPA", value: inv.claim.tpaName },
                { label: "Policy number", value: <span className="font-mono">{inv.claim.policyNumber}</span> },
                { label: "Amount claimed", value: formatCurrency(inv.claim.claimAmount) },
                {
                  label: "Amount approved",
                  value: inv.claim.approvedAmount != null ? formatCurrency(inv.claim.approvedAmount) : "Awaiting decision",
                },
              ]}
            />
            {inv.claim.remarks && (
              <p className="text-muted-foreground mt-3 text-base md:text-sm">Insurer&apos;s note: {inv.claim.remarks}</p>
            )}
          </SectionCard>
        </FadeIn>
      )}

      <FadeIn delay={0.06}>
        <InvoiceDocument invoice={inv} />
      </FadeIn>

      <InfoNote className="no-print" icon={ShieldCheck} title="Secure payments">
        Card, UPI and netbanking payments are processed by Stripe or Razorpay. Your bill is marked as paid only after the payment provider
        confirms it, which usually takes a few seconds. Questions about a charge? Contact the hospital billing desk.
      </InfoNote>
    </div>
  );
}
