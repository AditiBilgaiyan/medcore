import { addDays, format, parseISO, subDays } from "date-fns";
import type { Admission, AppointmentStatus, Gender, PaymentMethod, SearchEntity, SearchResult, SubscriptionPlan } from "@/types";
import { hasPermission } from "@/constants/permissions";
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
  todayStr,
  type MockContext,
} from "../router";
import { assertPatientAccess } from "./clinical-directory";
import { buildVitals } from "./emr";
import { hydrateMedicine } from "./lab-pharmacy";

/* ================================================================== */
/* Notifications                                                       */
/* ================================================================== */

route("GET", "/notifications/me", (ctx) => {
  const user = ctx.requireUser();
  const unreadOnly = ctx.query.bool("unread");
  const list = ctx.db.notifications
    .filter((n) => n.userId === user.id && (!unreadOnly || !n.readAt))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(list, ctx.query);
});

route("GET", "/notifications/me/unread-count", (ctx) => {
  const user = ctx.requireUser();
  return ok({ count: ctx.db.notifications.filter((n) => n.userId === user.id && !n.readAt).length });
});

route("PATCH", "/notifications/:id/read", (ctx) => {
  const user = ctx.requireUser();
  const n = ctx.db.notifications.find((x) => x.id === ctx.params.id && x.userId === user.id);
  if (!n) notFound("Notification");
  n!.readAt = n!.readAt ?? new Date().toISOString();
  return ok(n);
});

route("POST", "/notifications/me/read-all", (ctx) => {
  const user = ctx.requireUser();
  const now = new Date().toISOString();
  ctx.db.notifications.filter((n) => n.userId === user.id && !n.readAt).forEach((n) => (n.readAt = now));
  return ok(null, "All caught up");
});

/* ================================================================== */
/* Analytics                                                           */
/* ================================================================== */

function range(ctx: MockContext, defaultDays = 30) {
  const to = ctx.query.str("to") ?? todayStr();
  const from = ctx.query.str("from") ?? format(subDays(parseISO(to), defaultDays - 1), "yyyy-MM-dd");
  if (from > to) fail(422, "VALIDATION_ERROR", "'From' must be before 'to'.");
  const days: string[] = [];
  for (let d = parseISO(from); format(d, "yyyy-MM-dd") <= to; d = addDays(d, 1)) days.push(format(d, "yyyy-MM-dd"));
  return { from, to, days };
}

function analyticsTenant(ctx: MockContext) {
  ctx.requirePermission("analytics:read");
  const tenant = ctx.tenantId();
  return tenant ?? ctx.query.str("hospitalId") ?? null;
}

route("GET", "/analytics/revenue", (ctx) => {
  const tenant = analyticsTenant(ctx);
  const { from, to, days } = range(ctx);
  const span = days.length;
  const invoices = ctx.db.invoices.filter(
    (i) => (tenant === null || i.hospitalId === tenant) && i.status !== "VOID" && i.status !== "DRAFT",
  );
  const inRange = invoices.filter((i) => i.createdAt.slice(0, 10) >= from && i.createdAt.slice(0, 10) <= to);
  const prevFrom = format(subDays(parseISO(from), span), "yyyy-MM-dd");
  const prev = invoices.filter((i) => i.createdAt.slice(0, 10) >= prevFrom && i.createdAt.slice(0, 10) < from);
  const series = days.map((date) => {
    const day = inRange.filter((i) => i.createdAt.slice(0, 10) === date).flatMap((i) => i.items);
    const sum = (t: string[]) => round2(day.filter((it) => t.includes(it.type)).reduce((s, it) => s + it.amount, 0));
    return {
      date,
      consultation: sum(["CONSULTATION"]),
      lab: sum(["LAB"]),
      pharmacy: sum(["PHARMACY"]),
      other: sum(["ROOM", "PROCEDURE", "OTHER"]),
    };
  });
  const byMethod = new Map<PaymentMethod, number>();
  inRange
    .flatMap((i) => i.payments)
    .filter((p) => p.status === "SUCCEEDED")
    .forEach((p) => byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount));
  const byDept = new Map<string, number>();
  inRange.forEach((i) => {
    const appt = ctx.db.appointments.find((a) => a.id === i.appointmentId);
    const key = appt?.departmentName ?? "Walk-in";
    byDept.set(key, (byDept.get(key) ?? 0) + i.total);
  });
  return ok({
    total: round2(inRange.reduce((s, i) => s + i.total, 0)),
    collected: round2(inRange.reduce((s, i) => s + i.amountPaid, 0)),
    outstanding: round2(inRange.reduce((s, i) => s + i.balanceDue, 0)),
    previousPeriodTotal: round2(prev.reduce((s, i) => s + i.total, 0)),
    series,
    byMethod: [...byMethod].map(([method, amount]) => ({ method, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
    byDepartment: [...byDept].map(([department, amount]) => ({ department, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
  });
});

route("GET", "/analytics/appointments", (ctx) => {
  const tenant = analyticsTenant(ctx);
  const { from, to, days } = range(ctx);
  const appts = ctx.db.appointments.filter(
    (a) => !a.deletedAt && (tenant === null || a.hospitalId === tenant) && a.date >= from && a.date <= to,
  );
  const count = (s: AppointmentStatus) => appts.filter((a) => a.status === s).length;
  const byDept = new Map<string, number>();
  appts.forEach((a) => byDept.set(a.departmentName, (byDept.get(a.departmentName) ?? 0) + 1));
  const statuses: AppointmentStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];
  return ok({
    total: appts.length,
    completed: count("COMPLETED"),
    cancelled: count("CANCELLED"),
    noShow: count("NO_SHOW"),
    series: days.map((date) => {
      const d = appts.filter((a) => a.date === date);
      return {
        date,
        total: d.length,
        completed: d.filter((a) => a.status === "COMPLETED").length,
        cancelled: d.filter((a) => a.status === "CANCELLED" || a.status === "NO_SHOW").length,
      };
    }),
    byDepartment: [...byDept].map(([department, c]) => ({ department, count: c })).sort((a, b) => b.count - a.count),
    byStatus: statuses.map((status) => ({ status, count: count(status) })),
  });
});

route("GET", "/analytics/patients", (ctx) => {
  const tenant = analyticsTenant(ctx);
  const { from, to, days } = range(ctx, 90);
  const patients = ctx.db.patients.filter((p) => !p.deletedAt && (tenant === null || p.hospitalId === tenant));
  const before = patients.filter((p) => p.createdAt.slice(0, 10) < from).length;
  let running = before;
  const series = days.map((date) => {
    running += patients.filter((p) => p.createdAt.slice(0, 10) === date).length;
    return { date, value: running };
  });
  const genders: Gender[] = ["MALE", "FEMALE", "OTHER"];
  const ageOf = (dob: string) => new Date().getFullYear() - Number(dob.slice(0, 4));
  const groups: [string, number, number][] = [
    ["0–12", 0, 12],
    ["13–17", 13, 17],
    ["18–35", 18, 35],
    ["36–50", 36, 50],
    ["51–65", 51, 65],
    ["65+", 66, 200],
  ];
  return ok({
    total: patients.length,
    newInPeriod: patients.filter((p) => p.createdAt.slice(0, 10) >= from && p.createdAt.slice(0, 10) <= to).length,
    series,
    byGender: genders.map((gender) => ({ gender, count: patients.filter((p) => p.gender === gender).length })),
    byAgeGroup: groups.map(([group, lo, hi]) => ({
      group,
      count: patients.filter((p) => ageOf(p.dob) >= lo && ageOf(p.dob) <= hi).length,
    })),
  });
});

route("GET", "/analytics/overview", (ctx) => {
  const user = ctx.requireRoles("HOSPITAL_ADMIN", "ACCOUNTANT", "SUPER_ADMIN");
  const tenant = user.role === "SUPER_ADMIN" ? (ctx.query.str("hospitalId") ?? null) : user.hospitalId;
  const scoped = <T extends { hospitalId: string | null }>(list: T[]) => list.filter((x) => tenant === null || x.hospitalId === tenant);
  const today = todayStr();
  const appts = scoped(ctx.db.appointments).filter((a) => !a.deletedAt);
  const todays = appts.filter((a) => a.date === today);
  const wards = scoped(ctx.db.wards);
  const admitted = scoped(ctx.db.admissions).filter((a) => a.status === "ADMITTED");
  const meds = scoped(ctx.db.medicines).map(hydrateMedicine);
  const depts = scoped(ctx.db.departments);
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const last28 = appts.filter((a) => a.date >= format(subDays(new Date(), 27), "yyyy-MM-dd") && a.date <= today);
  const departmentOccupancy = depts.flatMap((d) =>
    dayLabels.map((day, idx) => {
      const dow = (idx + 1) % 7;
      const deptAppts = last28.filter((a) => a.departmentId === d.id && new Date(`${a.date}T00:00:00`).getDay() === dow);
      const capacity =
        ctx.db.availability
          .filter((r) => r.departmentId === d.id && r.dayOfWeek === dow)
          .reduce((s, r) => {
            const [sh, sm] = r.startTime.split(":").map(Number);
            const [eh, em] = r.endTime.split(":").map(Number);
            return s + Math.floor((eh * 60 + em - sh * 60 - sm) / r.slotMinutes);
          }, 0) * 4;
      return { department: d.name, day, value: capacity ? Math.min(1, round2(deptAppts.length / capacity)) : 0 };
    }),
  );
  return ok({
    patientsToday: new Set(todays.filter((a) => ["COMPLETED", "IN_PROGRESS", "CONFIRMED"].includes(a.status)).map((a) => a.patientId)).size,
    revenueToday: round2(
      scoped(ctx.db.invoices)
        .flatMap((i) => i.payments)
        .filter((p) => p.status === "SUCCEEDED" && p.paidAt.slice(0, 10) === today)
        .reduce((s, p) => s + p.amount, 0),
    ),
    occupiedBeds: admitted.length,
    totalBeds: wards.reduce((s, w) => s + w.totalBeds, 0),
    activeDoctors: new Set(todays.map((a) => a.doctorId)).size || scoped(ctx.db.doctors).filter((d) => !d.deletedAt).length,
    pendingLabOrders: scoped(ctx.db.labOrders).filter((o) => !["APPROVED", "CANCELLED"].includes(o.status)).length,
    lowStockCount: meds.filter((m) => m.totalStock <= m.reorderLevel).length,
    appointmentsToday: todays.length,
    departmentOccupancy,
  });
});

route("GET", "/analytics/platform", (ctx) => {
  ctx.requirePermission("platform:analytics");
  const PLAN_PRICE: Record<SubscriptionPlan, number> = { STARTER: 14999, GROWTH: 39999, ENTERPRISE: 99999 };
  const active = ctx.db.hospitals.filter((h) => h.status === "ACTIVE");
  const plans: SubscriptionPlan[] = ["STARTER", "GROWTH", "ENTERPRISE"];
  const since = format(subDays(new Date(), 29), "yyyy-MM-dd");
  return ok({
    hospitals: ctx.db.hospitals.length,
    activeHospitals: active.length,
    pendingVerification: ctx.db.hospitals.filter((h) => h.status === "PENDING_VERIFICATION").length,
    totalUsers: ctx.db.users.filter((u) => !u.deletedAt).length,
    totalPatients: ctx.db.patients.filter((p) => !p.deletedAt).length,
    monthlyRecurringRevenue: active.reduce((s, h) => s + PLAN_PRICE[h.plan], 0),
    hospitalsByPlan: plans.map((plan) => ({ plan, count: ctx.db.hospitals.filter((h) => h.plan === plan).length })),
    topHospitals: ctx.db.hospitals
      .map((h) => ({
        hospitalId: h.id,
        name: h.name,
        appointments: ctx.db.appointments.filter((a) => a.hospitalId === h.id && a.date >= since).length,
        revenue: round2(
          ctx.db.invoices.filter((i) => i.hospitalId === h.id && i.createdAt.slice(0, 10) >= since).reduce((s, i) => s + i.amountPaid, 0),
        ),
      }))
      .sort((a, b) => b.revenue - a.revenue),
  });
});

/* ================================================================== */
/* Global search                                                       */
/* ================================================================== */

route("GET", "/search", (ctx) => {
  const user = ctx.requireUser();
  const q = ctx.query.str("q")?.trim();
  if (!q || q.length < 2) return paginate([], ctx.query);
  const tenant = ctx.tenantId();
  const wanted = (ctx.query.arr("entities") as SearchEntity[] | undefined) ?? ["patient", "doctor", "medicine", "appointment", "invoice"];
  const inTenant = (h: string | null) => tenant === null || h === tenant;
  const results: SearchResult[] = [];
  if (user.role === "PATIENT") forbidden("Search isn't available in the patient portal.");

  if (wanted.includes("patient") && hasPermission(user.role, "patients:read")) {
    ctx.db.patients
      .filter((p) => !p.deletedAt && inTenant(p.hospitalId) && matchesSearch(q, `${p.firstName} ${p.lastName}`, p.mrn, p.phone, p.email))
      .forEach((p) =>
        results.push({
          entity: "patient",
          id: p.id,
          title: `${p.firstName} ${p.lastName}`,
          subtitle: `${p.mrn} · ${p.phone}`,
          href: `/patients/${p.id}`,
        }),
      );
  }
  if (wanted.includes("doctor")) {
    ctx.db.doctors
      .filter((d) => !d.deletedAt && inTenant(d.hospitalId) && matchesSearch(q, `${d.firstName} ${d.lastName}`, d.specialisation))
      .forEach((d) =>
        results.push({
          entity: "doctor",
          id: d.id,
          title: `Dr. ${d.firstName} ${d.lastName}`,
          subtitle: d.specialisation,
          href: `/doctors/${d.id}`,
        }),
      );
  }
  if (wanted.includes("medicine") && hasPermission(user.role, "pharmacy:read")) {
    ctx.db.medicines
      .filter((m) => inTenant(m.hospitalId) && matchesSearch(q, m.name, m.genericName))
      .forEach((m) =>
        results.push({
          entity: "medicine",
          id: m.id,
          title: `${m.name} ${m.strength}`,
          subtitle: `${m.genericName} · ${hydrateMedicine(m).totalStock} in stock`,
          href: `/pharmacy/medicines/${m.id}`,
        }),
      );
  }
  if (wanted.includes("appointment") && hasPermission(user.role, "appointments:read")) {
    ctx.db.appointments
      .filter((a) => !a.deletedAt && inTenant(a.hospitalId) && matchesSearch(q, a.patientName, a.patientMrn, a.id))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50)
      .forEach((a) =>
        results.push({
          entity: "appointment",
          id: a.id,
          title: `${a.patientName} with ${a.doctorName}`,
          subtitle: `${a.date} ${a.startTime} · ${a.status.replace("_", " ").toLowerCase()}`,
          href: `/appointments/${a.id}`,
        }),
      );
  }
  if (wanted.includes("invoice") && hasPermission(user.role, "billing:read")) {
    ctx.db.invoices
      .filter((i) => inTenant(i.hospitalId) && matchesSearch(q, i.number, i.patientName, i.patientMrn))
      .slice(0, 50)
      .forEach((i) =>
        results.push({
          entity: "invoice",
          id: i.id,
          title: i.number,
          subtitle: `${i.patientName} · ₹${i.total.toLocaleString("en-IN")} · ${i.status.replace("_", " ").toLowerCase()}`,
          href: `/billing/${i.id}`,
        }),
      );
  }
  return paginate(results, ctx.query, 20);
});

/* ================================================================== */
/* Wards & admissions                                                  */
/* ================================================================== */

function loadAdmission(ctx: MockContext, id: string): Admission {
  ctx.requirePermission("wards:read");
  const a = ctx.db.admissions.find((x) => x.id === id);
  ctx.assertTenant(a, "Admission");
  return a!;
}

route("GET", "/wards", (ctx) => {
  ctx.requirePermission("wards:read");
  const tenant = ctx.tenantId();
  return ok(
    ctx.db.wards
      .filter((w) => tenant === null || w.hospitalId === tenant)
      .map((w) => ({
        ...w,
        departmentName: ctx.db.departments.find((d) => d.id === w.departmentId)?.name ?? "",
        occupiedBeds: ctx.db.admissions.filter((a) => a.wardId === w.id && a.status === "ADMITTED").length,
      })),
  );
});

route("GET", "/admissions", (ctx) => {
  ctx.requirePermission("wards:read");
  const tenant = ctx.tenantId();
  const wardId = ctx.query.str("wardId");
  const status = ctx.query.arr("status") ?? ["ADMITTED"];
  const doctorId = ctx.query.str("doctorId");
  const search = ctx.query.str("search");
  const list = ctx.db.admissions
    .filter(
      (a) =>
        (tenant === null || a.hospitalId === tenant) &&
        (!wardId || a.wardId === wardId) &&
        status.includes(a.status) &&
        (!doctorId || a.attendingDoctorId === doctorId) &&
        matchesSearch(search, a.patientName, a.patientMrn, a.bedNumber, a.diagnosis),
    )
    .sort((a, b) => a.wardName.localeCompare(b.wardName) || a.bedNumber.localeCompare(b.bedNumber));
  return paginate(list, ctx.query, 50);
});

route("GET", "/admissions/:id", (ctx) => ok(loadAdmission(ctx, ctx.params.id)));

route("POST", "/admissions", (ctx) => {
  ctx.requireRoles("NURSE", "DOCTOR", "HOSPITAL_ADMIN");
  requireFields(ctx.body, ["patientId", "wardId", "bedNumber", "attendingDoctorId", "diagnosis"]);
  const patient = assertPatientAccess(
    ctx,
    ctx.db.patients.find((p) => p.id === ctx.body.patientId),
  );
  const ward = ctx.db.wards.find((w) => w.id === ctx.body.wardId);
  ctx.assertTenant(ward, "Ward");
  const doctor = ctx.db.doctors.find((d) => d.id === ctx.body.attendingDoctorId);
  ctx.assertTenant(doctor, "Doctor");
  const occupied = ctx.db.admissions.filter((a) => a.wardId === ward!.id && a.status === "ADMITTED");
  if (occupied.length >= ward!.totalBeds) fail(409, "WARD_FULL", `${ward!.name} has no free beds.`);
  if (occupied.some((a) => a.bedNumber === ctx.body.bedNumber)) fail(409, "BED_OCCUPIED", `Bed ${ctx.body.bedNumber} is occupied.`);
  if (ctx.db.admissions.some((a) => a.patientId === patient.id && a.status === "ADMITTED"))
    fail(409, "ALREADY_ADMITTED", `${patient.firstName} is already admitted.`);
  const admission: Admission = {
    id: uid("adm"),
    hospitalId: patient.hospitalId,
    patientId: patient.id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    patientMrn: patient.mrn,
    wardId: ward!.id,
    wardName: ward!.name,
    bedNumber: String(ctx.body.bedNumber),
    attendingDoctorId: doctor!.id,
    attendingDoctorName: `Dr. ${doctor!.firstName} ${doctor!.lastName}`,
    diagnosis: String(ctx.body.diagnosis),
    status: "ADMITTED",
    admittedAt: new Date().toISOString(),
    vitals: [],
    medicationLog: [],
    nursingNotes: [],
  };
  ctx.db.admissions.push(admission);
  ctx.audit("CREATE", "Admission", admission.id, `Admitted ${admission.patientName} to ${ward!.name} bed ${admission.bedNumber}`);
  return created(admission, "Patient admitted");
});

route("POST", "/admissions/:id/vitals", (ctx) => {
  ctx.requirePermission("vitals:write");
  const a = loadAdmission(ctx, ctx.params.id);
  if (a.status !== "ADMITTED") fail(422, "DISCHARGED", "This patient has been discharged.");
  a.vitals.unshift(buildVitals(ctx, ctx.body));
  ctx.audit("CREATE", "Vitals", a.id, `Recorded vitals for ${a.patientName} (${a.bedNumber})`);
  return created(a, "Vitals recorded");
});

route("POST", "/admissions/:id/medications", (ctx) => {
  const user = ctx.requirePermission("wards:manage");
  const a = loadAdmission(ctx, ctx.params.id);
  requireFields(ctx.body, ["medicine", "dose", "route"]);
  if (a.status !== "ADMITTED") fail(422, "DISCHARGED", "This patient has been discharged.");
  a.medicationLog.unshift({
    id: uid("mar"),
    medicine: String(ctx.body.medicine),
    dose: String(ctx.body.dose),
    route: String(ctx.body.route),
    administeredAt: new Date().toISOString(),
    nurseName: `${user.firstName} ${user.lastName}`,
    notes: (ctx.body.notes as string) || undefined,
  });
  ctx.audit("CREATE", "MedicationAdministration", a.id, `Administered ${ctx.body.medicine} ${ctx.body.dose} to ${a.patientName}`);
  return created(a, "Medication recorded");
});

route("POST", "/admissions/:id/notes", (ctx) => {
  const user = ctx.requireRoles("NURSE", "DOCTOR");
  const a = loadAdmission(ctx, ctx.params.id);
  requireFields(ctx.body, ["text"]);
  a.nursingNotes.unshift({
    id: uid("note"),
    authorId: user.id,
    authorName: user.role === "DOCTOR" ? `Dr. ${user.firstName} ${user.lastName}` : `${user.firstName} ${user.lastName}`,
    authorRole: user.role,
    text: String(ctx.body.text).trim(),
    createdAt: new Date().toISOString(),
  });
  return created(a, "Note added");
});

route("POST", "/admissions/:id/discharge", (ctx) => {
  ctx.requireRoles("DOCTOR", "NURSE");
  const a = loadAdmission(ctx, ctx.params.id);
  if (a.status !== "ADMITTED") fail(422, "DISCHARGED", "Already discharged.");
  a.status = "DISCHARGED";
  a.dischargedAt = new Date().toISOString();
  ctx.audit("UPDATE", "Admission", a.id, `Discharged ${a.patientName} from ${a.wardName}`);
  return ok(a, "Patient discharged");
});
