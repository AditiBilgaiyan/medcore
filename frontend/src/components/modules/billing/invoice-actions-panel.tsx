"use client";

import {
  Ban,
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FilePenLine,
  Loader2,
  Send,
  ShieldCheck,
  ShieldPlus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PaymentDialog } from "@/components/shared/payment-dialog";
import { KeyValueGrid, SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFinaliseInvoice, useVoidInvoice } from "@/services/billing";
import type { InvoiceDetail } from "@/types";
import { ONLINE_PAYABLE_STATUSES, PAYABLE_STATUSES } from "./constants";
import { EditInvoiceSheet, RaiseClaimDialog, RecordCashPaymentDialog } from "./invoice-dialogs";

export function InvoiceActionsPanel({ invoice }: { invoice: InvoiceDetail }) {
  const { can } = useAuth();
  const finalise = useFinaliseInvoice();
  const voidInvoice = useVoidInvoice();

  const isDraft = invoice.status === "DRAFT";
  const canWrite = can("billing:write");
  const canPayOnline = can("billing:pay") && ONLINE_PAYABLE_STATUSES.includes(invoice.status) && invoice.balanceDue > 0;
  const canRecordCash = canWrite && PAYABLE_STATUSES.includes(invoice.status) && invoice.balanceDue > 0;
  const canVoid = canWrite && (invoice.status === "DRAFT" || invoice.status === "ISSUED");
  const hasPayments = invoice.amountPaid > 0;
  const insurance = invoice.patient?.insurance;
  const openClaim = invoice.claim && invoice.claim.status !== "REJECTED";
  const canClaim = can("claims:manage") && ONLINE_PAYABLE_STATUSES.includes(invoice.status) && invoice.balanceDue > 0 && !openClaim;

  const anyAction = (isDraft && canWrite) || canPayOnline || canRecordCash || canClaim || canVoid;

  return (
    <div className="no-print space-y-4">
      <SectionCard title="Amount due" contentClassName="space-y-3">
        <div>
          <p
            className={cn(
              "font-heading text-3xl font-semibold tabular-nums",
              invoice.balanceDue > 0 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {formatCurrency(invoice.balanceDue)}
          </p>
          <p className="text-muted-foreground text-xs">
            of {formatCurrency(invoice.total)} · {formatCurrency(invoice.amountPaid)} paid
            {invoice.dueDate && invoice.balanceDue > 0 && ` · due ${formatDate(invoice.dueDate)}`}
          </p>
        </div>
        <StatusMessage invoice={invoice} />
      </SectionCard>

      {anyAction && (
        <SectionCard title="Actions" contentClassName="flex flex-col gap-2">
          {isDraft && canWrite && (
            <>
              <EditInvoiceSheet
                invoice={invoice}
                trigger={
                  <Button variant="outline" className="w-full justify-start">
                    <FilePenLine /> Edit line items
                  </Button>
                }
              />
              <ConfirmDialog
                title={`Finalise ${invoice.number}?`}
                description={
                  <>
                    The invoice for <strong>{formatCurrency(invoice.total)}</strong> is locked and shared with {invoice.patientName}, who
                    can pay it from the patient portal. Line items can&apos;t be edited afterwards.
                  </>
                }
                confirmLabel="Finalise & share"
                onConfirm={async () => {
                  await finalise.mutateAsync(invoice.id);
                  toast.success(`${invoice.number} finalised and shared with the patient`);
                }}
                trigger={
                  <Button className="w-full justify-start" disabled={finalise.isPending || invoice.items.length === 0}>
                    {finalise.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                    Finalise &amp; share with patient
                  </Button>
                }
              />
            </>
          )}

          {canRecordCash && (
            <RecordCashPaymentDialog
              invoice={invoice}
              trigger={
                <Button variant={canPayOnline ? "outline" : "default"} className="w-full justify-start">
                  <Banknote /> Record cash payment
                </Button>
              }
            />
          )}
          {canPayOnline && (
            <PaymentDialog
              invoiceId={invoice.id}
              amount={invoice.balanceDue}
              trigger={
                <Button className="w-full justify-start">
                  <CreditCard /> Collect online · {formatCurrency(invoice.balanceDue)}
                </Button>
              }
            />
          )}
          {canClaim &&
            (insurance ? (
              <RaiseClaimDialog
                invoice={invoice}
                trigger={
                  <Button variant="outline" className="w-full justify-start">
                    <ShieldPlus /> Raise insurance claim
                  </Button>
                }
              />
            ) : (
              <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
                No insurance policy on file for this patient, so a claim can&apos;t be raised.
              </p>
            ))}

          {canVoid && (
            <>
              <Separator className="my-1" />
              <ConfirmDialog
                title={`Void ${invoice.number}?`}
                description="Voided invoices stay on record for audit but can't be paid or edited. This can't be undone."
                confirmLabel="Void invoice"
                destructive
                reason={{ label: "Reason for voiding", placeholder: "e.g. Duplicate of INV-…, raised in error", required: true }}
                onConfirm={async (reason) => {
                  await voidInvoice.mutateAsync({ id: invoice.id, reason });
                  toast.success(`${invoice.number} voided`);
                }}
                trigger={
                  <Button
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full justify-start"
                    disabled={hasPayments}
                  >
                    <Ban /> Void invoice
                  </Button>
                }
              />
              {hasPayments && (
                <p className="text-muted-foreground text-xs">Invoices with payments can&apos;t be voided. Issue a refund instead.</p>
              )}
            </>
          )}
        </SectionCard>
      )}

      {invoice.claim && <ClaimCard invoice={invoice} />}

      <SectionCard
        title="Patient"
        action={
          can("patients:read") ? (
            <Button asChild variant="ghost" size="xs">
              <Link href={ROUTES.patient(invoice.patientId)}>
                Open <ExternalLink />
              </Link>
            </Button>
          ) : undefined
        }
      >
        <div className="flex items-start gap-3">
          <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full" aria-hidden>
            <UserRound className="size-4" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">{invoice.patientName}</p>
            <p className="text-muted-foreground text-xs">
              MRN <span className="font-mono">{invoice.patientMrn}</span>
              {invoice.patient?.phone && ` · ${invoice.patient.phone}`}
            </p>
            {insurance ? (
              <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                <ShieldCheck className="size-3.5" aria-hidden />
                {insurance.provider} · <span className="font-mono">{insurance.policyNumber}</span>
              </p>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs">No insurance on file</p>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function StatusMessage({ invoice }: { invoice: InvoiceDetail }) {
  const msg: Partial<Record<InvoiceDetail["status"], string>> = {
    DRAFT: "Draft — not visible to the patient yet. Finalise it to share and collect payment.",
    ISSUED: "Shared with the patient. Awaiting payment.",
    PARTIALLY_PAID: "Part-paid. The remaining balance can be collected in cash, online or via insurance.",
    INSURANCE_PENDING: "Awaiting the insurer's decision. Co-pay can still be collected in cash.",
    PAID: "Paid in full. Thank you!",
    VOID: "This invoice was voided and can't be paid.",
  };
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-xs">
      {invoice.status === "PAID" && <CheckCircle2 className="text-success size-3.5 shrink-0" aria-hidden />}
      {msg[invoice.status]}
    </p>
  );
}

function ClaimCard({ invoice }: { invoice: InvoiceDetail }) {
  const { can } = useAuth();
  const claim = invoice.claim!;
  return (
    <SectionCard title="Insurance claim" action={<StatusBadge status={claim.status} />} contentClassName="space-y-3">
      <KeyValueGrid
        items={[
          { label: "Insurer / TPA", value: claim.tpaName },
          { label: "Policy", value: <span className="font-mono">{claim.policyNumber}</span> },
          { label: "Claimed", value: <span className="tabular-nums">{formatCurrency(claim.claimAmount)}</span> },
          {
            label: "Approved",
            value: <span className="tabular-nums">{claim.approvedAmount != null ? formatCurrency(claim.approvedAmount) : "—"}</span>,
          },
          { label: "Submitted", value: formatDateTime(claim.submittedAt) },
          { label: "Updated", value: formatDateTime(claim.updatedAt) },
        ]}
      />
      {claim.remarks && <p className="bg-muted/50 rounded-md px-2.5 py-2 text-xs">{claim.remarks}</p>}
      {can("claims:manage") && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`${ROUTES.claims}?search=${encodeURIComponent(invoice.number)}`}>Manage in claims</Link>
        </Button>
      )}
    </SectionCard>
  );
}
