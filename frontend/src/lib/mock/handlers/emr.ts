import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "@/constants/config";
import { calculateBmi } from "@/lib/clinical";
import type { Diagnosis, MedicalRecord, Prescription, PrescriptionItem, Vitals } from "@/types";
import { ICD10_CODES } from "../data/catalog";
import { uid } from "../db";
import { created, fail, forbidden, matchesSearch, notFound, ok, paginate, requireFields, route, sortBy, type MockContext } from "../router";
import { assertPatientAccess } from "./clinical-directory";
import { ensureRecord } from "./appointments";

export function loadRecord(ctx: MockContext, id: string): MedicalRecord {
  const user = ctx.requireUser();
  const r = ctx.db.medicalRecords.find((x) => x.id === id);
  if (!r) notFound("Medical record");
  if (user.role === "PATIENT") {
    if (r!.patientId !== ctx.ownPatientId()) notFound("Medical record");
  } else {
    if (!["DOCTOR", "NURSE"].includes(user.role)) forbidden();
    ctx.assertTenant(r, "Medical record");
  }
  return r!;
}

function assertRecordDoctor(ctx: MockContext, r: MedicalRecord) {
  const user = ctx.requirePermission("emr:write");
  if (user.role === "DOCTOR" && ctx.ownDoctorId() !== r.doctorId) forbidden("Only the treating doctor can edit this record.");
}

export function buildVitals(ctx: MockContext, body: Record<string, unknown>): Vitals {
  const user = ctx.requireUser();
  const num = (k: string) => (body[k] === undefined || body[k] === null || body[k] === "" ? undefined : Number(body[k]));
  const v: Vitals = {
    bpSystolic: num("bpSystolic"),
    bpDiastolic: num("bpDiastolic"),
    pulse: num("pulse"),
    temperatureC: num("temperatureC"),
    spo2: num("spo2"),
    respiratoryRate: num("respiratoryRate"),
    heightCm: num("heightCm"),
    weightKg: num("weightKg"),
    recordedAt: new Date().toISOString(),
    recordedById: user.id,
    recordedByName: `${user.firstName} ${user.lastName}`,
  };
  v.bmi = calculateBmi(v.heightCm, v.weightKg);
  const values = [v.bpSystolic, v.bpDiastolic, v.pulse, v.temperatureC, v.spo2, v.respiratoryRate, v.heightCm, v.weightKg];
  if (values.every((x) => x === undefined)) fail(422, "VALIDATION_ERROR", "Enter at least one vital sign.");
  if (v.spo2 != null && (v.spo2 < 50 || v.spo2 > 100))
    fail(422, "VALIDATION_ERROR", "SpO₂ must be between 50 and 100.", { spo2: ["50–100"] });
  if (v.temperatureC != null && (v.temperatureC < 30 || v.temperatureC > 45))
    fail(422, "VALIDATION_ERROR", "Temperature must be between 30 and 45 °C.", { temperatureC: ["30–45 °C"] });
  return v;
}

/* ---------------- Records ---------------- */

route("GET", "/icd10", (ctx) => {
  ctx.requireUser();
  const search = ctx.query.str("search");
  return ok(ICD10_CODES.filter((c) => matchesSearch(search, c.code, c.description)).slice(0, 20));
});

route("POST", "/medical-records", (ctx) => {
  ctx.requirePermission("emr:write");
  requireFields(ctx.body, ["appointmentId"]);
  const appt = ctx.db.appointments.find((a) => a.id === ctx.body.appointmentId);
  ctx.assertTenant(appt, "Appointment");
  if (ctx.ownDoctorId() !== appt!.doctorId) forbidden("Only the treating doctor can start this encounter.");
  return created(ensureRecord(ctx, appt!));
});

route("GET", "/patients/:id/medical-records", (ctx) => {
  const user = ctx.requireUser();
  if (!["DOCTOR", "NURSE", "PATIENT"].includes(user.role)) forbidden();
  const p = assertPatientAccess(
    ctx,
    ctx.db.patients.find((x) => x.id === ctx.params.id),
  );
  const list = ctx.db.medicalRecords.filter((r) => r.patientId === p.id && (user.role !== "PATIENT" || r.isFinalised));
  return paginate(sortBy(list, ctx.query, { key: "createdAt", order: "desc" }), ctx.query);
});

route("GET", "/medical-records/by-appointment/:appointmentId", (ctx) => {
  const r = ctx.db.medicalRecords.find((x) => x.appointmentId === ctx.params.appointmentId);
  if (!r) notFound("Medical record");
  return ok(loadRecord(ctx, r!.id));
});

route("GET", "/medical-records/:id", (ctx) => ok(loadRecord(ctx, ctx.params.id)));

route("PATCH", "/medical-records/:id", (ctx) => {
  const r = loadRecord(ctx, ctx.params.id);
  assertRecordDoctor(ctx, r);
  if (r.isFinalised) fail(409, "RECORD_FINALISED", "This record is finalised. Add an addendum note instead.");
  const b = ctx.body;
  if (b.chiefComplaint !== undefined) r.chiefComplaint = String(b.chiefComplaint);
  if (Array.isArray(b.symptoms)) r.symptoms = b.symptoms as string[];
  if (Array.isArray(b.diagnoses)) r.diagnoses = b.diagnoses as Diagnosis[];
  if (b.treatmentPlan !== undefined) r.treatmentPlan = String(b.treatmentPlan);
  if (Array.isArray(b.allergiesNoted)) {
    r.allergiesNoted = b.allergiesNoted as MedicalRecord["allergiesNoted"];
    const patient = ctx.db.patients.find((p) => p.id === r.patientId)!;
    // New allergies flow back to the patient's master list; existing ones are never removed.
    for (const a of r.allergiesNoted) {
      if (!patient.allergies.some((x) => x.substance.toLowerCase() === a.substance.toLowerCase())) patient.allergies.push(a);
    }
  }
  if (b.followUpDate !== undefined) r.followUpDate = (b.followUpDate as string) || undefined;
  r.updatedAt = new Date().toISOString();
  return ok(r, "Saved");
});

route("POST", "/medical-records/:id/vitals", (ctx) => {
  ctx.requirePermission("vitals:write");
  const r = loadRecord(ctx, ctx.params.id);
  const v = buildVitals(ctx, ctx.body);
  r.vitals.unshift(v);
  r.updatedAt = v.recordedAt;
  ctx.audit("CREATE", "Vitals", r.id, `Recorded vitals for ${r.patientName}`);
  return created(r, "Vitals recorded");
});

route("POST", "/medical-records/:id/notes", (ctx) => {
  const user = ctx.requireRoles("DOCTOR", "NURSE");
  const r = loadRecord(ctx, ctx.params.id);
  requireFields(ctx.body, ["text"]);
  // Append-only: notes are never edited or deleted.
  r.notes.push({
    id: uid("note"),
    authorId: user.id,
    authorName: user.role === "DOCTOR" ? `Dr. ${user.firstName} ${user.lastName}` : `${user.firstName} ${user.lastName}`,
    authorRole: user.role,
    text: String(ctx.body.text).trim(),
    createdAt: new Date().toISOString(),
  });
  r.updatedAt = new Date().toISOString();
  ctx.audit("CREATE", "RecordNote", r.id, `${r.isFinalised ? "Addendum" : "Note"} added to ${r.patientName}'s record`);
  return created(r, r.isFinalised ? "Addendum added" : "Note added");
});

route("POST", "/medical-records/:id/attachments", (ctx) => {
  const user = ctx.requirePermission("emr:write");
  const r = loadRecord(ctx, ctx.params.id);
  requireFields(ctx.body, ["name", "mimeType", "sizeBytes", "dataUrl"]);
  const size = Number(ctx.body.sizeBytes);
  const mime = String(ctx.body.mimeType);
  const name = String(ctx.body.name);
  if (size > MAX_UPLOAD_BYTES) fail(413, "FILE_TOO_LARGE", "Files must be 20 MB or smaller.");
  if (!ALLOWED_UPLOAD_TYPES.includes(mime) || /\.(exe|bat|cmd|sh|js|msi|dll)$/i.test(name)) {
    fail(415, "UNSUPPORTED_FILE", "Only PDF, PNG, JPEG and WebP files are allowed.");
  }
  r.attachments.push({
    id: uid("att"),
    name,
    mimeType: mime,
    sizeBytes: size,
    url: String(ctx.body.dataUrl),
    uploadedAt: new Date().toISOString(),
    uploadedById: user.id,
  });
  ctx.audit("CREATE", "Attachment", r.id, `Attached ${name} to ${r.patientName}'s record`);
  return created(r, "File attached");
});

route("POST", "/medical-records/:id/finalise", (ctx) => {
  const r = loadRecord(ctx, ctx.params.id);
  assertRecordDoctor(ctx, r);
  if (!r.diagnoses.length) fail(422, "VALIDATION_ERROR", "Add at least one diagnosis before finalising.");
  r.isFinalised = true;
  r.updatedAt = new Date().toISOString();
  ctx.audit("UPDATE", "MedicalRecord", r.id, `Finalised record for ${r.patientName}`);
  return ok(r, "Record finalised");
});

/* ---------------- Prescriptions ---------------- */

const ALLERGY_CLASSES: Record<string, string[]> = {
  penicillin: ["amoxicillin", "clavulanic", "ampicillin", "penicillin"],
  sulfonamides: ["sulfa", "sulfamethoxazole"],
  nsaids: ["ibuprofen", "diclofenac", "aceclofenac", "aspirin", "mefenamic"],
};

function allergyConflicts(allergies: { substance: string }[], genericName: string): string | null {
  const g = genericName.toLowerCase();
  for (const a of allergies) {
    const s = a.substance.toLowerCase();
    const related = ALLERGY_CLASSES[s] ?? [s];
    if (related.some((r) => g.includes(r))) return a.substance;
  }
  return null;
}

export function loadPrescription(ctx: MockContext, id: string): Prescription {
  const user = ctx.requirePermission("prescriptions:read");
  const rx = ctx.db.prescriptions.find((x) => x.id === id);
  if (!rx) notFound("Prescription");
  if (user.role === "PATIENT") {
    if (rx!.patientId !== ctx.ownPatientId()) notFound("Prescription");
  } else ctx.assertTenant(rx, "Prescription");
  return rx!;
}

route("POST", "/prescriptions", (ctx) => {
  const user = ctx.requirePermission("prescriptions:write");
  requireFields(ctx.body, ["medicalRecordId", "items"]);
  const r = loadRecord(ctx, String(ctx.body.medicalRecordId));
  if (ctx.ownDoctorId() !== r.doctorId) forbidden("Only the treating doctor can prescribe for this encounter.");
  const patient = ctx.db.patients.find((p) => p.id === r.patientId)!;
  const items = ctx.body.items as {
    medicineId: string;
    dosage: string;
    frequency: PrescriptionItem["frequency"];
    durationDays: number;
    quantity: number;
    instructions?: string;
  }[];

  const built: PrescriptionItem[] = items.map((it, i) => {
    const med = ctx.db.medicines.find((m) => m.id === it.medicineId && m.hospitalId === r.hospitalId);
    if (!med) fail(422, "VALIDATION_ERROR", `Item ${i + 1}: medicine not found in this hospital's formulary.`);
    if (!it.dosage || !it.frequency || !(Number(it.durationDays) > 0) || !(Number(it.quantity) > 0)) {
      fail(422, "VALIDATION_ERROR", `Item ${i + 1}: dosage, frequency, duration and quantity are required.`);
    }
    const conflict = allergyConflicts([...patient.allergies, ...r.allergiesNoted], med!.genericName);
    if (conflict && !ctx.body.overrideAllergyWarning) {
      fail(
        422,
        "ALLERGY_CONFLICT",
        `${patient.firstName} has a recorded ${conflict} allergy and ${med!.name} contains ${med!.genericName}. Confirm to prescribe anyway.`,
        { [`items.${i}`]: [conflict] },
      );
    }
    return {
      id: uid("pi"),
      medicineId: med!.id,
      medicineName: med!.name,
      form: med!.form,
      dosage: String(it.dosage),
      frequency: it.frequency,
      durationDays: Number(it.durationDays),
      quantity: Number(it.quantity),
      instructions: it.instructions?.trim() || undefined,
      dispensedQty: 0,
    };
  });

  const now = new Date().toISOString();
  const rx: Prescription = {
    id: uid("rx"),
    hospitalId: r.hospitalId,
    number: ctx.number("rx", "RX"),
    medicalRecordId: r.id,
    appointmentId: r.appointmentId,
    patientId: r.patientId,
    patientName: r.patientName,
    doctorId: r.doctorId,
    doctorName: r.doctorName,
    items: built,
    status: "ISSUED",
    notes: (ctx.body.notes as string) || undefined,
    signedAt: now,
    createdAt: now,
  };
  ctx.db.prescriptions.unshift(rx);
  r.prescriptionIds.push(rx.id);
  r.updatedAt = now;
  ctx.audit(
    "CREATE",
    "Prescription",
    rx.id,
    `Prescribed ${built.length} item(s) to ${r.patientName}${ctx.body.overrideAllergyWarning ? " (allergy warning overridden)" : ""}`,
  );
  ctx.notifyRole("PHARMACIST", r.hospitalId, {
    type: "GENERAL",
    title: "New prescription",
    body: `${rx.number} for ${rx.patientName} from ${rx.doctorName}`,
    link: `/pharmacy/dispense/${rx.id}`,
    channels: ["IN_APP"],
  });
  void user;
  return created(rx, "Prescription issued");
});

route("GET", "/prescriptions", (ctx) => {
  const user = ctx.requirePermission("prescriptions:read");
  const tenant = ctx.tenantId();
  const status = ctx.query.arr("status");
  const doctorId = ctx.query.str("doctorId");
  const search = ctx.query.str("search");
  const patientId = user.role === "PATIENT" ? (ctx.ownPatientId() ?? "none") : ctx.query.str("patientId");
  const list = ctx.db.prescriptions.filter(
    (rx) =>
      (tenant === null || rx.hospitalId === tenant) &&
      (!patientId || rx.patientId === patientId) &&
      (!doctorId || rx.doctorId === doctorId) &&
      (!status || status.includes(rx.status)) &&
      matchesSearch(search, rx.number, rx.patientName, rx.doctorName, ...rx.items.map((i) => i.medicineName)),
  );
  return paginate(sortBy(list, ctx.query, { key: "createdAt", order: "desc" }), ctx.query);
});

route("GET", "/prescriptions/:id", (ctx) => {
  const rx = loadPrescription(ctx, ctx.params.id);
  const doctor = ctx.db.doctors.find((d) => d.id === rx.doctorId);
  const patient = ctx.db.patients.find((p) => p.id === rx.patientId);
  const hospital = ctx.db.hospitals.find((h) => h.id === rx.hospitalId);
  const record = ctx.db.medicalRecords.find((m) => m.id === rx.medicalRecordId);
  return ok({
    ...rx,
    doctor: doctor && {
      qualification: doctor.qualification,
      registrationNumber: doctor.registrationNumber,
      specialisation: doctor.specialisation,
      signatureDataUrl: doctor.signatureDataUrl,
    },
    patient: patient && { mrn: patient.mrn, dob: patient.dob, gender: patient.gender, phone: patient.phone, allergies: patient.allergies },
    hospital: hospital && {
      name: hospital.name,
      phone: hospital.phone,
      email: hospital.email,
      address: hospital.address,
      registrationNumber: hospital.registrationNumber,
    },
    diagnoses: record?.diagnoses ?? [],
    vitals: record?.vitals[0],
    dispensations: ctx.db.dispensations.filter((d) => d.prescriptionId === rx.id),
  });
});

route("POST", "/prescriptions/:id/cancel", (ctx) => {
  ctx.requirePermission("prescriptions:write");
  const rx = loadPrescription(ctx, ctx.params.id);
  if (ctx.ownDoctorId() !== rx.doctorId) forbidden("Only the prescribing doctor can cancel this prescription.");
  if (rx.status !== "ISSUED") fail(422, "INVALID_TRANSITION", "Only prescriptions that haven't been dispensed can be cancelled.");
  rx.status = "CANCELLED";
  ctx.audit("UPDATE", "Prescription", rx.id, `Cancelled ${rx.number}`);
  return ok(rx, "Prescription cancelled");
});
