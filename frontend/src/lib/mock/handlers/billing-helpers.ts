import type { Invoice, InvoiceItem } from "@/types";
import { uid } from "../db";
import { round2, type MockContext } from "../router";

/** Recompute totals. Billing integrity: total always equals the sum of line items. */
export function recalcInvoice(inv: Invoice): Invoice {
  inv.items.forEach((it) => (it.amount = round2(it.quantity * it.unitPrice)));
  inv.subtotal = round2(inv.items.reduce((s, it) => s + it.amount, 0));
  inv.discount = Math.min(round2(inv.discount || 0), inv.subtotal);
  inv.tax = round2((inv.subtotal - inv.discount) * inv.taxRate);
  inv.total = round2(inv.subtotal - inv.discount + inv.tax);
  inv.amountPaid = round2(inv.payments.filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + p.amount, 0));
  inv.balanceDue = round2(Math.max(inv.total - inv.amountPaid, 0));
  if (inv.status !== "DRAFT" && inv.status !== "VOID") {
    if (inv.total > 0 && inv.balanceDue <= 0) inv.status = "PAID";
    else if (inv.status === "PAID") inv.status = inv.amountPaid > 0 ? "PARTIALLY_PAID" : "ISSUED";
    else if (inv.amountPaid > 0 && inv.status !== "INSURANCE_PENDING") inv.status = "PARTIALLY_PAID";
  }
  inv.updatedAt = new Date().toISOString();
  return inv;
}

export function newInvoice(ctx: MockContext, patientId: string, appointmentId?: string): Invoice {
  const patient = ctx.db.patients.find((p) => p.id === patientId)!;
  const now = new Date().toISOString();
  const inv: Invoice = {
    id: uid("inv"),
    hospitalId: patient.hospitalId,
    number: ctx.number("inv", "INV"),
    patientId,
    patientName: `${patient.firstName} ${patient.lastName}`,
    patientMrn: patient.mrn,
    appointmentId,
    status: "DRAFT",
    items: [],
    subtotal: 0,
    discount: 0,
    taxRate: 0,
    tax: 0,
    total: 0,
    amountPaid: 0,
    balanceDue: 0,
    currency: "INR",
    payments: [],
    createdAt: now,
    updatedAt: now,
  };
  ctx.db.invoices.unshift(inv);
  return inv;
}

/**
 * Add charges for a visit. Items go onto the visit's open (DRAFT) invoice; if the visit's
 * invoice is already issued or paid, a new draft is opened so finalised invoices never change.
 */
export function addVisitCharges(
  ctx: MockContext,
  patientId: string,
  appointmentId: string | undefined,
  items: Omit<InvoiceItem, "id" | "amount">[],
): Invoice {
  let inv = appointmentId ? ctx.db.invoices.find((i) => i.appointmentId === appointmentId && i.status === "DRAFT") : undefined;
  if (!inv) {
    inv = newInvoice(ctx, patientId, appointmentId);
    const appt = ctx.db.appointments.find((a) => a.id === appointmentId);
    if (appt && !appt.invoiceId) appt.invoiceId = inv.id;
  }
  for (const it of items) inv.items.push({ ...it, id: uid("ii"), amount: 0 });
  return recalcInvoice(inv);
}
