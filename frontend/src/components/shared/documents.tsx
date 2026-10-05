"use client";

import { Download, Printer, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL, USE_MOCK_API } from "@/constants/config";
import { FREQUENCY_LABELS } from "@/lib/clinical";
import { ageGender, formatCurrency, formatDate, formatDateTime, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Address, InvoiceDetail, LabOrderDetail, PrescriptionDetail } from "@/types";
import { AllergyBadges, LabResultsTable } from "./clinical";
import { StatusBadge } from "./status-badge";

function addressLine(a?: Address) {
  if (!a) return "";
  return [a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(", ");
}

/**
 * Print / PDF. The real API renders PDFs with Puppeteer (GET …/pdf); in mock mode
 * the browser's print dialog ("Save as PDF") uses the print stylesheet instead.
 */
export function PrintActions({ pdfPath, className }: { pdfPath?: string; className?: string }) {
  return (
    <div className={cn("no-print flex gap-2", className)}>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer /> Print
      </Button>
      <Button
        size="sm"
        onClick={() => {
          if (!USE_MOCK_API && pdfPath) window.open(`${API_BASE_URL}${pdfPath}`, "_blank", "noopener");
          else window.print();
        }}
      >
        <Download /> Download PDF
      </Button>
    </div>
  );
}

function Letterhead({
  name,
  address,
  phone,
  email,
  registrationNumber,
  title,
  meta,
}: {
  name?: string;
  address?: Address;
  phone?: string;
  email?: string;
  registrationNumber?: string;
  title: string;
  meta: React.ReactNode;
}) {
  return (
    <header className="border-primary flex flex-col gap-4 border-b-2 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg" aria-hidden>
          <Stethoscope className="size-5" />
        </span>
        <div>
          <p className="font-heading text-lg font-semibold">{name ?? "MedCore HMS"}</p>
          <p className="text-muted-foreground text-xs">{addressLine(address)}</p>
          <p className="text-muted-foreground text-xs">
            {[phone, email, registrationNumber && `Reg. ${registrationNumber}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="text-left sm:text-right">
        <p className="font-heading text-base font-semibold tracking-wide uppercase">{title}</p>
        <div className="text-muted-foreground text-xs">{meta}</div>
      </div>
    </header>
  );
}

const paper =
  "mx-auto w-full max-w-3xl space-y-5 rounded-xl border bg-card p-5 sm:p-8 print:max-w-none print:border-0 print:p-0 print:shadow-none";

/* ------------------------------------------------------------------ */

export function InvoiceDocument({ invoice }: { invoice: InvoiceDetail }) {
  return (
    <article className={paper} aria-label={`Invoice ${invoice.number}`}>
      <Letterhead
        {...invoice.hospital}
        title="Tax Invoice"
        meta={
          <>
            <p className="text-foreground font-mono text-sm">{invoice.number}</p>
            <p>Issued {formatDate(invoice.issuedAt ?? invoice.createdAt)}</p>
            {invoice.dueDate && <p>Due {formatDate(invoice.dueDate)}</p>}
          </>
        }
      />
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <p className="text-muted-foreground text-xs uppercase">Billed to</p>
          <p className="font-medium">{invoice.patientName}</p>
          <p className="text-muted-foreground text-sm">MRN {invoice.patientMrn}</p>
          {invoice.patient && <p className="text-muted-foreground text-sm">{invoice.patient.phone}</p>}
        </div>
        <div className="sm:text-right">
          <StatusBadge status={invoice.status} />
          {invoice.claim && (
            <p className="text-muted-foreground mt-1 text-xs">
              Claim with {invoice.claim.tpaName}: {humanize(invoice.claim.status)}
            </p>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b text-xs uppercase">
            <tr>
              <th scope="col" className="py-2 text-left font-semibold">
                Description
              </th>
              <th scope="col" className="py-2 text-left font-semibold">
                Type
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Qty
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Rate
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-b last:border-0">
                <td className="py-2 pr-2">{it.description}</td>
                <td className="text-muted-foreground py-2 pr-2">{humanize(it.type)}</td>
                <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(it.unitPrice)}</td>
                <td className="py-2 text-right font-medium tabular-nums">{formatCurrency(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{formatCurrency(invoice.subtotal)}</dd>
        </div>
        {invoice.discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="tabular-nums">−{formatCurrency(invoice.discount)}</dd>
          </div>
        )}
        {invoice.tax > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tax</dt>
            <dd className="tabular-nums">{formatCurrency(invoice.tax)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t pt-1 font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatCurrency(invoice.total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Paid</dt>
          <dd className="tabular-nums">{formatCurrency(invoice.amountPaid)}</dd>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <dt>Balance due</dt>
          <dd className="tabular-nums">{formatCurrency(invoice.balanceDue)}</dd>
        </div>
      </dl>
      {invoice.payments.length > 0 && (
        <section>
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">Payments</h3>
          <ul className="space-y-1 text-sm">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {formatDateTime(p.paidAt)} · {humanize(p.method)}
                  {p.gatewayRef && <span className="text-muted-foreground ml-1 font-mono text-xs">{p.gatewayRef}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  <span className="font-medium tabular-nums">{formatCurrency(p.amount)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {invoice.notes && <p className="text-muted-foreground text-xs whitespace-pre-line">{invoice.notes}</p>}
      <footer className="text-muted-foreground border-t pt-3 text-center text-xs">
        Computer-generated invoice. Healthcare services are exempt from GST.
      </footer>
    </article>
  );
}

/* ------------------------------------------------------------------ */

export function PrescriptionDocument({ prescription: rx }: { prescription: PrescriptionDetail }) {
  return (
    <article className={paper} aria-label={`Prescription ${rx.number}`}>
      <Letterhead
        {...rx.hospital}
        title="Prescription"
        meta={
          <>
            <p className="text-foreground font-mono text-sm">{rx.number}</p>
            <p>{formatDateTime(rx.signedAt)}</p>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-xs uppercase">Patient</p>
          <p className="font-medium">{rx.patientName}</p>
          {rx.patient && (
            <p className="text-muted-foreground text-sm">
              MRN {rx.patient.mrn} · {ageGender(rx.patient.dob, rx.patient.gender)}
            </p>
          )}
        </div>
        <div className="sm:text-right">
          <p className="text-muted-foreground text-xs uppercase">Prescriber</p>
          <p className="font-medium">{rx.doctorName}</p>
          {rx.doctor && (
            <p className="text-muted-foreground text-sm">
              {rx.doctor.qualification} · Reg. {rx.doctor.registrationNumber}
            </p>
          )}
        </div>
      </div>
      {rx.patient && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs uppercase">Allergies</span>
          <AllergyBadges allergies={rx.patient.allergies} />
        </div>
      )}
      {rx.diagnoses.length > 0 && (
        <p className="text-sm">
          <span className="text-muted-foreground text-xs uppercase">Diagnosis </span>
          {rx.diagnoses.map((d) => `${d.description} (${d.code})`).join("; ")}
        </p>
      )}
      <div>
        <p className="font-heading text-primary mb-2 text-2xl font-semibold" aria-hidden>
          ℞
        </p>
        <ol className="space-y-3">
          {rx.items.map((it, i) => (
            <li key={it.id} className="flex gap-3 border-b pb-3 last:border-0">
              <span className="text-muted-foreground w-5 text-sm tabular-nums">{i + 1}.</span>
              <div className="flex-1">
                <p className="font-medium">
                  {it.medicineName} <span className="text-muted-foreground text-sm font-normal">({humanize(it.form)})</span>
                </p>
                <p className="text-sm">
                  {it.dosage} · {it.frequency} — {FREQUENCY_LABELS[it.frequency]} · {it.durationDays} days · Qty {it.quantity}
                </p>
                {it.instructions && <p className="text-muted-foreground text-sm">{it.instructions}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>
      {rx.notes && (
        <p className="text-sm whitespace-pre-line">
          <span className="text-muted-foreground text-xs uppercase">Advice </span>
          {rx.notes}
        </p>
      )}
      <div className="flex justify-end pt-6">
        <div className="text-center">
          {rx.doctor?.signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rx.doctor.signatureDataUrl} alt={`Signature of ${rx.doctorName}`} className="mx-auto h-12 object-contain" />
          ) : (
            <p className="font-heading text-primary text-lg italic">{rx.doctorName}</p>
          )}
          <p className="text-muted-foreground border-t pt-1 text-xs">Digitally signed · {formatDateTime(rx.signedAt)}</p>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

export function LabReportDocument({ order, hospitalName }: { order: LabOrderDetail; hospitalName?: string }) {
  return (
    <article className={paper} aria-label={`Lab report ${order.number}`}>
      <Letterhead
        name={hospitalName}
        title="Laboratory Report"
        meta={
          <>
            <p className="text-foreground font-mono text-sm">{order.number}</p>
            <p>Collected {formatDateTime(order.collectedAt)}</p>
            {order.approvedAt && <p>Reported {formatDateTime(order.approvedAt)}</p>}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-xs uppercase">Patient</p>
          <p className="font-medium">{order.patientName}</p>
          <p className="text-muted-foreground text-sm">{humanize(order.patientGender)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Referred by</p>
          <p className="font-medium">{order.doctorName}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase">Status</p>
          <StatusBadge status={order.status} />
        </div>
      </div>
      {order.results.length > 0 ? (
        <LabResultsTable results={order.results} tests={order.tests} />
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">Results are not available yet.</p>
      )}
      {order.technicianRemarks && (
        <p className="text-sm">
          <span className="text-muted-foreground text-xs uppercase">Remarks </span>
          {order.technicianRemarks}
        </p>
      )}
      {order.reportAttachment && (
        <a
          href={order.reportAttachment.url}
          download={order.reportAttachment.name}
          className="no-print text-primary inline-flex text-sm font-medium underline-offset-4 hover:underline"
        >
          Download attached report ({order.reportAttachment.name})
        </a>
      )}
      <footer className="text-muted-foreground flex flex-wrap justify-between gap-2 border-t pt-3 text-xs">
        <span>Processed by {order.processedByName ?? "—"}</span>
        <span>Approved by {order.approvedByName ?? "—"}</span>
      </footer>
    </article>
  );
}
