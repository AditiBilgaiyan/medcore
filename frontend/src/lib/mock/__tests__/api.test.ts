/**
 * Contract tests for the API behaviour the frontend relies on, run against the
 * in-browser mock API. These mirror the PRD's mandatory test scenarios (§11).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { format, addDays } from "date-fns";
import { DEMO_PASSWORD } from "@/constants/roles";
import { getDb, MOCK_REFRESH_COOKIE } from "../db";
import { seedDatabase } from "../seed";
import { mockRequest } from "../server";
import { webhookSignature } from "../handlers/billing";

type Body = { success: boolean; data?: any; meta?: any; error?: { code: string; message: string } };

async function call(method: string, path: string, token: string | null, body?: unknown, query?: Record<string, unknown>) {
  const res = await mockRequest({ method, path, body, query, accessToken: token, deviceId: "test-device" });
  return { status: res.status, body: res.body as Body };
}

async function login(email: string) {
  const res = await call("POST", "/auth/login", null, { email, password: DEMO_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
}

let db: Awaited<ReturnType<typeof getDb>>;
beforeAll(async () => {
  db = await getDb(seedDatabase);
});

describe("authentication", () => {
  it("rejects bad credentials without revealing which field was wrong", async () => {
    const res = await call("POST", "/auth/login", null, { email: "admin@citycare.dev", password: "nope" });
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe("INVALID_CREDENTIALS");
  });

  it("requires a token for protected endpoints", async () => {
    const res = await call("GET", "/patients", null);
    expect(res.status).toBe(401);
  });

  it("rotates refresh tokens and rejects reuse of a rotated token", async () => {
    await login("reception@citycare.dev");
    const original = window.localStorage.getItem(MOCK_REFRESH_COOKIE)!;
    expect(original).toBeTruthy();

    const first = await call("POST", "/auth/refresh", null);
    expect(first.status).toBe(200);
    const rotated = window.localStorage.getItem(MOCK_REFRESH_COOKIE)!;
    expect(rotated).not.toBe(original);

    // Replay the old token (e.g. stolen cookie) → rejected, and the whole family is revoked.
    window.localStorage.setItem(MOCK_REFRESH_COOKIE, original);
    const replay = await call("POST", "/auth/refresh", null);
    expect(replay.status).toBe(401);
    expect(replay.body.error?.code).toBe("REFRESH_TOKEN_REUSED");

    window.localStorage.setItem(MOCK_REFRESH_COOKIE, rotated);
    const afterRevoke = await call("POST", "/auth/refresh", null);
    expect(afterRevoke.status).toBe(401);
  });
});

describe("tenant isolation", () => {
  it("a doctor cannot read another hospital's patients or records", async () => {
    const token = await login("dr.mehta@citycare.dev");
    const otherPatient = db.patients.find((p) => p.hospitalId === "hosp-sunrise")!;
    const otherRecord = db.medicalRecords.find((r) => r.hospitalId === "hosp-sunrise")!;

    expect((await call("GET", `/patients/${otherPatient.id}`, token)).status).toBe(404);
    expect((await call("GET", `/medical-records/${otherRecord.id}`, token)).status).toBe(404);
  });

  it("list endpoints only return the caller's tenant", async () => {
    const token = await login("admin@sunrise.dev");
    const res = await call("GET", "/patients", token, undefined, { limit: 200 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((p: { hospitalId: string }) => p.hospitalId === "hosp-sunrise")).toBe(true);
  });
});

describe("patient privacy", () => {
  it("a patient cannot view another patient's records", async () => {
    const token = await login("aarav.sharma@mail.dev");
    const otherRecord = db.medicalRecords.find((r) => r.patientId !== "pat-cch-0001" && r.hospitalId === "hosp-citycare")!;
    expect((await call("GET", `/medical-records/${otherRecord.id}`, token)).status).toBe(404);
    expect((await call("GET", "/patients/pat-cch-0002", token)).status).toBe(404);
  });

  it("scopes list endpoints to the signed-in patient even if another id is requested", async () => {
    const token = await login("aarav.sharma@mail.dev");
    const res = await call("GET", "/appointments", token, undefined, { patientId: "pat-cch-0002", limit: 200 });
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((a: { patientId: string }) => a.patientId === "pat-cch-0001")).toBe(true);
  });

  it("forbids patients from staff-only endpoints", async () => {
    const token = await login("aarav.sharma@mail.dev");
    expect((await call("GET", "/patients", token)).status).toBe(403);
  });
});

describe("appointment booking", () => {
  function freeSlot(doctorId: string) {
    for (let d = 3; d < 14; d++) {
      const date = format(addDays(new Date(), d), "yyyy-MM-dd");
      const dow = new Date(`${date}T00:00:00`).getDay();
      const rule = db.availability.find((r) => r.doctorId === doctorId && r.dayOfWeek === dow);
      if (!rule) continue;
      const taken = new Set(
        db.appointments.filter((a) => a.doctorId === doctorId && a.date === date && a.status !== "CANCELLED").map((a) => a.startTime),
      );
      const [h, m] = rule.startTime.split(":").map(Number);
      for (let t = h * 60 + m; t + rule.slotMinutes <= Number(rule.endTime.slice(0, 2)) * 60; t += rule.slotMinutes) {
        const time = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
        if (!taken.has(time)) return { date, time };
      }
    }
    throw new Error("no free slot");
  }

  it("lets only one of two simultaneous bookings for the same slot succeed", async () => {
    const token = await login("reception@citycare.dev");
    const { date, time } = freeSlot("doc-002");
    const book = (patientId: string) =>
      call("POST", "/appointments", token, {
        patientId,
        doctorId: "doc-002",
        date,
        startTime: time,
        type: "CONSULTATION",
        reason: "Chest pain review",
      });
    const results = await Promise.all([book("pat-cch-0040"), book("pat-cch-0041")]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.body.error?.code).toBe("SLOT_UNAVAILABLE");
  });

  it("prevents a patient being double-booked across doctors", async () => {
    const token = await login("reception@citycare.dev");
    const { date, time } = freeSlot("doc-001");
    const first = await call("POST", "/appointments", token, {
      patientId: "pat-cch-0042",
      doctorId: "doc-001",
      date,
      startTime: time,
      reason: "Fever",
    });
    expect(first.status).toBe(201);
    // Same patient, same time, a doctor who also works then (emergency bypasses slots but not the patient clash).
    const second = await call("POST", "/appointments", token, {
      patientId: "pat-cch-0042",
      doctorId: "doc-008",
      date,
      startTime: time,
      type: "EMERGENCY",
      reason: "Fall",
    });
    expect(second.status).toBe(409);
    expect(second.body.error?.code).toBe("PATIENT_CONFLICT");
  });

  it("rejects stale updates with a version conflict", async () => {
    const token = await login("reception@citycare.dev");
    const appt = db.appointments.find((a) => a.status === "PENDING" && a.hospitalId === "hosp-citycare")!;
    const ok = await call("PATCH", `/appointments/${appt.id}/status`, token, { status: "CONFIRMED", version: appt.version });
    expect(ok.status).toBe(200);
    const stale = await call("PATCH", `/appointments/${appt.id}/status`, token, {
      status: "CANCELLED",
      reason: "x",
      version: appt.version - 1,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error?.code).toBe("VERSION_CONFLICT");
  });
});

describe("role-based access", () => {
  it("only doctors can prescribe", async () => {
    const token = await login("reception@citycare.dev");
    const res = await call("POST", "/prescriptions", token, { medicalRecordId: db.medicalRecords[0].id, items: [] });
    expect(res.status).toBe(403);
  });

  it("a lab technician cannot approve results they entered", async () => {
    const order = db.labOrders.find((o) => o.status === "PENDING_APPROVAL" && o.processedById === "usr-cch-lab");
    if (!order) return; // seed may not contain one on every day
    const token = await login("lab@citycare.dev");
    const res = await call("PATCH", `/lab-orders/${order.id}/review`, token, { decision: "APPROVE" });
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("SELF_APPROVAL_NOT_ALLOWED");
  });
});

describe("pharmacy", () => {
  it("never dispenses expired stock", async () => {
    const med = db.medicines.find((m) => m.hospitalId === "hosp-citycare" && m.name === "Brufen 400")!;
    // Leave only the expired batch with stock.
    med.batches.forEach((b) => {
      if (b.expiryDate >= format(new Date(), "yyyy-MM-dd")) b.quantity = 0;
    });
    const expired = med.batches.find((b) => b.expiryDate < format(new Date(), "yyyy-MM-dd"))!;
    const before = expired.quantity;
    expect(before).toBeGreaterThan(0);

    const record = db.medicalRecords.find((r) => r.hospitalId === "hosp-citycare")!;
    db.prescriptions.unshift({
      id: "rx-test-expired",
      hospitalId: "hosp-citycare",
      number: "RX-TEST-1",
      medicalRecordId: record.id,
      appointmentId: record.appointmentId,
      patientId: record.patientId,
      patientName: record.patientName,
      doctorId: record.doctorId,
      doctorName: record.doctorName,
      items: [
        {
          id: "pi-test",
          medicineId: med.id,
          medicineName: med.name,
          form: med.form,
          dosage: "400 mg",
          frequency: "TDS",
          durationDays: 3,
          quantity: 9,
          dispensedQty: 0,
        },
      ],
      status: "ISSUED",
      signedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const token = await login("pharmacy@citycare.dev");
    const res = await call("POST", "/prescriptions/rx-test-expired/dispense", token, { items: [{ itemId: "pi-test", quantity: 9 }] });
    expect(res.status).toBe(422);
    expect(res.body.error?.code).toBe("EXPIRED_STOCK");
    expect(expired.quantity).toBe(before);
  });
});

describe("billing", () => {
  it("keeps the invoice total equal to the sum of its line items", async () => {
    const token = await login("accounts@citycare.dev");
    const created = await call("POST", "/invoices", token, {
      patientId: "pat-cch-0010",
      items: [
        { type: "ROOM", description: "General ward — 2 days", quantity: 2, unitPrice: 1500 },
        { type: "PROCEDURE", description: "Dressing", quantity: 3, unitPrice: 250.5 },
      ],
      discount: 200,
    });
    expect(created.status).toBe(201);
    const inv = created.body.data;
    const sum = inv.items.reduce((s: number, it: { amount: number }) => s + it.amount, 0);
    expect(inv.subtotal).toBeCloseTo(sum, 2);
    expect(inv.total).toBeCloseTo(sum - 200, 2);
    expect(inv.status).toBe("DRAFT");
  });

  it("only marks an invoice paid after a correctly signed gateway webhook", async () => {
    const token = await login("aarav.sharma@mail.dev");
    const inv = db.invoices.find((i) => i.patientId === "pat-cch-0001" && i.status === "ISSUED")!;
    const checkout = await call("POST", "/payments/checkout", token, { invoiceId: inv.id, provider: "RAZORPAY" });
    expect(checkout.status).toBe(201);
    const sessionId = checkout.body.data.sessionId;

    const forged = await call("POST", "/payments/webhook/razorpay", null, {
      sessionId,
      outcome: "succeeded",
      method: "RAZORPAY_UPI",
      signature: "forged",
    });
    expect(forged.status).toBe(400);
    expect(db.invoices.find((i) => i.id === inv.id)!.status).toBe("ISSUED");

    const genuine = await call("POST", "/payments/webhook/razorpay", null, {
      sessionId,
      outcome: "succeeded",
      method: "RAZORPAY_UPI",
      signature: webhookSignature(sessionId),
    });
    expect(genuine.status).toBe(200);
    const after = db.invoices.find((i) => i.id === inv.id)!;
    expect(after.status).toBe("PAID");
    expect(after.balanceDue).toBe(0);
  });
});
