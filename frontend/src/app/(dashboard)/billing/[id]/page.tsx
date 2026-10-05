"use client";

import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { InvoiceDocument, PrintActions } from "@/components/shared/documents";
import { PageHeader } from "@/components/shared/page-header";
import { DetailSkeleton, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { InvoiceActionsPanel } from "@/components/modules/billing/invoice-actions-panel";
import { ROUTES } from "@/constants/routes";
import { formatDateTime } from "@/lib/format";
import { useInvoice } from "@/services/billing";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading, error, refetch } = useInvoice(id);

  if (isLoading) return <DetailSkeleton />;
  if (error || !invoice) {
    return (
      <div className="space-y-5">
        <PageHeader title="Invoice" breadcrumbs={[{ label: "Billing", href: ROUTES.billing }, { label: "Invoice" }]} />
        <ErrorState error={error ?? new Error("Invoice not found")} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{invoice.number}</span>
            <StatusBadge status={invoice.status} className="text-xs" />
          </span>
        }
        description={`${invoice.patientName} · created ${formatDateTime(invoice.createdAt)}${invoice.issuedAt ? ` · issued ${formatDateTime(invoice.issuedAt)}` : ""}`}
        breadcrumbs={[{ label: "Billing", href: ROUTES.billing }, { label: invoice.number }]}
        actions={<PrintActions pdfPath={`/invoices/${invoice.id}/pdf`} />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="min-w-0">
          <InvoiceDocument invoice={invoice} />
        </motion.div>
        <aside aria-label="Invoice actions" className="lg:sticky lg:top-20">
          <InvoiceActionsPanel invoice={invoice} />
        </aside>
      </div>
    </div>
  );
}
