import type { Role } from "@/types";

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  HOSPITAL_ADMIN: "Hospital Admin",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  RECEPTIONIST: "Receptionist",
  LAB_TECHNICIAN: "Lab Technician",
  PHARMACIST: "Pharmacist",
  ACCOUNTANT: "Accountant",
  PATIENT: "Patient",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: "Platform-wide management, hospital onboarding, global analytics",
  HOSPITAL_ADMIN: "Departments, staff, beds, hospital analytics, billing config",
  DOCTOR: "Encounters, EMR, prescriptions, lab orders, availability",
  NURSE: "Vitals, medication administration, ward management",
  RECEPTIONIST: "Patient registration, scheduling, invoices",
  LAB_TECHNICIAN: "Test orders, sample collection, results, approvals",
  PHARMACIST: "Prescription verification, dispensing, inventory",
  ACCOUNTANT: "Financial reports, insurance claims, reconciliation",
  PATIENT: "Own records, appointments, reports, payments",
};

/** Demo logins seeded into the mock API — one per role (PRD §13). */
export const DEMO_PASSWORD = "Demo@1234";
export const DEMO_ACCOUNTS: { role: Role; email: string }[] = [
  { role: "SUPER_ADMIN", email: "superadmin@medcore.dev" },
  { role: "HOSPITAL_ADMIN", email: "admin@citycare.dev" },
  { role: "DOCTOR", email: "dr.mehta@citycare.dev" },
  { role: "NURSE", email: "nurse.fernandes@citycare.dev" },
  { role: "RECEPTIONIST", email: "reception@citycare.dev" },
  { role: "LAB_TECHNICIAN", email: "lab@citycare.dev" },
  { role: "PHARMACIST", email: "pharmacy@citycare.dev" },
  { role: "ACCOUNTANT", email: "accounts@citycare.dev" },
  { role: "PATIENT", email: "aarav.sharma@mail.dev" },
];
