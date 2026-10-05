import type { ClaimStatus, Invoice, InvoiceItem, Payment, PaymentMethod } from "@/types";
import { uid } from "../db";
import {
  created,
  fail,
  forbidden,
  matchesSearch,
  notFound,
  ok,
  paginate,
  requireFields,
  round2,
  route,
  sortBy,
  todayStr,
  type MockContext,
} from "../router";
import { newInvoice, recalcInvoice } from "./billing-helpers";

function loadInvoice(ctx: MockContext, id: string): Invoice {
  const user = ctx.requirePermission("billing:read");
  const inv = ctx.db.invoices.find((x) => x.id === id);
  if (!inv) notFound("Invoice");
  if (user.role === "PATIENT") {
    if (inv!.patientId !== ctx.ownPatientId() || inv!.status === "DRAFT") notFound("Invoice");
  } else ctx.assertTenant(inv, "Invoice");
  return inv!;
}

function validateItems(items: unknown): Omit<InvoiceItem, "id" | "amount">[] {
  if (!Array.isArray(items) || !items.length) fail(422, "VALIDATION_ERROR", "Add at least one line item.", { items: ["Required."] });
  return (items as Record<string, unknown>[]).map((it, i) => {
    const quantity = Number(it.quantity);
    const unitPrice = Number(it.unitPrice);
    if (!String(it.description ?? "").trim()) fail(422, "VALIDATION_ERROR", `Line ${i + 1}: description is required.`);
    if (!(quantity > 0) || !(unitPrice >= 0))
      fail(422, "VALIDATION_ERROR", `Line ${i + 1}: quantity must be positive and price can't be negative.`);
    return {
      type: (it.type as InvoiceItem["type"]) ?? "OTHER",
      description: String(it.description).trim(),
      quantity,
      unitPrice,
      refId: it.refId as string | undefined,
    };
  });
}

function applyPayment(ctx: MockContext, inv: Invoice, method: PaymentMethod, amount: number, gatewayRef?: string): Payment {
  const user = ctx.user;
  const payment: Payment = {
    id: uid("pay"),
    invoiceId: inv.id,
    amount: round2(amount),
    method,
    status: "SUCCEEDED",
    gatewayRef,
    paidAt: new Date().toISOString(),
    receivedByName: method === "CASH" && user ? `${user.firstName} ${user.lastName}` : undefined,
  };
  inv.payments.push(payment);
  recalcInvoice(inv);
  const patientUserId = ctx.db.patients.find((p) => p.id === inv.patientId)?.userId;
  ctx.notify(patientUserId, {
    type: "PAYMENT_RECEIVED",
    title: "Payment received",
    body: `₹${payment.amount.toLocaleString("en-IN")} received for ${inv.number}. ${inv.balanceDue > 0 ? `Balance due ₹${inv.balanceDue.toLocaleString("en-IN")}.` : "Thank you!"}`,
    link: `/portal/invoices/${inv.id}`,
    channels: ["EMAIL", "SMS"],
  });
  ctx.notifyRole("ACCOUNTANT", inv.hospitalId, {
    type: "PAYMENT_RECEIVED",
    title: "Payment received",
    body: `${inv.number}: ₹${payment.amount.toLocaleString("en-IN")} via ${method.replace(/_/g, " ").toLowerCase()}`,
    link: `/billing/${inv.id}`,
    channels: ["IN_APP"],
  });
  return payment;
}

route("GET", "/invoices", (ctx) => {
  const user = ctx.requirePermission("billing:read");
  const tenant = ctx.tenantId();
  const status = ctx.query.arr("status");
  const from = ctx.query.str("from");
  const to = ctx.query.str("to");
  const search = ctx.query.str("search");
  const patientId = user.role === "PATIENT" ? (ctx.ownPatientId() ?? "none") : ctx.query.str("patientId");
  const list = ctx.db.invoices.filter(
    (i) =>
      (tenant === null || i.hospitalId === tenant) &&
      (!patientId || i.patientId === patientId) &&
      (user.role !== "PATIENT" || i.status !== "DRAFT") &&
      (!status || status.includes(i.status)) &&
      (!from || i.createdAt.slice(0, 10) >= from) &&
      (!to || i.createdAt.slice(0, 10) <= to) &&
      matchesSearch(search, i.number, i.patientName, i.patientMrn),
  );
  return paginate(sortBy(list, ctx.query, { key: "createdAt", order: "desc" }), ctx.query);
});

route("GET", "/invoices/:id", (ctx) => {
  const inv = loadInvoice(ctx, ctx.params.id);
  const hospital = ctx.db.hospitals.find((h) => h.id === inv.hospitalId);
  const patient = ctx.db.patients.find((p) => p.id === inv.patientId);
  const claim = inv.claimId ? ctx.db.claims.find((c) => c.id === inv.claimId) : undefined;
  return ok({
    ...inv,
    hospital: hospital && {
      name: hospital.name,
      address: hospital.address,
      phone: hospital.phone,
      email: hospital.email,
      registrationNumber: hospital.registrationNumber,
    },
    patient: patient && { phone: patient.phone, email: patient.email, address: patient.address, insurance: patient.insurance },
    claim,
  });
});

route("POST", "/invoices", (ctx) => {
  ctx.requirePermission("billing:write");
  requireFields(ctx.body, ["patientId", "items"]);
  const patient = ctx.db.patients.find((p) => p.id === ctx.body.patientId && !p.deletedAt);
  ctx.assertTenant(patient, "Patient");
  const items = validateItems(ctx.body.items);
  const inv = newInvoice(ctx, patient!.id, (ctx.body.appointmentId as string) || undefined);
  inv.items = items.map((it) => ({ ...it, id: uid("ii"), amount: 0 }));
  inv.discount = Number(ctx.body.discount) || 0;
  inv.notes = (ctx.body.notes as string) || undefined;
  recalcInvoice(inv);
  ctx.audit("CREATE", "Invoice", inv.id, `Created draft ${inv.number} for ${inv.patientName}`);
  return created(inv, "Draft invoice created");
});

route("PATCH", "/invoices/:id", (ctx) => {
  ctx.requirePermission("billing:write");
  const inv = loadInvoice(ctx, ctx.params.id);
  if (inv.status !== "DRAFT") fail(409, "INVOICE_LOCKED", "Only draft invoices can be edited.");
  if (ctx.body.items !== undefined) inv.items = validateItems(ctx.body.items).map((it) => ({ ...it, id: uid("ii"), amount: 0 }));
  if (ctx.body.discount !== undefined) {
    const d = Number(ctx.body.discount);
    if (d < 0) fail(422, "VALIDATION_ERROR", "Discount can't be negative.", { discount: ["Must be ≥ 0."] });
    inv.discount = d;
  }
  if (ctx.body.notes !== undefined) inv.notes = String(ctx.body.notes) || undefined;
  recalcInvoice(inv);
  if (inv.discount > inv.subtotal) fail(422, "VALIDATION_ERROR", "Discount can't exceed the subtotal.");
  return ok(inv, "Invoice updated");
});

route("POST", "/invoices/:id/finalise", (ctx) => {
  ctx.requirePermission("billing:write");
  const inv = loadInvoice(ctx, ctx.params.id);
  if (inv.status !== "DRAFT") fail(422, "INVALID_TRANSITION", "Invoice is already finalised.");
  if (!inv.items.length) fail(422, "VALIDATION_ERROR", "Add at least one line item before finalising.");
  inv.status = "ISSUED";
  inv.issuedAt = new Date().toISOString();
  const due = new Date();
  due.setDate(due.getDate() + 7);
  inv.dueDate = due.toISOString().slice(0, 10);
  recalcInvoice(inv);
  const patientUserId = ctx.db.patients.find((p) => p.id === inv.patientId)?.userId;
  ctx.notify(patientUserId, {
    type: "INVOICE_GENERATED",
    title: "New invoice",
    body: `${inv.number} for ₹${inv.total.toLocaleString("en-IN")} is ready. Pay online from your portal.`,
    link: `/portal/invoices/${inv.id}`,
    channels: ["EMAIL", "IN_APP"],
  });
  ctx.audit("UPDATE", "Invoice", inv.id, `Finalised ${inv.number} (₹${inv.total})`);
  return ok(inv, "Invoice finalised and shared with the patient");
});

route("POST", "/invoices/:id/void", (ctx) => {
  ctx.requirePermission("billing:write");
  const inv = loadInvoice(ctx, ctx.params.id);
  if (inv.amountPaid > 0) fail(422, "INVOICE_HAS_PAYMENTS", "Invoices with payments can't be voided. Issue a refund instead.");
  if (!String(ctx.body.reason ?? "").trim()) fail(422, "VALIDATION_ERROR", "Give a reason for voiding.", { reason: ["Required."] });
  inv.status = "VOID";
  inv.notes = [inv.notes, `Voided: ${ctx.body.reason}`].filter(Boolean).join("\n");
  inv.updatedAt = new Date().toISOString();
  ctx.audit("UPDATE", "Invoice", inv.id, `Voided ${inv.number}: ${ctx.body.reason}`);
  return ok(inv, "Invoice voided");
});

/** Counter payments (cash) recorded by staff. */
route("POST", "/invoices/:id/payments", (ctx) => {
  ctx.requirePermission("billing:write");
  const inv = loadInvoice(ctx, ctx.params.id);
  if (!["ISSUED", "PARTIALLY_PAID", "INSURANCE_PENDING"].includes(inv.status))
    fail(422, "INVALID_TRANSITION", "This invoice can't accept payments.");
  const amount = Number(ctx.body.amount);
  if (!(amount > 0)) fail(422, "VALIDATION_ERROR", "Enter an amount.", { amount: ["Must be positive."] });
  if (amount > inv.balanceDue + 0.001)
    fail(422, "OVERPAYMENT", `Amount exceeds the balance due (₹${inv.balanceDue}).`, { amount: ["Too high."] });
  if (ctx.body.method !== "CASH") fail(422, "VALIDATION_ERROR", "Online payments go through the payment gateway.");
  const payment = applyPayment(ctx, inv, "CASH", amount);
  ctx.audit("UPDATE", "Invoice", inv.id, `Recorded cash payment ₹${payment.amount} on ${inv.number}`);
  return created(inv, "Payment recorded");
});

/* ---------------- Payment gateway ---------------- */

const sessions = new Map<string, { invoiceId: string; amount: number; provider: "STRIPE" | "RAZORPAY"; used: boolean }>();
export const webhookSignature = (sessionId: string) => `whsec_mock_${sessionId}`;

route("POST", "/payments/checkout", (ctx) => {
  const user = ctx.requirePermission("billing:pay");
  requireFields(ctx.body, ["invoiceId", "provider"]);
  const inv = loadInvoice(ctx, String(ctx.body.invoiceId));
  if (user.role === "PATIENT" && inv.patientId !== ctx.ownPatientId()) forbidden();
  if (!["ISSUED", "PARTIALLY_PAID"].includes(inv.status) || inv.balanceDue <= 0)
    fail(422, "NOTHING_TO_PAY", "This invoice has no balance due.");
  const provider = ctx.body.provider === "RAZORPAY" ? "RAZORPAY" : "STRIPE";
  const sessionId = `${provider === "STRIPE" ? "cs_test" : "order"}_${uid("s").slice(2)}${Date.now().toString(36)}`;
  sessions.set(sessionId, { invoiceId: inv.id, amount: inv.balanceDue, provider, used: false });
  return created({ invoiceId: inv.id, provider, sessionId, amount: inv.balanceDue, currency: "INR" });
});

function handleWebhook(ctx: MockContext, provider: "STRIPE" | "RAZORPAY") {
  requireFields(ctx.body, ["sessionId", "outcome", "signature"]);
  const sessionId = String(ctx.body.sessionId);
  // Never trust the client: verify the gateway signature before touching the invoice.
  if (ctx.body.signature !== webhookSignature(sessionId)) fail(400, "INVALID_SIGNATURE", "Webhook signature verification failed.");
  const session = sessions.get(sessionId);
  if (!session || session.provider !== provider) fail(404, "UNKNOWN_SESSION", "Unknown checkout session.");
  if (session!.used) return ok({ received: true, duplicate: true }, "Already processed");
  session!.used = true;
  const inv = ctx.db.invoices.find((i) => i.id === session!.invoiceId)!;
  if (ctx.body.outcome !== "succeeded") {
    inv.payments.push({
      id: uid("pay"),
      invoiceId: inv.id,
      amount: session!.amount,
      method: (ctx.body.method as PaymentMethod) ?? "STRIPE_CARD",
      status: "FAILED",
      gatewayRef: sessionId,
      paidAt: new Date().toISOString(),
    });
    inv.updatedAt = new Date().toISOString();
    return ok({ received: true }, "Payment failed");
  }
  const method = (ctx.body.method as PaymentMethod) ?? (provider === "STRIPE" ? "STRIPE_CARD" : "RAZORPAY_UPI");
  applyPayment(ctx, inv, method, Math.min(session!.amount, inv.balanceDue), sessionId);
  return ok({ received: true }, "Payment captured");
}

route("POST", "/payments/webhook/stripe", (ctx) => handleWebhook(ctx, "STRIPE"), { public: true });
route("POST", "/payments/webhook/razorpay", (ctx) => handleWebhook(ctx, "RAZORPAY"), { public: true });

/* ---------------- Insurance claims ---------------- */

route("GET", "/claims", (ctx) => {
  ctx.requirePermission("claims:manage");
  const tenant = ctx.tenantId();
  const status = ctx.query.arr("status");
  const search = ctx.query.str("search");
  const list = ctx.db.claims.filter(
    (c) =>
      (tenant === null || c.hospitalId === tenant) &&
      (!status || status.includes(c.status)) &&
      matchesSearch(search, c.invoiceNumber, c.patientName, c.tpaName, c.policyNumber),
  );
  return paginate(sortBy(list, ctx.query, { key: "submittedAt", order: "desc" }), ctx.query);
});

route("POST", "/claims", (ctx) => {
  ctx.requirePermission("claims:manage");
  requireFields(ctx.body, ["invoiceId", "tpaName", "policyNumber", "claimAmount"]);
  const inv = loadInvoice(ctx, String(ctx.body.invoiceId));
  if (!["ISSUED", "PARTIALLY_PAID"].includes(inv.status))
    fail(422, "INVALID_TRANSITION", "Claims can only be raised on issued, unpaid invoices.");
  if (inv.claimId && ctx.db.claims.find((c) => c.id === inv.claimId && !["REJECTED"].includes(c.status)))
    fail(409, "CLAIM_EXISTS", "This invoice already has an open claim.");
  const amount = Number(ctx.body.claimAmount);
  if (!(amount > 0) || amount > inv.balanceDue)
    fail(422, "VALIDATION_ERROR", `Claim amount must be between 1 and ₹${inv.balanceDue}.`, { claimAmount: ["Invalid amount."] });
  const now = new Date().toISOString();
  const claim = {
    id: uid("clm"),
    hospitalId: inv.hospitalId,
    invoiceId: inv.id,
    invoiceNumber: inv.number,
    patientId: inv.patientId,
    patientName: inv.patientName,
    tpaName: String(ctx.body.tpaName),
    policyNumber: String(ctx.body.policyNumber),
    claimAmount: round2(amount),
    status: "SUBMITTED" as ClaimStatus,
    submittedAt: now,
    updatedAt: now,
  };
  ctx.db.claims.unshift(claim);
  inv.claimId = claim.id;
  inv.status = "INSURANCE_PENDING";
  inv.updatedAt = now;
  ctx.audit("CREATE", "InsuranceClaim", claim.id, `Submitted claim on ${inv.number} to ${claim.tpaName} (₹${claim.claimAmount})`);
  return created(claim, "Claim submitted to TPA");
});

const CLAIM_FLOW: Record<ClaimStatus, ClaimStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["SETTLED"],
  REJECTED: [],
  SETTLED: [],
};

route("PATCH", "/claims/:id", (ctx) => {
  ctx.requirePermission("claims:manage");
  const claim = ctx.db.claims.find((c) => c.id === ctx.params.id);
  ctx.assertTenant(claim, "Claim");
  const next = ctx.body.status as ClaimStatus;
  if (!CLAIM_FLOW[claim!.status].includes(next))
    fail(422, "INVALID_TRANSITION", `Can't move a ${claim!.status.toLowerCase()} claim to ${String(next).toLowerCase()}.`);
  const inv = ctx.db.invoices.find((i) => i.id === claim!.invoiceId)!;
  if (next === "APPROVED") {
    const approved = Number(ctx.body.approvedAmount);
    if (!(approved > 0) || approved > claim!.claimAmount)
      fail(422, "VALIDATION_ERROR", "Approved amount must be positive and not exceed the claim.", { approvedAmount: ["Invalid."] });
    claim!.approvedAmount = round2(approved);
  }
  claim!.status = next;
  claim!.remarks = (ctx.body.remarks as string) || claim!.remarks;
  claim!.updatedAt = new Date().toISOString();
  if (next === "SETTLED") {
    inv.status = "PARTIALLY_PAID";
    applyPayment(ctx, inv, "INSURANCE", Math.min(claim!.approvedAmount ?? claim!.claimAmount, inv.balanceDue), claim!.id);
  }
  if (next === "REJECTED") {
    inv.status = inv.amountPaid > 0 ? "PARTIALLY_PAID" : "ISSUED";
    inv.updatedAt = claim!.updatedAt;
  }
  ctx.audit("UPDATE", "InsuranceClaim", claim!.id, `Claim ${claim!.invoiceNumber} → ${next}`);
  return ok(claim, `Claim ${next.replace("_", " ").toLowerCase()}`);
});

route("GET", "/billing/summary", (ctx) => {
  ctx.requireRoles("RECEPTIONIST", "ACCOUNTANT", "HOSPITAL_ADMIN");
  const tenant = ctx.tenantId();
  const invoices = ctx.db.invoices.filter((i) => tenant === null || i.hospitalId === tenant);
  const today = todayStr();
  return ok({
    outstanding: round2(
      invoices.filter((i) => ["ISSUED", "PARTIALLY_PAID", "INSURANCE_PENDING"].includes(i.status)).reduce((s, i) => s + i.balanceDue, 0),
    ),
    collectedToday: round2(
      invoices
        .flatMap((i) => i.payments)
        .filter((p) => p.status === "SUCCEEDED" && p.paidAt.slice(0, 10) === today)
        .reduce((s, p) => s + p.amount, 0),
    ),
    invoicesToday: invoices.filter((i) => i.createdAt.slice(0, 10) === today).length,
    pendingClaims: ctx.db.claims.filter(
      (c) => (tenant === null || c.hospitalId === tenant) && ["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(c.status),
    ).length,
    draftInvoices: invoices.filter((i) => i.status === "DRAFT").length,
  });
});
