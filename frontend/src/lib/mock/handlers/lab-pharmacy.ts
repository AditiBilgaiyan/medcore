import { differenceInCalendarDays, parseISO } from "date-fns";
import { flagResult, referenceRange } from "@/lib/clinical";
import type { ExpiryAlert, LabOrder, LabOrderStatus, LabResult, Medicine, MedicineBatch } from "@/types";
import { uid, type MockDb, type StoredMedicine } from "../db";
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
import { addVisitCharges } from "./billing-helpers";
import { loadPrescription, loadRecord } from "./emr";

/* ================================================================== */
/* Laboratory                                                          */
/* ================================================================== */

function loadLabOrder(ctx: MockContext, id: string): LabOrder {
  const user = ctx.requirePermission("lab:read");
  const o = ctx.db.labOrders.find((x) => x.id === id);
  if (!o) notFound("Lab order");
  if (user.role === "PATIENT") {
    if (o!.patientId !== ctx.ownPatientId() || o!.status !== "APPROVED") notFound("Lab order");
  } else ctx.assertTenant(o, "Lab order");
  return o!;
}

/** Results are hidden from patients until a reviewer approves them. */
function forViewer(ctx: MockContext, o: LabOrder): LabOrder {
  if (ctx.user?.role === "PATIENT" && o.status !== "APPROVED") return { ...o, results: [], reportAttachment: undefined };
  return o;
}

route("GET", "/lab-tests", (ctx) => {
  ctx.requireUser();
  const search = ctx.query.str("search");
  return ok(ctx.db.labTests.filter((t) => matchesSearch(search, t.name, t.code, t.category)));
});

route("POST", "/lab-orders", (ctx) => {
  ctx.requirePermission("lab:order");
  requireFields(ctx.body, ["medicalRecordId", "testIds"]);
  const r = loadRecord(ctx, String(ctx.body.medicalRecordId));
  if (ctx.ownDoctorId() !== r.doctorId) forbidden("Only the treating doctor can order tests for this encounter.");
  const tests = (ctx.body.testIds as string[]).map((id) => {
    const t = ctx.db.labTests.find((x) => x.id === id);
    if (!t) fail(422, "VALIDATION_ERROR", "Unknown test.");
    return { testId: t!.id, testName: t!.name, price: t!.price };
  });
  const patient = ctx.db.patients.find((p) => p.id === r.patientId)!;
  const now = new Date().toISOString();
  const priority = (ctx.body.priority as LabOrder["priority"]) ?? "ROUTINE";
  const order: LabOrder = {
    id: uid("lab"),
    hospitalId: r.hospitalId,
    number: ctx.number("lab", "LAB"),
    medicalRecordId: r.id,
    appointmentId: r.appointmentId,
    patientId: r.patientId,
    patientName: r.patientName,
    patientGender: patient.gender,
    doctorId: r.doctorId,
    doctorName: r.doctorName,
    tests,
    priority,
    status: "ORDERED",
    clinicalNotes: (ctx.body.clinicalNotes as string) || undefined,
    results: [],
    createdAt: now,
    updatedAt: now,
  };
  ctx.db.labOrders.unshift(order);
  r.labOrderIds.push(order.id);
  addVisitCharges(
    ctx,
    r.patientId,
    r.appointmentId,
    tests.map((t) => ({ type: "LAB" as const, description: t.testName, quantity: 1, unitPrice: t.price, refId: order.id })),
  );
  ctx.audit("CREATE", "LabOrder", order.id, `Ordered ${tests.map((t) => t.testName).join(", ")} for ${r.patientName} (${priority})`);
  if (priority !== "ROUTINE") {
    ctx.notifyRole("LAB_TECHNICIAN", r.hospitalId, {
      type: "GENERAL",
      title: `${priority} lab order`,
      body: `${order.number} — ${tests.map((t) => t.testName).join(", ")} for ${r.patientName}`,
      link: `/lab/${order.id}`,
      channels: ["IN_APP"],
    });
  }
  return created(order, "Lab order placed");
});

route("GET", "/lab-orders", (ctx) => {
  const user = ctx.requirePermission("lab:read");
  const tenant = ctx.tenantId();
  const status = ctx.query.arr("status");
  const priority = ctx.query.str("priority");
  const doctorId = ctx.query.str("doctorId");
  const search = ctx.query.str("search");
  const patientId = user.role === "PATIENT" ? (ctx.ownPatientId() ?? "none") : ctx.query.str("patientId");
  const priorityRank = { STAT: 0, URGENT: 1, ROUTINE: 2 };
  const list = ctx.db.labOrders
    .filter(
      (o) =>
        (tenant === null || o.hospitalId === tenant) &&
        (!patientId || o.patientId === patientId) &&
        (user.role !== "PATIENT" || o.status === "APPROVED") &&
        (!doctorId || o.doctorId === doctorId) &&
        (!status || status.includes(o.status)) &&
        (!priority || o.priority === priority) &&
        matchesSearch(search, o.number, o.patientName, o.doctorName, ...o.tests.map((t) => t.testName)),
    )
    .sort((a, b) =>
      ctx.query.str("sortBy") === "priority"
        ? priorityRank[a.priority] - priorityRank[b.priority] || a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    )
    .map((o) => forViewer(ctx, o));
  return paginate(list, ctx.query);
});

route("GET", "/lab-orders/:id", (ctx) => {
  const o = loadLabOrder(ctx, ctx.params.id);
  const tests = o.tests.map((t) => ctx.db.labTests.find((x) => x.id === t.testId)!).filter(Boolean);
  return ok({ ...forViewer(ctx, o), testDefinitions: tests });
});

function transition(ctx: MockContext, o: LabOrder, from: LabOrderStatus[], to: LabOrderStatus) {
  if (!from.includes(o.status)) fail(422, "INVALID_TRANSITION", `Order is ${o.status.replace(/_/g, " ").toLowerCase()}.`);
  o.status = to;
  o.updatedAt = new Date().toISOString();
}

route("PATCH", "/lab-orders/:id/collect", (ctx) => {
  const user = ctx.requirePermission("lab:collect");
  const o = loadLabOrder(ctx, ctx.params.id);
  transition(ctx, o, ["ORDERED"], "SAMPLE_COLLECTED");
  o.collectedAt = o.updatedAt;
  o.collectedByName = `${user.firstName} ${user.lastName}`;
  ctx.audit("UPDATE", "LabOrder", o.id, `Sample collected for ${o.number}`);
  return ok(o, "Sample collected");
});

route("PATCH", "/lab-orders/:id/start", (ctx) => {
  ctx.requirePermission("lab:process");
  const o = loadLabOrder(ctx, ctx.params.id);
  transition(ctx, o, ["SAMPLE_COLLECTED"], "PROCESSING");
  ctx.audit("UPDATE", "LabOrder", o.id, `Processing started for ${o.number}`);
  return ok(o, "Processing started");
});

route("PATCH", "/lab-orders/:id/result", (ctx) => {
  const user = ctx.requirePermission("lab:process");
  const o = loadLabOrder(ctx, ctx.params.id);
  transition(ctx, o, ["PROCESSING", "REJECTED"], "PENDING_APPROVAL");
  const input = (ctx.body.results ?? []) as { testId: string; parameter: string; value: number }[];
  const results: LabResult[] = [];
  for (const t of o.tests) {
    const def = ctx.db.labTests.find((x) => x.id === t.testId)!;
    for (const p of def.parameters) {
      const entry = input.find((r) => r.testId === t.testId && r.parameter === p.name);
      if (!entry || entry.value === undefined || entry.value === null || Number.isNaN(Number(entry.value))) {
        fail(422, "VALIDATION_ERROR", `Enter a value for ${t.testName} → ${p.name}.`);
      }
      const value = Number(entry!.value);
      const [lo, hi] = referenceRange(p, o.patientGender);
      results.push({
        testId: t.testId,
        parameter: p.name,
        value,
        unit: p.unit,
        refLow: lo,
        refHigh: hi,
        flag: flagResult(p, value, o.patientGender),
      });
    }
  }
  o.results = results;
  o.technicianRemarks = (ctx.body.technicianRemarks as string) || undefined;
  const att = ctx.body.reportAttachment as { name: string; mimeType: string; sizeBytes: number; dataUrl: string } | undefined;
  if (att) {
    if (att.mimeType !== "application/pdf") fail(415, "UNSUPPORTED_FILE", "Reports must be PDF files.");
    o.reportAttachment = {
      id: uid("att"),
      name: att.name,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
      url: att.dataUrl,
      uploadedAt: o.updatedAt,
      uploadedById: user.id,
    };
  }
  o.processedById = user.id;
  o.processedByName = `${user.firstName} ${user.lastName}`;
  o.rejectionReason = undefined;
  const critical = results.filter((r) => r.flag === "CRITICAL");
  if (critical.length) {
    const doctorUserId = ctx.db.doctors.find((d) => d.id === o.doctorId)?.userId;
    ctx.notify(doctorUserId, {
      type: "GENERAL",
      title: "Critical lab value",
      body: `${o.patientName}: ${critical.map((c) => `${c.parameter} ${c.value} ${c.unit}`).join(", ")} (awaiting approval)`,
      link: `/lab/${o.id}`,
      channels: ["IN_APP", "SMS"],
    });
  }
  ctx.audit("UPDATE", "LabOrder", o.id, `Results entered for ${o.number}${critical.length ? ` — ${critical.length} critical` : ""}`);
  return ok(o, "Results submitted for approval");
});

route("PATCH", "/lab-orders/:id/review", (ctx) => {
  const user = ctx.requirePermission("lab:approve");
  const o = loadLabOrder(ctx, ctx.params.id);
  if (o.status !== "PENDING_APPROVAL") fail(422, "INVALID_TRANSITION", "Only results awaiting approval can be reviewed.");
  if (o.processedById === user.id) {
    fail(403, "SELF_APPROVAL_NOT_ALLOWED", "A different lab technician must approve results you entered (four-eyes check).");
  }
  const decision = ctx.body.decision;
  if (decision === "REJECT") {
    if (!String(ctx.body.reason ?? "").trim()) fail(422, "VALIDATION_ERROR", "Give a reason for rejecting.", { reason: ["Required."] });
    o.status = "REJECTED";
    o.rejectionReason = String(ctx.body.reason);
    o.updatedAt = new Date().toISOString();
    ctx.notify(o.processedById, {
      type: "GENERAL",
      title: "Results sent back",
      body: `${o.number}: ${o.rejectionReason}`,
      link: `/lab/${o.id}`,
      channels: ["IN_APP"],
    });
    ctx.audit("UPDATE", "LabOrder", o.id, `Rejected results for ${o.number}: ${o.rejectionReason}`);
    return ok(o, "Results sent back for correction");
  }
  o.status = "APPROVED";
  o.approvedAt = new Date().toISOString();
  o.approvedByName = `${user.firstName} ${user.lastName}`;
  o.updatedAt = o.approvedAt;
  const patientUserId = ctx.db.patients.find((p) => p.id === o.patientId)?.userId;
  const doctorUserId = ctx.db.doctors.find((d) => d.id === o.doctorId)?.userId;
  const testNames = o.tests.map((t) => t.testName).join(", ");
  ctx.notify(patientUserId, {
    type: "LAB_REPORT_APPROVED",
    title: "Lab report ready",
    body: `Your ${testNames} report is available.`,
    link: `/portal/reports/${o.id}`,
    channels: ["EMAIL", "IN_APP"],
  });
  ctx.notify(doctorUserId, {
    type: "LAB_REPORT_APPROVED",
    title: "Lab report approved",
    body: `${o.patientName}: ${testNames}`,
    link: `/lab/${o.id}`,
    channels: ["EMAIL", "IN_APP"],
  });
  ctx.audit("UPDATE", "LabOrder", o.id, `Approved results for ${o.number}`);
  return ok(o, "Report approved and released");
});

route("PATCH", "/lab-orders/:id/cancel", (ctx) => {
  ctx.requirePermission("lab:order");
  const o = loadLabOrder(ctx, ctx.params.id);
  if (ctx.ownDoctorId() !== o.doctorId) forbidden("Only the ordering doctor can cancel this order.");
  transition(ctx, o, ["ORDERED", "SAMPLE_COLLECTED"], "CANCELLED");
  ctx.audit("UPDATE", "LabOrder", o.id, `Cancelled ${o.number}`);
  return ok(o, "Lab order cancelled");
});

/* ================================================================== */
/* Pharmacy                                                            */
/* ================================================================== */

const isExpired = (b: MedicineBatch) => b.expiryDate < todayStr();
const daysTo = (date: string) => differenceInCalendarDays(parseISO(date), parseISO(todayStr()));

/** Batches that may be dispensed, oldest expiry first (FIFO). */
export function dispensableBatches(m: StoredMedicine): MedicineBatch[] {
  return m.batches
    .filter((b) => b.status === "ACTIVE" && !isExpired(b) && b.quantity > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export function hydrateMedicine(m: StoredMedicine): Medicine {
  const usable = dispensableBatches(m);
  return {
    ...m,
    batches: [...m.batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    totalStock: usable.reduce((s, b) => s + b.quantity, 0),
    unitPrice: usable[0]?.mrp ?? m.batches[0]?.mrp ?? 0,
  };
}

function expiryAlerts(db: MockDb, hospitalId: string | null, withinDays = 30): ExpiryAlert[] {
  const out: ExpiryAlert[] = [];
  for (const m of db.medicines) {
    if (hospitalId && m.hospitalId !== hospitalId) continue;
    for (const b of m.batches) {
      if (b.status !== "ACTIVE" || b.quantity <= 0) continue;
      const d = daysTo(b.expiryDate);
      if (d <= withinDays) {
        out.push({
          medicineId: m.id,
          medicineName: m.name,
          batchId: b.id,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          quantity: b.quantity,
          daysToExpiry: d,
          status: d < 0 ? "EXPIRED" : "EXPIRING",
        });
      }
    }
  }
  return out.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
}

function loadMedicine(ctx: MockContext, id: string): StoredMedicine {
  ctx.requirePermission("pharmacy:read");
  const m = ctx.db.medicines.find((x) => x.id === id);
  ctx.assertTenant(m, "Medicine");
  return m!;
}

route("GET", "/medicines", (ctx) => {
  const user = ctx.requireUser();
  if (!["PHARMACIST", "DOCTOR", "HOSPITAL_ADMIN"].includes(user.role)) forbidden();
  const tenant = ctx.tenantId() ?? ctx.query.str("hospitalId") ?? null;
  const search = ctx.query.str("search");
  const form = ctx.query.str("form");
  const category = ctx.query.str("category");
  const stock = ctx.query.str("stock");
  const expiring = new Set(expiryAlerts(ctx.db, tenant).map((a) => a.medicineId));
  const list = ctx.db.medicines
    .filter((m) => (tenant === null || m.hospitalId === tenant) && (!form || m.form === form) && (!category || m.category === category))
    .filter((m) => matchesSearch(search, m.name, m.genericName, m.category, m.manufacturer))
    .map(hydrateMedicine)
    .filter((m) => {
      if (stock === "LOW") return m.totalStock > 0 && m.totalStock <= m.reorderLevel;
      if (stock === "OUT") return m.totalStock === 0;
      if (stock === "EXPIRING") return expiring.has(m.id);
      return true;
    });
  return paginate(sortBy(list, ctx.query, { key: "name", order: "asc" }), ctx.query, 25);
});

route("GET", "/medicines/:id", (ctx) => ok(hydrateMedicine(loadMedicine(ctx, ctx.params.id))));

route("POST", "/medicines", (ctx) => {
  const user = ctx.requirePermission("pharmacy:manage");
  requireFields(ctx.body, ["name", "genericName", "form", "strength", "reorderLevel"]);
  if (
    ctx.db.medicines.some(
      (m) =>
        m.hospitalId === user.hospitalId &&
        m.name.toLowerCase() === String(ctx.body.name).toLowerCase() &&
        m.strength === ctx.body.strength,
    )
  ) {
    fail(409, "DUPLICATE_MEDICINE", "This medicine is already in the formulary.");
  }
  const m: StoredMedicine = {
    id: uid("med"),
    hospitalId: user.hospitalId!,
    name: String(ctx.body.name).trim(),
    genericName: String(ctx.body.genericName).trim(),
    form: ctx.body.form as StoredMedicine["form"],
    strength: String(ctx.body.strength),
    manufacturer: String(ctx.body.manufacturer ?? ""),
    category: String(ctx.body.category ?? "General"),
    reorderLevel: Number(ctx.body.reorderLevel),
    requiresPrescription: Boolean(ctx.body.requiresPrescription),
    batches: [],
  };
  ctx.db.medicines.push(m);
  ctx.audit("CREATE", "Medicine", m.id, `Added ${m.name} ${m.strength} to formulary`);
  return created(hydrateMedicine(m), "Medicine added");
});

route("PATCH", "/medicines/:id", (ctx) => {
  ctx.requirePermission("pharmacy:manage");
  const m = loadMedicine(ctx, ctx.params.id);
  for (const k of [
    "name",
    "genericName",
    "form",
    "strength",
    "manufacturer",
    "category",
    "reorderLevel",
    "requiresPrescription",
  ] as const) {
    if (ctx.body[k] !== undefined) (m as unknown as Record<string, unknown>)[k] = ctx.body[k];
  }
  ctx.audit("UPDATE", "Medicine", m.id, `Updated ${m.name}`);
  return ok(hydrateMedicine(m), "Medicine updated");
});

route("POST", "/medicines/:id/batches", (ctx) => {
  ctx.requirePermission("pharmacy:manage");
  const m = loadMedicine(ctx, ctx.params.id);
  requireFields(ctx.body, ["batchNumber", "mfgDate", "expiryDate", "quantity", "unitCost", "mrp"]);
  const b = ctx.body as Record<string, string | number>;
  if (String(b.expiryDate) <= todayStr())
    fail(422, "VALIDATION_ERROR", "Expiry date must be in the future.", { expiryDate: ["Must be in the future."] });
  if (String(b.mfgDate) > todayStr())
    fail(422, "VALIDATION_ERROR", "Manufacturing date can't be in the future.", { mfgDate: ["Can't be in the future."] });
  if (Number(b.mrp) < Number(b.unitCost))
    fail(422, "VALIDATION_ERROR", "MRP can't be lower than unit cost.", { mrp: ["Must be ≥ unit cost."] });
  if (m.batches.some((x) => x.batchNumber === b.batchNumber)) fail(409, "DUPLICATE_BATCH", "This batch number already exists.");
  const batch: MedicineBatch = {
    id: uid("bat"),
    medicineId: m.id,
    batchNumber: String(b.batchNumber),
    mfgDate: String(b.mfgDate),
    expiryDate: String(b.expiryDate),
    quantity: Number(b.quantity),
    unitCost: Number(b.unitCost),
    mrp: Number(b.mrp),
    status: "ACTIVE",
    receivedAt: new Date().toISOString(),
  };
  m.batches.push(batch);
  ctx.audit("CREATE", "MedicineBatch", batch.id, `Received ${batch.quantity} × ${m.name} (batch ${batch.batchNumber})`);
  return created(hydrateMedicine(m), "Stock received");
});

route("PATCH", "/medicines/:id/batches/:batchId/quarantine", (ctx) => {
  ctx.requirePermission("pharmacy:manage");
  const m = loadMedicine(ctx, ctx.params.id);
  const b = m.batches.find((x) => x.id === ctx.params.batchId);
  if (!b) notFound("Batch");
  b!.status = "QUARANTINED";
  ctx.audit("UPDATE", "MedicineBatch", b!.id, `Quarantined ${m.name} batch ${b!.batchNumber}${isExpired(b!) ? " (expired)" : ""}`);
  return ok(hydrateMedicine(m), "Batch quarantined");
});

route("GET", "/pharmacy/summary", (ctx) => {
  ctx.requirePermission("pharmacy:read");
  const tenant = ctx.tenantId();
  const meds = ctx.db.medicines.filter((m) => tenant === null || m.hospitalId === tenant).map(hydrateMedicine);
  const alerts = expiryAlerts(ctx.db, tenant);
  return ok({
    totalMedicines: meds.length,
    lowStock: meds.filter((m) => m.totalStock > 0 && m.totalStock <= m.reorderLevel).length,
    outOfStock: meds.filter((m) => m.totalStock === 0).length,
    expiringSoon: alerts.filter((a) => a.status === "EXPIRING").length,
    expiredNotQuarantined: alerts.filter((a) => a.status === "EXPIRED").length,
    stockValue: round2(
      meds.reduce((s, m) => s + m.batches.filter((b) => b.status === "ACTIVE").reduce((x, b) => x + b.quantity * b.unitCost, 0), 0),
    ),
  });
});

route("GET", "/pharmacy/expiry-alerts", (ctx) => {
  ctx.requirePermission("pharmacy:read");
  return ok(expiryAlerts(ctx.db, ctx.tenantId(), ctx.query.num("withinDays", 30)));
});

/** Simulates the nightly BullMQ expiry-scan job (PRD §7.6). */
route("POST", "/pharmacy/expiry-scan", (ctx) => {
  const user = ctx.requireRoles("PHARMACIST", "HOSPITAL_ADMIN");
  const alerts = expiryAlerts(ctx.db, user.hospitalId, 30);
  const expiring = alerts.filter((a) => a.status === "EXPIRING");
  const expired = alerts.filter((a) => a.status === "EXPIRED");
  const body = `${expiring.length} batch(es) expire within 30 days; ${expired.length} expired batch(es) must be quarantined.`;
  let notified = 0;
  for (const role of ["PHARMACIST", "HOSPITAL_ADMIN"] as const) {
    ctx.db.users
      .filter((u) => u.role === role && u.hospitalId === user.hospitalId && u.status === "ACTIVE")
      .forEach((u) => {
        notified++;
        ctx.notify(u.id, {
          type: "EXPIRY_ALERT",
          title: "Expiry scan report",
          body,
          link: "/pharmacy?stock=EXPIRING",
          channels: ["EMAIL", "IN_APP"],
        });
      });
  }
  return ok({ scannedAt: new Date().toISOString(), expiring, expired, notified }, "Expiry scan complete");
});

route("POST", "/prescriptions/:id/dispense", (ctx) => {
  const user = ctx.requirePermission("pharmacy:dispense");
  const rx = loadPrescription(ctx, ctx.params.id);
  if (!["ISSUED", "PARTIALLY_DISPENSED"].includes(rx.status))
    fail(422, "INVALID_TRANSITION", `Prescription is ${rx.status.toLowerCase()}.`);
  const requests = (ctx.body.items ?? []) as { itemId: string; quantity: number }[];
  if (!requests.some((r) => Number(r.quantity) > 0)) fail(422, "VALIDATION_ERROR", "Enter a quantity for at least one item.");

  // Validate everything first so a failure leaves stock untouched.
  const plan: { item: (typeof rx.items)[number]; med: StoredMedicine; picks: { batch: MedicineBatch; qty: number }[] }[] = [];
  for (const req of requests) {
    const qty = Number(req.quantity);
    if (!qty) continue;
    const item = rx.items.find((i) => i.id === req.itemId);
    if (!item) fail(422, "VALIDATION_ERROR", "Unknown prescription item.");
    if (qty < 0 || item!.dispensedQty + qty > item!.quantity) {
      fail(422, "QUANTITY_EXCEEDS_PRESCRIBED", `${item!.medicineName}: only ${item!.quantity - item!.dispensedQty} left to dispense.`);
    }
    const med = ctx.db.medicines.find((m) => m.id === item!.medicineId)!;
    const usable = dispensableBatches(med);
    const available = usable.reduce((s, b) => s + b.quantity, 0);
    if (available < qty) {
      const expiredQty = med.batches.filter((b) => isExpired(b) && b.quantity > 0).reduce((s, b) => s + b.quantity, 0);
      fail(
        422,
        expiredQty > 0 && available + expiredQty >= qty ? "EXPIRED_STOCK" : "INSUFFICIENT_STOCK",
        expiredQty > 0 && available + expiredQty >= qty
          ? `${med.name}: remaining stock is expired and can't be dispensed.`
          : `${med.name}: only ${available} in stock.`,
      );
    }
    let remaining = qty;
    const picks: { batch: MedicineBatch; qty: number }[] = [];
    for (const b of usable) {
      if (!remaining) break;
      const take = Math.min(b.quantity, remaining);
      picks.push({ batch: b, qty: take });
      remaining -= take;
    }
    plan.push({ item: item!, med, picks });
  }

  const now = new Date().toISOString();
  const charges: { type: "PHARMACY"; description: string; quantity: number; unitPrice: number; refId: string }[] = [];
  for (const { item, med, picks } of plan) {
    for (const { batch, qty } of picks) {
      batch.quantity -= qty;
      if (batch.quantity === 0) batch.status = "DEPLETED";
      item.dispensedQty += qty;
      ctx.db.dispensations.push({
        id: uid("dsp"),
        prescriptionId: rx.id,
        itemId: item.id,
        medicineId: med.id,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: qty,
        dispensedByName: `${user.firstName} ${user.lastName}`,
        dispensedAt: now,
      });
      charges.push({
        type: "PHARMACY",
        description: `${med.name} ${med.strength} (batch ${batch.batchNumber})`,
        quantity: qty,
        unitPrice: batch.mrp,
        refId: rx.id,
      });
    }
    const after = hydrateMedicine(med);
    if (after.totalStock <= med.reorderLevel) {
      for (const role of ["PHARMACIST", "HOSPITAL_ADMIN"] as const) {
        ctx.notifyRole(role, med.hospitalId, {
          type: "LOW_STOCK_ALERT",
          title: `Low stock: ${med.name}`,
          body: `Stock (${after.totalStock}) is at or below the reorder level (${med.reorderLevel}).`,
          link: `/pharmacy/medicines/${med.id}`,
          channels: ["EMAIL", "IN_APP"],
        });
      }
    }
  }
  rx.status = rx.items.every((i) => i.dispensedQty >= i.quantity) ? "DISPENSED" : "PARTIALLY_DISPENSED";
  addVisitCharges(ctx, rx.patientId, rx.appointmentId, charges);
  const patientUserId = ctx.db.patients.find((p) => p.id === rx.patientId)?.userId;
  ctx.notify(patientUserId, {
    type: "PRESCRIPTION_READY",
    title: "Medicines ready",
    body: `Your prescription ${rx.number} is ready for collection at the pharmacy.`,
    link: "/portal/prescriptions",
    channels: ["SMS", "IN_APP"],
  });
  ctx.audit("UPDATE", "Prescription", rx.id, `Dispensed ${rx.number} (${rx.status === "DISPENSED" ? "complete" : "partial"})`);
  return ok(rx, rx.status === "DISPENSED" ? "Prescription dispensed" : "Partially dispensed");
});
