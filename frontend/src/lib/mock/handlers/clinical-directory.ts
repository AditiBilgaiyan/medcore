import type { AvailabilityRule, Patient, TimeSlot } from "@/types";
import { uid, type MockDb } from "../db";
import {
  created,
  fail,
  forbidden,
  matchesSearch,
  notFound,
  nowTime,
  ok,
  paginate,
  requireFields,
  route,
  sortBy,
  todayStr,
  type MockContext,
} from "../router";

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const ACTIVE_APPOINTMENT = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];

/** Slots for a doctor on a date, derived from the weekly schedule minus bookings and exceptions. */
export function computeSlots(db: MockDb, doctorId: string, date: string): (TimeSlot & { departmentId: string; slotMinutes: number })[] {
  const dow = new Date(`${date}T00:00:00`).getDay();
  if (db.availabilityExceptions.some((x) => x.doctorId === doctorId && x.date === date)) return [];
  const rules = db.availability.filter((r) => r.doctorId === doctorId && r.dayOfWeek === dow);
  const taken = new Set(
    db.appointments
      .filter((a) => a.doctorId === doctorId && a.date === date && !a.deletedAt && ACTIVE_APPOINTMENT.includes(a.status))
      .map((a) => a.startTime),
  );
  const isToday = date === todayStr();
  const now = toMin(nowTime());
  const slots: (TimeSlot & { departmentId: string; slotMinutes: number })[] = [];
  for (const r of rules.sort((a, b) => a.startTime.localeCompare(b.startTime))) {
    for (let m = toMin(r.startTime); m + r.slotMinutes <= toMin(r.endTime); m += r.slotMinutes) {
      const start = fromMin(m);
      slots.push({
        startTime: start,
        endTime: fromMin(m + r.slotMinutes),
        available: !taken.has(start) && !(isToday && m <= now) && date >= todayStr(),
        departmentId: r.departmentId,
        slotMinutes: r.slotMinutes,
      });
    }
  }
  return slots;
}

/* ---------------- Doctors ---------------- */

function doctorScope(ctx: MockContext) {
  const user = ctx.requireUser();
  const requested = ctx.query.str("hospitalId");
  if (user.role === "SUPER_ADMIN") return requested;
  return user.hospitalId!;
}

route("GET", "/doctors", (ctx) => {
  ctx.requirePermission("doctors:read");
  const hospitalId = doctorScope(ctx);
  const departmentId = ctx.query.str("departmentId");
  const specialisation = ctx.query.str("specialisation");
  const search = ctx.query.str("search");
  const list = ctx.db.doctors.filter(
    (d) =>
      !d.deletedAt &&
      (!hospitalId || d.hospitalId === hospitalId) &&
      (!departmentId || d.departmentIds.includes(departmentId)) &&
      (!specialisation || d.specialisation.toLowerCase().includes(specialisation.toLowerCase())) &&
      matchesSearch(search, d.firstName, d.lastName, `${d.firstName} ${d.lastName}`, d.specialisation),
  );
  return paginate(sortBy(list, ctx.query, { key: "firstName", order: "asc" }), ctx.query, 50);
});

route("GET", "/doctors/:id", (ctx) => {
  ctx.requirePermission("doctors:read");
  const d = ctx.db.doctors.find((x) => x.id === ctx.params.id && !x.deletedAt);
  ctx.assertTenant(d, "Doctor");
  return ok(d);
});

route("PATCH", "/doctors/:id", (ctx) => {
  const user = ctx.requireRoles("HOSPITAL_ADMIN", "DOCTOR");
  const d = ctx.db.doctors.find((x) => x.id === ctx.params.id && !x.deletedAt);
  ctx.assertTenant(d, "Doctor");
  if (user.role === "DOCTOR" && d!.userId !== user.id) forbidden("You can only edit your own profile.");
  const fields = [
    "bio",
    "consultationFee",
    "languages",
    "signatureDataUrl",
    "isAcceptingPatients",
    "qualification",
    "specialisation",
    "experienceYears",
  ] as const;
  for (const k of fields) if (ctx.body[k] !== undefined) (d as unknown as Record<string, unknown>)[k] = ctx.body[k];
  if (user.role === "HOSPITAL_ADMIN" && Array.isArray(ctx.body.departmentIds)) d!.departmentIds = ctx.body.departmentIds as string[];
  ctx.audit("UPDATE", "Doctor", d!.id, `Updated profile of Dr. ${d!.firstName} ${d!.lastName}`);
  return ok(d, "Profile updated");
});

route("GET", "/doctors/:id/availability", (ctx) => {
  ctx.requireUser();
  const d = ctx.db.doctors.find((x) => x.id === ctx.params.id);
  ctx.assertTenant(d, "Doctor");
  return ok({
    rules: ctx.db.availability
      .filter((r) => r.doctorId === d!.id)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    exceptions: ctx.db.availabilityExceptions
      .filter((x) => x.doctorId === d!.id && x.date >= todayStr())
      .sort((a, b) => a.date.localeCompare(b.date)),
  });
});

function assertCanManageAvailability(ctx: MockContext, doctorUserId: string) {
  const user = ctx.requirePermission("availability:manage");
  if (user.role === "DOCTOR" && user.id !== doctorUserId) forbidden("You can only edit your own schedule.");
}

route("PUT", "/doctors/:id/availability", (ctx) => {
  const d = ctx.db.doctors.find((x) => x.id === ctx.params.id);
  ctx.assertTenant(d, "Doctor");
  assertCanManageAvailability(ctx, d!.userId);
  const rules = (ctx.body.rules ?? []) as Omit<AvailabilityRule, "id" | "doctorId">[];
  const errors: string[] = [];
  rules.forEach((r, i) => {
    if (toMin(r.endTime) <= toMin(r.startTime)) errors.push(`Block ${i + 1}: end time must be after start time.`);
    if (![10, 15, 20, 30, 45, 60].includes(Number(r.slotMinutes))) errors.push(`Block ${i + 1}: invalid slot length.`);
    if (!d!.departmentIds.includes(r.departmentId)) errors.push(`Block ${i + 1}: doctor isn't in that department.`);
    rules.forEach((o, j) => {
      if (j > i && o.dayOfWeek === r.dayOfWeek && toMin(o.startTime) < toMin(r.endTime) && toMin(r.startTime) < toMin(o.endTime)) {
        errors.push(`Blocks ${i + 1} and ${j + 1} overlap.`);
      }
    });
  });
  if (errors.length) fail(422, "INVALID_SCHEDULE", errors[0], { rules: errors });
  ctx.db.availability = ctx.db.availability.filter((r) => r.doctorId !== d!.id);
  rules.forEach((r) => ctx.db.availability.push({ ...r, slotMinutes: Number(r.slotMinutes), id: uid("av"), doctorId: d!.id }));
  ctx.audit("UPDATE", "Availability", d!.id, `Updated weekly schedule (${rules.length} blocks)`);
  return ok(
    ctx.db.availability.filter((r) => r.doctorId === d!.id),
    "Schedule saved",
  );
});

route("POST", "/doctors/:id/availability/exceptions", (ctx) => {
  const d = ctx.db.doctors.find((x) => x.id === ctx.params.id);
  ctx.assertTenant(d, "Doctor");
  assertCanManageAvailability(ctx, d!.userId);
  requireFields(ctx.body, ["date", "reason"]);
  const date = String(ctx.body.date);
  if (date < todayStr()) fail(422, "VALIDATION_ERROR", "Choose a future date.", { date: ["Must be today or later."] });
  const affected = ctx.db.appointments.filter(
    (a) => a.doctorId === d!.id && a.date === date && ["PENDING", "CONFIRMED"].includes(a.status),
  );
  const ex = { id: uid("avx"), doctorId: d!.id, date, reason: String(ctx.body.reason) };
  ctx.db.availabilityExceptions.push(ex);
  ctx.audit("CREATE", "Availability", d!.id, `Marked unavailable on ${date}: ${ex.reason}`);
  return created(
    { exception: ex, affectedAppointments: affected.length },
    affected.length ? `${affected.length} booked appointments on this day need rescheduling.` : "Day blocked",
  );
});

route("DELETE", "/doctors/:id/availability/exceptions/:exId", (ctx) => {
  const d = ctx.db.doctors.find((x) => x.id === ctx.params.id);
  ctx.assertTenant(d, "Doctor");
  assertCanManageAvailability(ctx, d!.userId);
  ctx.db.availabilityExceptions = ctx.db.availabilityExceptions.filter((x) => x.id !== ctx.params.exId);
  return ok(null, "Day unblocked");
});

route("GET", "/doctors/:id/slots", (ctx) => {
  ctx.requireUser();
  const d = ctx.db.doctors.find((x) => x.id === ctx.params.id && !x.deletedAt);
  ctx.assertTenant(d, "Doctor");
  const date = ctx.query.str("date") ?? todayStr();
  // Cache-worthy in the real API (60 s TTL in Redis, PRD §03).
  return ok(computeSlots(ctx.db, d!.id, date).map(({ startTime, endTime, available }) => ({ startTime, endTime, available })));
});

/* ---------------- Patients ---------------- */

export function assertPatientAccess(ctx: MockContext, patient: Patient | undefined): Patient {
  const user = ctx.requireUser();
  if (!patient || patient.deletedAt) notFound("Patient");
  if (user.role === "PATIENT") {
    if (patient!.userId !== user.id) notFound("Patient");
    return patient!;
  }
  ctx.assertTenant(patient, "Patient");
  return patient!;
}

route("GET", "/patients", (ctx) => {
  ctx.requirePermission("patients:read");
  const tenant = ctx.tenantId();
  const search = ctx.query.str("search");
  const gender = ctx.query.str("gender");
  const list = ctx.db.patients.filter(
    (p) =>
      !p.deletedAt &&
      (tenant === null || p.hospitalId === tenant) &&
      (!gender || p.gender === gender) &&
      matchesSearch(search, p.firstName, p.lastName, `${p.firstName} ${p.lastName}`, p.mrn, p.phone, p.email),
  );
  return paginate(sortBy(list, ctx.query, { key: "createdAt", order: "desc" }), ctx.query);
});

route("GET", "/patients/:id", (ctx) => {
  const p = assertPatientAccess(
    ctx,
    ctx.db.patients.find((x) => x.id === ctx.params.id),
  );
  return ok(p);
});

function validatePatient(body: Record<string, unknown>) {
  requireFields(body, ["firstName", "lastName", "dob", "gender", "phone"]);
  if (String(body.dob) > todayStr())
    fail(422, "VALIDATION_ERROR", "Date of birth can't be in the future.", { dob: ["Can't be in the future."] });
}

route("POST", "/patients", (ctx) => {
  const user = ctx.requirePermission("patients:write");
  validatePatient(ctx.body);
  const hospital = ctx.db.hospitals.find((h) => h.id === user.hospitalId)!;
  const phone = String(ctx.body.phone).replace(/\s/g, "");
  const dup = ctx.db.patients.find(
    (p) => p.hospitalId === hospital.id && !p.deletedAt && p.phone.replace(/\s/g, "") === phone && p.dob === ctx.body.dob,
  );
  if (dup) fail(409, "DUPLICATE_PATIENT", `A patient with this phone and date of birth already exists (${dup.mrn}).`);
  ctx.db.counters[`mrn-${hospital.id}`] = (ctx.db.counters[`mrn-${hospital.id}`] ?? 500) + 1;
  const patient: Patient = {
    id: uid("pat"),
    hospitalId: hospital.id,
    mrn: `${hospital.code}-${String(300000 + ctx.db.counters[`mrn-${hospital.id}`]).padStart(6, "0")}`,
    firstName: String(ctx.body.firstName).trim(),
    lastName: String(ctx.body.lastName).trim(),
    dob: String(ctx.body.dob),
    gender: ctx.body.gender as Patient["gender"],
    bloodGroup: (ctx.body.bloodGroup as Patient["bloodGroup"]) || undefined,
    phone: String(ctx.body.phone),
    email: (ctx.body.email as string) || undefined,
    address: (ctx.body.address as Patient["address"]) ?? { line1: "", city: "", state: "", postalCode: "", country: "India" },
    emergencyContact: (ctx.body.emergencyContact as Patient["emergencyContact"]) ?? { name: "", relation: "", phone: "" },
    allergies: (ctx.body.allergies as Patient["allergies"]) ?? [],
    familyHistory: (ctx.body.familyHistory as Patient["familyHistory"]) ?? {
      diabetes: false,
      hypertension: false,
      cancer: false,
      cardiac: false,
    },
    chronicConditions: (ctx.body.chronicConditions as string[]) ?? [],
    currentMedications: [],
    insurance: (ctx.body.insurance as Patient["insurance"]) || undefined,
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
  ctx.db.patients.unshift(patient);
  ctx.audit("CREATE", "Patient", patient.id, `Registered patient ${patient.firstName} ${patient.lastName} (${patient.mrn})`);
  return created(patient, `Patient registered — MRN ${patient.mrn}`);
});

route("PATCH", "/patients/:id", (ctx) => {
  const user = ctx.requireUser();
  const p = assertPatientAccess(
    ctx,
    ctx.db.patients.find((x) => x.id === ctx.params.id),
  );
  const staffWriter = ["HOSPITAL_ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE"].includes(user.role);
  if (!staffWriter && user.role !== "PATIENT") forbidden();
  const patientEditable = ["phone", "email", "address", "emergencyContact"];
  const staffEditable = [
    ...patientEditable,
    "firstName",
    "lastName",
    "dob",
    "gender",
    "bloodGroup",
    "allergies",
    "familyHistory",
    "chronicConditions",
    "currentMedications",
    "insurance",
  ];
  const allowed = user.role === "PATIENT" ? patientEditable : staffEditable;
  for (const k of allowed) if (ctx.body[k] !== undefined) (p as unknown as Record<string, unknown>)[k] = ctx.body[k];
  ctx.audit("UPDATE", "Patient", p.id, `Updated patient ${p.firstName} ${p.lastName}`);
  return ok(p, "Patient updated");
});

route("DELETE", "/patients/:id", (ctx) => {
  ctx.requireRoles("HOSPITAL_ADMIN");
  const p = assertPatientAccess(
    ctx,
    ctx.db.patients.find((x) => x.id === ctx.params.id),
  );
  // Soft delete only — medical records are never physically removed (PRD §05).
  p.deletedAt = new Date().toISOString();
  ctx.audit("DELETE", "Patient", p.id, `Archived patient ${p.firstName} ${p.lastName} (soft delete)`);
  return ok(null, "Patient archived");
});

route("GET", "/patients/:id/vaccinations", (ctx) => {
  const p = assertPatientAccess(
    ctx,
    ctx.db.patients.find((x) => x.id === ctx.params.id),
  );
  return ok(ctx.db.vaccinations.filter((v) => v.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date)));
});

route("POST", "/patients/:id/vaccinations", (ctx) => {
  ctx.requireRoles("DOCTOR", "NURSE");
  const p = assertPatientAccess(
    ctx,
    ctx.db.patients.find((x) => x.id === ctx.params.id),
  );
  requireFields(ctx.body, ["vaccine", "date", "batchNumber"]);
  const v = {
    id: uid("vac"),
    patientId: p.id,
    vaccine: String(ctx.body.vaccine),
    date: String(ctx.body.date),
    batchNumber: String(ctx.body.batchNumber),
    nextDueDate: (ctx.body.nextDueDate as string) || undefined,
  };
  ctx.db.vaccinations.push(v);
  ctx.audit("CREATE", "Vaccination", v.id, `Recorded ${v.vaccine} for ${p.firstName} ${p.lastName}`);
  return created(v, "Vaccination recorded");
});
