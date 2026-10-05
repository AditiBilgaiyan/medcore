import type {
  AdmissionStatus,
  AllergySeverity,
  AppointmentStatus,
  AppointmentType,
  AuditAction,
  BatchStatus,
  BloodGroup,
  ClaimStatus,
  DiagnosisType,
  Frequency,
  Gender,
  HospitalStatus,
  HospitalType,
  InvoiceItemType,
  InvoiceStatus,
  LabOrderStatus,
  LabPriority,
  MedicineForm,
  NotificationChannel,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  PrescriptionStatus,
  ResultFlag,
  Role,
  SubscriptionPlan,
  UserStatus,
} from "./enums";

/** ISO-8601 timestamp, e.g. 2026-10-04T09:30:00.000Z */
export type ISODateTime = string;
/** Calendar date, e.g. 2026-10-04 */
export type ISODate = string;
/** 24h wall-clock time, e.g. 09:30 */
export type TimeOfDay = string;

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Hospital {
  id: string;
  name: string;
  code: string;
  type: HospitalType;
  status: HospitalStatus;
  plan: SubscriptionPlan;
  email: string;
  phone: string;
  address: Address;
  bedCount: number;
  registrationNumber: string;
  createdAt: ISODateTime;
  verifiedAt?: ISODateTime;
}

export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  code: string;
  description: string;
  headDoctorId?: string;
  totalBeds: number;
  occupiedBeds: number;
  consultationFee: number;
}

export interface User {
  id: string;
  hospitalId: string | null;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  status: UserStatus;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLoginAt?: ISODateTime;
  createdAt: ISODateTime;
  deletedAt?: ISODateTime | null;
}

/** GET /auth/me */
export interface CurrentUser extends User {
  hospitalName: string | null;
  permissions: string[];
  /** Present when role === DOCTOR */
  doctorId?: string;
  /** Present when role === PATIENT */
  patientId?: string;
}

export interface Doctor {
  id: string;
  userId: string;
  hospitalId: string;
  departmentIds: string[];
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialisation: string;
  qualification: string;
  registrationNumber: string;
  experienceYears: number;
  consultationFee: number;
  bio: string;
  rating: number;
  languages: string[];
  signatureDataUrl?: string;
  isAcceptingPatients: boolean;
  deletedAt?: ISODateTime | null;
}

/** A repeating weekly schedule block. dayOfWeek: 0 = Sunday … 6 = Saturday */
export interface AvailabilityRule {
  id: string;
  doctorId: string;
  departmentId: string;
  dayOfWeek: number;
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  slotMinutes: number;
}

export interface AvailabilityException {
  id: string;
  doctorId: string;
  date: ISODate;
  reason: string;
}

export interface TimeSlot {
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  available: boolean;
}

export interface Allergy {
  substance: string;
  reaction: string;
  severity: AllergySeverity;
}

export interface FamilyHistory {
  diabetes: boolean;
  hypertension: boolean;
  cancer: boolean;
  cardiac: boolean;
}

export interface Patient {
  id: string;
  userId?: string;
  hospitalId: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dob: ISODate;
  gender: Gender;
  bloodGroup?: BloodGroup;
  phone: string;
  email?: string;
  address: Address;
  emergencyContact: { name: string; relation: string; phone: string };
  allergies: Allergy[];
  familyHistory: FamilyHistory;
  chronicConditions: string[];
  currentMedications: string[];
  insurance?: { provider: string; policyNumber: string; validTill: ISODate };
  createdAt: ISODateTime;
  deletedAt?: ISODateTime | null;
}

export interface Appointment {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  doctorId: string;
  doctorName: string;
  departmentId: string;
  departmentName: string;
  date: ISODate;
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  type: AppointmentType;
  status: AppointmentStatus;
  isEmergency: boolean;
  reason: string;
  notes?: string;
  cancelledReason?: string;
  medicalRecordId?: string;
  invoiceId?: string;
  createdById: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Optimistic-concurrency version counter */
  version: number;
  deletedAt?: ISODateTime | null;
}

export interface Vitals {
  bpSystolic?: number;
  bpDiastolic?: number;
  pulse?: number;
  temperatureC?: number;
  spo2?: number;
  respiratoryRate?: number;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  recordedAt: ISODateTime;
  recordedById: string;
  recordedByName: string;
}

export interface Diagnosis {
  code: string;
  description: string;
  type: DiagnosisType;
}

export interface RecordNote {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  text: string;
  createdAt: ISODateTime;
}

export interface Vaccination {
  id: string;
  patientId: string;
  vaccine: string;
  date: ISODate;
  batchNumber: string;
  nextDueDate?: ISODate;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedAt: ISODateTime;
  uploadedById: string;
}

/** Append-only: notes can be added, nothing is ever removed. */
export interface MedicalRecord {
  id: string;
  hospitalId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  departmentName: string;
  vitals: Vitals[];
  chiefComplaint: string;
  symptoms: string[];
  diagnoses: Diagnosis[];
  treatmentPlan: string;
  allergiesNoted: Allergy[];
  notes: RecordNote[];
  attachments: Attachment[];
  followUpDate?: ISODate;
  prescriptionIds: string[];
  labOrderIds: string[];
  isFinalised: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PrescriptionItem {
  id: string;
  medicineId: string;
  medicineName: string;
  form: MedicineForm;
  dosage: string;
  frequency: Frequency;
  durationDays: number;
  quantity: number;
  instructions?: string;
  dispensedQty: number;
}

export interface Prescription {
  id: string;
  hospitalId: string;
  number: string;
  medicalRecordId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  items: PrescriptionItem[];
  status: PrescriptionStatus;
  notes?: string;
  signedAt: ISODateTime;
  createdAt: ISODateTime;
}

export interface LabParameter {
  name: string;
  unit: string;
  /** Reference range. Gender-specific ranges override the default when present. */
  refLow?: number;
  refHigh?: number;
  maleRange?: [number, number];
  femaleRange?: [number, number];
  criticalLow?: number;
  criticalHigh?: number;
}

export interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string;
  sampleType: string;
  price: number;
  turnaroundHours: number;
  parameters: LabParameter[];
}

export interface LabResult {
  testId: string;
  parameter: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  flag: ResultFlag;
}

export interface LabOrder {
  id: string;
  hospitalId: string;
  number: string;
  medicalRecordId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientGender: Gender;
  doctorId: string;
  doctorName: string;
  tests: { testId: string; testName: string; price: number }[];
  priority: LabPriority;
  status: LabOrderStatus;
  clinicalNotes?: string;
  results: LabResult[];
  reportAttachment?: Attachment;
  technicianRemarks?: string;
  collectedAt?: ISODateTime;
  collectedByName?: string;
  processedById?: string;
  processedByName?: string;
  approvedAt?: ISODateTime;
  approvedByName?: string;
  rejectionReason?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  mfgDate: ISODate;
  expiryDate: ISODate;
  quantity: number;
  unitCost: number;
  mrp: number;
  status: BatchStatus;
  receivedAt: ISODateTime;
}

export interface Medicine {
  id: string;
  hospitalId: string;
  name: string;
  genericName: string;
  form: MedicineForm;
  strength: string;
  manufacturer: string;
  category: string;
  reorderLevel: number;
  requiresPrescription: boolean;
  batches: MedicineBatch[];
  /** Derived: sum of ACTIVE, unexpired batch quantities */
  totalStock: number;
  /** Derived: MRP of the batch that would be dispensed next (FIFO) */
  unitPrice: number;
}

export interface Dispensation {
  id: string;
  prescriptionId: string;
  itemId: string;
  medicineId: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  dispensedByName: string;
  dispensedAt: ISODateTime;
}

export interface InvoiceItem {
  id: string;
  type: InvoiceItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  refId?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayRef?: string;
  paidAt: ISODateTime;
  receivedByName?: string;
}

export interface InsuranceClaim {
  id: string;
  hospitalId: string;
  invoiceId: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  tpaName: string;
  policyNumber: string;
  claimAmount: number;
  approvedAmount?: number;
  status: ClaimStatus;
  remarks?: string;
  submittedAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Invoice {
  id: string;
  hospitalId: string;
  number: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  appointmentId?: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: "INR";
  payments: Payment[];
  claimId?: string;
  notes?: string;
  issuedAt?: ISODateTime;
  dueDate?: ISODate;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  channels: NotificationChannel[];
  readAt?: ISODateTime | null;
  createdAt: ISODateTime;
}

export interface AuditLog {
  id: string;
  hospitalId: string | null;
  userId: string;
  userName: string;
  userRole: Role;
  action: AuditAction;
  entityType: string;
  entityId: string;
  summary: string;
  ip: string;
  createdAt: ISODateTime;
}

export interface Ward {
  id: string;
  hospitalId: string;
  departmentId: string;
  name: string;
  totalBeds: number;
}

export interface MedicationAdministration {
  id: string;
  medicine: string;
  dose: string;
  route: string;
  administeredAt: ISODateTime;
  nurseName: string;
  notes?: string;
}

export interface Admission {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  wardId: string;
  wardName: string;
  bedNumber: string;
  attendingDoctorId: string;
  attendingDoctorName: string;
  diagnosis: string;
  status: AdmissionStatus;
  admittedAt: ISODateTime;
  dischargedAt?: ISODateTime;
  vitals: Vitals[];
  medicationLog: MedicationAdministration[];
  nursingNotes: RecordNote[];
}

export interface DeviceSession {
  id: string;
  deviceName: string;
  ip: string;
  lastUsedAt: ISODateTime;
  current: boolean;
}

export interface Icd10Code {
  code: string;
  description: string;
}
