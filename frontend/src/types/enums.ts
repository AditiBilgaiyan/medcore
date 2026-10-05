export const ROLES = [
  "SUPER_ADMIN",
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "LAB_TECHNICIAN",
  "PHARMACIST",
  "ACCOUNTANT",
  "PATIENT",
] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = ROLES.filter((r) => r !== "PATIENT" && r !== "SUPER_ADMIN") as Exclude<Role, "PATIENT" | "SUPER_ADMIN">[];

export type HospitalStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED";
export type HospitalType = "CLINIC" | "MULTI_SPECIALITY" | "DIAGNOSTIC_CENTRE" | "TELEHEALTH";
export type SubscriptionPlan = "STARTER" | "GROWTH" | "ENTERPRISE";
export type UserStatus = "ACTIVE" | "INVITED" | "DISABLED";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export const APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type AppointmentType = "CONSULTATION" | "FOLLOW_UP" | "EMERGENCY";

export type AllergySeverity = "MILD" | "MODERATE" | "SEVERE";
export type DiagnosisType = "DIFFERENTIAL" | "CONFIRMED";

export const MEDICINE_FORMS = ["TABLET", "CAPSULE", "SYRUP", "INJECTION", "TOPICAL"] as const;
export type MedicineForm = (typeof MEDICINE_FORMS)[number];

export const FREQUENCIES = ["OD", "BD", "TDS", "QID", "SOS"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export type PrescriptionStatus = "ISSUED" | "PARTIALLY_DISPENSED" | "DISPENSED" | "CANCELLED";

export type LabPriority = "ROUTINE" | "URGENT" | "STAT";
export const LAB_ORDER_STATUSES = [
  "ORDERED",
  "SAMPLE_COLLECTED",
  "PROCESSING",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type LabOrderStatus = (typeof LAB_ORDER_STATUSES)[number];
export type ResultFlag = "NORMAL" | "LOW" | "HIGH" | "CRITICAL";

export type BatchStatus = "ACTIVE" | "QUARANTINED" | "DEPLETED";

export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "INSURANCE_PENDING", "VOID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type InvoiceItemType = "CONSULTATION" | "LAB" | "PHARMACY" | "ROOM" | "PROCEDURE" | "OTHER";
export type PaymentMethod = "STRIPE_CARD" | "RAZORPAY_UPI" | "RAZORPAY_NETBANKING" | "CASH" | "INSURANCE";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED";
export type ClaimStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "SETTLED";

export type NotificationChannel = "EMAIL" | "SMS" | "IN_APP";
export type NotificationType =
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_REMINDER"
  | "LAB_REPORT_APPROVED"
  | "PRESCRIPTION_READY"
  | "INVOICE_GENERATED"
  | "PAYMENT_RECEIVED"
  | "LOW_STOCK_ALERT"
  | "EMERGENCY_APPOINTMENT"
  | "EXPIRY_ALERT"
  | "GENERAL";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT";
export type AdmissionStatus = "ADMITTED" | "DISCHARGED";
