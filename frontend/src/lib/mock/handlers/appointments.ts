import type { Appointment, AppointmentStatus, AppointmentType, MedicalRecord } from "@/types";
import { uid } from "../db";
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
  todayStr,
  type MockContext,
} from "../router";
import { addVisitCharges } from "./billing-helpers";
import { ACTIVE_APPOINTMENT, computeSlots } from "./clinical-directory";

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function loadAppointment(ctx: MockContext, id: string): Appointment {
  const user = ctx.requireUser();
  const a = ctx.db.appointments.find((x) => x.id === id && !x.deletedAt);
  if (!a) notFound("Appointment");
  if (user.role === "PATIENT") {
    if (a!.patientId !== ctx.ownPatientId()) notFound("Appointment");
  } else ctx.assertTenant(a, "Appointment");
  return a!;
}

route("GET", "/appointments", (ctx) => {
  const user = ctx.requirePermission("appointments:read");
  const tenant = ctx.tenantId();
  const q = ctx.query;
  const date = q.str("date");
  const from = q.str("from");
  const to = q.str("to");
  const doctorId = q.str("doctorId");
  const departmentId = q.str("departmentId");
  const status = q.arr("status");
  const type = q.str("type");
  const search = q.str("search");
  const patientId = user.role === "PATIENT" ? (ctx.ownPatientId() ?? "none") : q.str("patientId");

  const list = ctx.db.appointments.filter(
    (a) =>
      !a.deletedAt &&
      (tenant === null || a.hospitalId === tenant) &&
      (!date || a.date === date) &&
      (!from || a.date >= from) &&
      (!to || a.date <= to) &&
      (!doctorId || a.doctorId === doctorId) &&
      (!patientId || a.patientId === patientId) &&
      (!departmentId || a.departmentId === departmentId) &&
      (!status || status.includes(a.status)) &&
      (!type || a.type === type) &&
      matchesSearch(search, a.patientName, a.patientMrn, a.doctorName, a.reason),
  );
  const order = q.str("sortOrder") === "desc" ? -1 : 1;
  list.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)) * order);
  return paginate(list, q, 50);
});

route("GET", "/appointments/:id", (ctx) => ok(loadAppointment(ctx, ctx.params.id)));

route("POST", "/appointments", (ctx) => {
  const user = ctx.requirePermission("appointments:create");
  requireFields(ctx.body, ["doctorId", "date", "reason"]);
  const type = (ctx.body.type as AppointmentType) ?? "CONSULTATION";
  const isEmergency = type === "EMERGENCY";
  if (isEmergency && user.role === "PATIENT") forbidden("Call the hospital's emergency line for emergencies.");

  const patientId = user.role === "PATIENT" ? ctx.ownPatientId() : (ctx.body.patientId as string);
  const patient = ctx.db.patients.find((p) => p.id === patientId && !p.deletedAt);
  if (!patient) fail(422, "VALIDATION_ERROR", "Choose a patient.", { patientId: ["Required."] });
  if (user.role !== "PATIENT") ctx.assertTenant(patient, "Patient");

  const doctor = ctx.db.doctors.find((d) => d.id === ctx.body.doctorId && !d.deletedAt);
  if (!doctor || doctor.hospitalId !== patient!.hospitalId)
    fail(422, "VALIDATION_ERROR", "Choose a doctor at this hospital.", { doctorId: ["Invalid doctor."] });
  if (!doctor!.isAcceptingPatients && !isEmergency) fail(422, "DOCTOR_UNAVAILABLE", "This doctor isn't accepting new appointments.");

  const date = String(ctx.body.date);
  if (date < todayStr()) fail(422, "PAST_DATE", "You can't book an appointment in the past.");

  let startTime = ctx.body.startTime as string | undefined;
  let endTime: string;
  let departmentId = (ctx.body.departmentId as string) || doctor!.departmentIds[0];

  if (isEmergency) {
    // Emergencies bypass slot availability (PRD §7.2).
    startTime = startTime || (date === todayStr() ? nowTime() : "09:00");
    endTime = fromMin(Math.min(toMin(startTime) + 30, 23 * 60 + 59));
    if (!doctor!.departmentIds.includes(departmentId)) departmentId = doctor!.departmentIds[0];
  } else {
    if (!startTime) fail(422, "VALIDATION_ERROR", "Choose a time slot.", { startTime: ["Required."] });
    const slot = computeSlots(ctx.db, doctor!.id, date).find((s) => s.startTime === startTime);
    if (!slot) fail(422, "OUTSIDE_AVAILABILITY", "The doctor doesn't see patients at that time.");
    if (!slot!.available) {
      fail(409, "SLOT_UNAVAILABLE", "This slot was just booked by another patient. Please choose another time.");
    }
    endTime = slot!.endTime;
    departmentId = slot!.departmentId;
  }

  // A patient can't be in two places at once, across any doctor.
  const clash = ctx.db.appointments.find(
    (a) =>
      a.patientId === patient!.id &&
      a.date === date &&
      !a.deletedAt &&
      ACTIVE_APPOINTMENT.includes(a.status) &&
      toMin(a.startTime) < toMin(endTime!) &&
      toMin(startTime!) < toMin(a.endTime),
  );
  if (clash) {
    fail(
      409,
      "PATIENT_CONFLICT",
      `${patient!.firstName} already has an appointment with ${clash.doctorName} at ${clash.startTime} that day.`,
    );
  }

  const now = new Date().toISOString();
  const dept = ctx.db.departments.find((d) => d.id === departmentId)!;
  const status: AppointmentStatus = user.role === "PATIENT" ? "PENDING" : "CONFIRMED";
  const appt: Appointment = {
    id: uid("apt"),
    hospitalId: patient!.hospitalId,
    patientId: patient!.id,
    patientName: `${patient!.firstName} ${patient!.lastName}`,
    patientMrn: patient!.mrn,
    doctorId: doctor!.id,
    doctorName: `Dr. ${doctor!.firstName} ${doctor!.lastName}`,
    departmentId,
    departmentName: dept.name,
    date,
    startTime: startTime!,
    endTime: endTime!,
    type,
    status,
    isEmergency,
    reason: String(ctx.body.reason).trim(),
    notes: (ctx.body.notes as string) || undefined,
    createdById: user.id,
    createdAt: now,
    updatedAt: now,
    version: 1,
    deletedAt: null,
  };
  ctx.db.appointments.push(appt);
  ctx.audit(
    "CREATE",
    "Appointment",
    appt.id,
    `Booked ${appt.patientName} with ${appt.doctorName} on ${date} ${appt.startTime}${isEmergency ? " (EMERGENCY)" : ""}`,
  );

  const doctorUserId = doctor!.userId;
  if (isEmergency) {
    ctx.notify(doctorUserId, {
      type: "EMERGENCY_APPOINTMENT",
      title: "Emergency appointment",
      body: `${appt.patientName} — ${appt.reason} (${appt.startTime})`,
      link: `/appointments/${appt.id}`,
      channels: ["IN_APP", "SMS"],
    });
  }
  if (status === "CONFIRMED") {
    ctx.notify(patient!.userId, {
      type: "APPOINTMENT_CONFIRMED",
      title: "Appointment confirmed",
      body: `${appt.doctorName}, ${date} at ${appt.startTime}.`,
      link: "/portal/appointments",
      channels: ["EMAIL", "SMS", "IN_APP"],
    });
  } else {
    ctx.notifyRole("RECEPTIONIST", appt.hospitalId, {
      type: "GENERAL",
      title: "New online booking",
      body: `${appt.patientName} requested ${appt.doctorName} on ${date} at ${appt.startTime}.`,
      link: `/appointments/${appt.id}`,
      channels: ["IN_APP"],
    });
  }
  return created(appt, status === "PENDING" ? "Appointment requested — the hospital will confirm shortly." : "Appointment booked");
});

function ensureRecord(ctx: MockContext, appt: Appointment): MedicalRecord {
  let record = ctx.db.medicalRecords.find((r) => r.appointmentId === appt.id);
  if (record) return record;
  const patient = ctx.db.patients.find((p) => p.id === appt.patientId)!;
  const now = new Date().toISOString();
  record = {
    id: uid("mr"),
    hospitalId: appt.hospitalId,
    appointmentId: appt.id,
    patientId: appt.patientId,
    patientName: appt.patientName,
    doctorId: appt.doctorId,
    doctorName: appt.doctorName,
    departmentName: appt.departmentName,
    vitals: [],
    chiefComplaint: appt.reason,
    symptoms: [],
    diagnoses: [],
    treatmentPlan: "",
    allergiesNoted: patient.allergies,
    notes: [],
    attachments: [],
    prescriptionIds: [],
    labOrderIds: [],
    isFinalised: false,
    createdAt: now,
    updatedAt: now,
  };
  ctx.db.medicalRecords.push(record);
  appt.medicalRecordId = record.id;
  return record;
}

export { ensureRecord };

route("PATCH", "/appointments/:id/status", (ctx) => {
  const user = ctx.requireUser();
  const appt = loadAppointment(ctx, ctx.params.id);
  const next = ctx.body.status as AppointmentStatus;
  const version = Number(ctx.body.version);

  if (Number.isFinite(version) && version !== appt.version) {
    fail(409, "VERSION_CONFLICT", "Someone else updated this appointment. Refresh to see the latest status.");
  }
  if (!TRANSITIONS[appt.status].includes(next)) {
    fail(
      422,
      "INVALID_TRANSITION",
      `Can't change an appointment from ${appt.status.replace("_", " ").toLowerCase()} to ${String(next).replace("_", " ").toLowerCase()}.`,
    );
  }

  const isOwnDoctor = user.role === "DOCTOR" && ctx.ownDoctorId() === appt.doctorId;
  const desk = user.role === "RECEPTIONIST" || user.role === "HOSPITAL_ADMIN";
  const allowed =
    (next === "CONFIRMED" && desk) ||
    (next === "CANCELLED" && (desk || isOwnDoctor || user.role === "PATIENT")) ||
    (next === "NO_SHOW" && (desk || isOwnDoctor)) ||
    ((next === "IN_PROGRESS" || next === "COMPLETED") && isOwnDoctor);
  if (!allowed) forbidden("You can't make that change to this appointment.");
  if (next === "CANCELLED" && !String(ctx.body.reason ?? "").trim()) {
    fail(422, "VALIDATION_ERROR", "Give a reason for cancelling.", { reason: ["Required."] });
  }

  appt.status = next;
  appt.version += 1;
  appt.updatedAt = new Date().toISOString();
  if (next === "CANCELLED") appt.cancelledReason = String(ctx.body.reason);

  const patient = ctx.db.patients.find((p) => p.id === appt.patientId);
  if (next === "IN_PROGRESS") ensureRecord(ctx, appt);
  if (next === "COMPLETED") {
    const record = ensureRecord(ctx, appt);
    record.isFinalised = true;
    record.updatedAt = appt.updatedAt;
    const doctor = ctx.db.doctors.find((d) => d.id === appt.doctorId)!;
    const fee = appt.type === "FOLLOW_UP" ? Math.round(doctor.consultationFee * 0.5) : doctor.consultationFee;
    const hasConsult = ctx.db.invoices.some((i) => i.appointmentId === appt.id && i.items.some((it) => it.type === "CONSULTATION"));
    if (!hasConsult) {
      addVisitCharges(ctx, appt.patientId, appt.id, [
        {
          type: "CONSULTATION",
          description: `${appt.type === "FOLLOW_UP" ? "Follow-up" : "Consultation"} — ${appt.doctorName}`,
          quantity: 1,
          unitPrice: fee,
          refId: appt.id,
        },
      ]);
    }
  }
  if (next === "CONFIRMED") {
    ctx.notify(patient?.userId, {
      type: "APPOINTMENT_CONFIRMED",
      title: "Appointment confirmed",
      body: `${appt.doctorName}, ${appt.date} at ${appt.startTime}.`,
      link: "/portal/appointments",
      channels: ["EMAIL", "SMS", "IN_APP"],
    });
  }
  if (next === "CANCELLED") {
    const doctorUser = ctx.db.doctors.find((d) => d.id === appt.doctorId)?.userId;
    const target = user.role === "PATIENT" ? doctorUser : patient?.userId;
    ctx.notify(target, {
      type: "GENERAL",
      title: "Appointment cancelled",
      body: `${appt.patientName} with ${appt.doctorName} on ${appt.date} at ${appt.startTime} was cancelled.`,
      link: user.role === "PATIENT" ? `/appointments/${appt.id}` : "/portal/appointments",
      channels: ["EMAIL", "IN_APP"],
    });
  }
  ctx.audit(
    "UPDATE",
    "Appointment",
    appt.id,
    `Status → ${next}${appt.cancelledReason && next === "CANCELLED" ? ` (${appt.cancelledReason})` : ""}`,
  );
  return ok(appt, `Appointment ${next.replace("_", " ").toLowerCase()}`);
});

route("PATCH", "/appointments/:id/reschedule", (ctx) => {
  const user = ctx.requireRoles("RECEPTIONIST", "HOSPITAL_ADMIN", "PATIENT");
  const appt = loadAppointment(ctx, ctx.params.id);
  requireFields(ctx.body, ["date", "startTime"]);
  if (Number(ctx.body.version) !== appt.version) {
    fail(409, "VERSION_CONFLICT", "Someone else updated this appointment. Refresh to see the latest status.");
  }
  if (!["PENDING", "CONFIRMED"].includes(appt.status)) fail(422, "INVALID_TRANSITION", "Only upcoming appointments can be rescheduled.");
  const date = String(ctx.body.date);
  const slot = computeSlots(ctx.db, appt.doctorId, date).find((s) => s.startTime === ctx.body.startTime);
  if (!slot) fail(422, "OUTSIDE_AVAILABILITY", "The doctor doesn't see patients at that time.");
  if (!slot!.available) fail(409, "SLOT_UNAVAILABLE", "This slot was just booked by another patient. Please choose another time.");
  const clash = ctx.db.appointments.find(
    (a) =>
      a.id !== appt.id &&
      a.patientId === appt.patientId &&
      a.date === date &&
      ACTIVE_APPOINTMENT.includes(a.status) &&
      a.startTime === slot!.startTime,
  );
  if (clash) fail(409, "PATIENT_CONFLICT", "The patient already has an appointment at that time.");
  const before = `${appt.date} ${appt.startTime}`;
  appt.date = date;
  appt.startTime = slot!.startTime;
  appt.endTime = slot!.endTime;
  appt.version += 1;
  appt.updatedAt = new Date().toISOString();
  if (user.role === "PATIENT") appt.status = "PENDING";
  ctx.audit("UPDATE", "Appointment", appt.id, `Rescheduled from ${before} to ${date} ${appt.startTime}`);
  return ok(appt, "Appointment rescheduled");
});
