import type {
  AppointmentStatus,
  AppointmentType,
  Frequency,
  Gender,
  BloodGroup,
  HospitalType,
  InvoiceItemType,
  LabPriority,
  MedicineForm,
  PaymentMethod,
  Role,
  SubscriptionPlan,
  ClaimStatus,
  AllergySeverity,
} from "./enums";
import type { Address, Allergy, CurrentUser, Diagnosis, FamilyHistory, ISODate, LabResult, TimeOfDay } from "./models";

/* ------------------------------------------------------------------ */
/* Response envelopes (PRD §08)                                        */
/* ------------------------------------------------------------------ */

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiPaginated<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export interface LoginRequest {
  email: string;
  password: string;
  deviceName?: string;
}

export interface AuthSession {
  accessToken: string;
  /** Seconds until the access token expires */
  expiresIn: number;
  user: CurrentUser;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  hospitalId: string;
  dob: ISODate;
  gender: Gender;
}

export interface RegisterResponse {
  userId: string;
  email: string;
  /** Mock mode only — the real API emails the code via Resend. */
  devOtp?: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ForgotPasswordResponse {
  /** Mock mode only — the real API emails a reset link. */
  devResetToken?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface PublicHospital {
  id: string;
  name: string;
  city: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export interface CreateHospitalRequest {
  name: string;
  type: HospitalType;
  plan: SubscriptionPlan;
  email: string;
  phone: string;
  registrationNumber: string;
  bedCount: number;
  address: Address;
  admin: { firstName: string; lastName: string; email: string; phone: string };
}

export interface UpsertDepartmentRequest {
  name: string;
  code: string;
  description: string;
  totalBeds: number;
  consultationFee: number;
  headDoctorId?: string;
}

export interface InviteStaffRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Exclude<Role, "PATIENT" | "SUPER_ADMIN">;
  /** Required when role === DOCTOR */
  doctor?: {
    departmentIds: string[];
    specialisation: string;
    qualification: string;
    registrationNumber: string;
    experienceYears: number;
    consultationFee: number;
  };
}

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

export interface PatientQuery extends ListQuery {
  gender?: Gender;
}

export interface UpsertPatientRequest {
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
  insurance?: { provider: string; policyNumber: string; validTill: ISODate } | null;
}

/* ------------------------------------------------------------------ */
/* Doctors & availability                                              */
/* ------------------------------------------------------------------ */

export interface DoctorQuery extends ListQuery {
  hospitalId?: string;
  departmentId?: string;
  specialisation?: string;
}

export interface UpsertAvailabilityRequest {
  rules: {
    departmentId: string;
    dayOfWeek: number;
    startTime: TimeOfDay;
    endTime: TimeOfDay;
    slotMinutes: number;
  }[];
}

/* ------------------------------------------------------------------ */
/* Appointments                                                        */
/* ------------------------------------------------------------------ */

export interface AppointmentQuery extends ListQuery {
  date?: ISODate;
  from?: ISODate;
  to?: ISODate;
  doctorId?: string;
  patientId?: string;
  departmentId?: string;
  status?: AppointmentStatus | AppointmentStatus[];
  type?: AppointmentType;
}

export interface CreateAppointmentRequest {
  patientId: string;
  doctorId: string;
  departmentId: string;
  date: ISODate;
  startTime: TimeOfDay;
  type: AppointmentType;
  reason: string;
  notes?: string;
}

export interface UpdateAppointmentStatusRequest {
  status: AppointmentStatus;
  reason?: string;
  /** Optimistic concurrency: the version the client last saw */
  version: number;
}

export interface RescheduleAppointmentRequest {
  date: ISODate;
  startTime: TimeOfDay;
  version: number;
}

/* ------------------------------------------------------------------ */
/* EMR                                                                 */
/* ------------------------------------------------------------------ */

export interface CreateMedicalRecordRequest {
  appointmentId: string;
}

export interface UpdateMedicalRecordRequest {
  chiefComplaint?: string;
  symptoms?: string[];
  diagnoses?: Diagnosis[];
  treatmentPlan?: string;
  allergiesNoted?: Allergy[];
  followUpDate?: ISODate;
}

export interface RecordVitalsRequest {
  bpSystolic?: number;
  bpDiastolic?: number;
  pulse?: number;
  temperatureC?: number;
  spo2?: number;
  respiratoryRate?: number;
  heightCm?: number;
  weightKg?: number;
}

export interface AddNoteRequest {
  text: string;
}

export interface AddVaccinationRequest {
  vaccine: string;
  date: ISODate;
  batchNumber: string;
  nextDueDate?: ISODate;
}

export interface UploadAttachmentRequest {
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** data: URL in mock mode; the real API uses multipart upload to S3 */
  dataUrl: string;
}

/* ------------------------------------------------------------------ */
/* Prescriptions                                                       */
/* ------------------------------------------------------------------ */

export interface CreatePrescriptionRequest {
  medicalRecordId: string;
  notes?: string;
  /** Required to issue a prescription that conflicts with a recorded allergy. */
  overrideAllergyWarning?: boolean;
  items: {
    medicineId: string;
    dosage: string;
    frequency: Frequency;
    durationDays: number;
    quantity: number;
    instructions?: string;
  }[];
}

/* ------------------------------------------------------------------ */
/* Lab                                                                 */
/* ------------------------------------------------------------------ */

export interface LabOrderQuery extends ListQuery {
  status?: string | string[];
  patientId?: string;
  doctorId?: string;
  priority?: LabPriority;
}

export interface CreateLabOrderRequest {
  medicalRecordId: string;
  testIds: string[];
  priority: LabPriority;
  clinicalNotes?: string;
}

export interface SubmitLabResultRequest {
  results: Omit<LabResult, "flag" | "refLow" | "refHigh" | "unit">[];
  technicianRemarks?: string;
  reportAttachment?: UploadAttachmentRequest;
}

export interface ReviewLabResultRequest {
  decision: "APPROVE" | "REJECT";
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Pharmacy                                                            */
/* ------------------------------------------------------------------ */

export interface MedicineQuery extends ListQuery {
  hospitalId?: string;
  form?: MedicineForm;
  stock?: "LOW" | "OUT" | "EXPIRING" | "ALL";
}

export interface UpsertMedicineRequest {
  name: string;
  genericName: string;
  form: MedicineForm;
  strength: string;
  manufacturer: string;
  category: string;
  reorderLevel: number;
  requiresPrescription: boolean;
}

export interface AddBatchRequest {
  batchNumber: string;
  mfgDate: ISODate;
  expiryDate: ISODate;
  quantity: number;
  unitCost: number;
  mrp: number;
}

export interface DispenseRequest {
  items: { itemId: string; quantity: number }[];
}

export interface PharmacySummary {
  totalMedicines: number;
  lowStock: number;
  outOfStock: number;
  expiringSoon: number;
  expiredNotQuarantined: number;
  stockValue: number;
}

export interface ExpiryAlert {
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  expiryDate: ISODate;
  quantity: number;
  daysToExpiry: number;
  status: "EXPIRING" | "EXPIRED";
}

export interface ExpiryScanReport {
  scannedAt: string;
  expiring: ExpiryAlert[];
  expired: ExpiryAlert[];
  notified: number;
}

export interface BillingSummary {
  outstanding: number;
  collectedToday: number;
  invoicesToday: number;
  pendingClaims: number;
  draftInvoices: number;
}

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

export interface InvoiceQuery extends ListQuery {
  status?: string | string[];
  patientId?: string;
  from?: ISODate;
  to?: ISODate;
}

export interface CreateInvoiceRequest {
  patientId: string;
  appointmentId?: string;
  items: { type: InvoiceItemType; description: string; quantity: number; unitPrice: number; refId?: string }[];
  discount?: number;
  notes?: string;
}

export interface UpdateInvoiceRequest {
  items?: CreateInvoiceRequest["items"];
  discount?: number;
  notes?: string;
}

export interface RecordPaymentRequest {
  method: PaymentMethod;
  amount: number;
}

export interface CheckoutRequest {
  invoiceId: string;
  provider: "STRIPE" | "RAZORPAY";
}

/**
 * Body the payment gateway POSTs to /payments/webhook/{stripe|razorpay}.
 * In mock mode the gateway simulator sends it; the server verifies the signature.
 */
export interface PaymentWebhookRequest {
  sessionId: string;
  outcome: "succeeded" | "failed";
  method: Extract<PaymentMethod, "STRIPE_CARD" | "RAZORPAY_UPI" | "RAZORPAY_NETBANKING">;
  signature: string;
}

/** Response of POST /payments/checkout — the client hands this to Stripe/Razorpay. */
export interface CheckoutSession {
  invoiceId: string;
  provider: "STRIPE" | "RAZORPAY";
  sessionId: string;
  amount: number;
  currency: "INR";
}

export interface CreateClaimRequest {
  invoiceId: string;
  tpaName: string;
  policyNumber: string;
  claimAmount: number;
}

export interface UpdateClaimRequest {
  status: ClaimStatus;
  approvedAmount?: number;
  remarks?: string;
}

/* ------------------------------------------------------------------ */
/* Wards (nurse)                                                       */
/* ------------------------------------------------------------------ */

export interface AdmitPatientRequest {
  patientId: string;
  wardId: string;
  bedNumber: string;
  attendingDoctorId: string;
  diagnosis: string;
}

export interface WardWithOccupancy {
  id: string;
  hospitalId: string;
  departmentId: string;
  departmentName: string;
  name: string;
  totalBeds: number;
  occupiedBeds: number;
}

export interface AdministerMedicationRequest {
  medicine: string;
  dose: string;
  route: string;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export interface DateRangeQuery {
  from?: ISODate;
  to?: ISODate;
  hospitalId?: string;
}

export interface TimeSeriesPoint {
  date: ISODate;
  value: number;
}

export interface RevenueAnalytics {
  total: number;
  collected: number;
  outstanding: number;
  previousPeriodTotal: number;
  series: { date: ISODate; consultation: number; lab: number; pharmacy: number; other: number }[];
  byMethod: { method: PaymentMethod; amount: number }[];
  byDepartment: { department: string; amount: number }[];
}

export interface AppointmentAnalytics {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  series: { date: ISODate; total: number; completed: number; cancelled: number }[];
  byDepartment: { department: string; count: number }[];
  byStatus: { status: AppointmentStatus; count: number }[];
}

export interface PatientGrowthAnalytics {
  total: number;
  newInPeriod: number;
  series: TimeSeriesPoint[];
  byGender: { gender: Gender; count: number }[];
  byAgeGroup: { group: string; count: number }[];
}

export interface HospitalOverview {
  patientsToday: number;
  revenueToday: number;
  occupiedBeds: number;
  totalBeds: number;
  activeDoctors: number;
  pendingLabOrders: number;
  lowStockCount: number;
  appointmentsToday: number;
  /** Department x weekday occupancy (0-1) for the heat map */
  departmentOccupancy: { department: string; day: string; value: number }[];
}

export interface PlatformOverview {
  hospitals: number;
  activeHospitals: number;
  pendingVerification: number;
  totalUsers: number;
  totalPatients: number;
  monthlyRecurringRevenue: number;
  hospitalsByPlan: { plan: SubscriptionPlan; count: number }[];
  topHospitals: { hospitalId: string; name: string; appointments: number; revenue: number }[];
}

/* ------------------------------------------------------------------ */
/* Global search                                                       */
/* ------------------------------------------------------------------ */

export type SearchEntity = "patient" | "doctor" | "medicine" | "appointment" | "invoice";

export interface SearchResult {
  entity: SearchEntity;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchQuery {
  q: string;
  entities?: SearchEntity[];
  page?: number;
  limit?: number;
}

export interface AllergyInput {
  substance: string;
  reaction: string;
  severity: AllergySeverity;
}

/* ------------------------------------------------------------------ */
/* Detail responses                                                    */
/* ------------------------------------------------------------------ */

import type {
  AvailabilityException,
  AvailabilityRule,
  Diagnosis as DiagnosisModel,
  Dispensation,
  Hospital,
  InsuranceClaim,
  Invoice,
  LabOrder,
  LabTest,
  Prescription,
  User,
  Vitals,
} from "./models";

export interface PrescriptionDetail extends Prescription {
  doctor?: { qualification: string; registrationNumber: string; specialisation: string; signatureDataUrl?: string };
  patient?: { mrn: string; dob: ISODate; gender: Gender; phone: string; allergies: Allergy[] };
  hospital?: { name: string; phone: string; email: string; address: Address; registrationNumber: string };
  diagnoses: DiagnosisModel[];
  vitals?: Vitals;
  dispensations: Dispensation[];
}

export interface InvoiceDetail extends Invoice {
  hospital?: { name: string; address: Address; phone: string; email: string; registrationNumber: string };
  patient?: { phone: string; email?: string; address: Address; insurance?: { provider: string; policyNumber: string; validTill: ISODate } };
  claim?: InsuranceClaim;
}

export interface LabOrderDetail extends LabOrder {
  testDefinitions: LabTest[];
}

export interface HospitalDetail extends Hospital {
  stats: { departments: number; doctors: number; staff: number; patients: number; admin: Omit<User, never> | null };
}

export interface AvailabilityResponse {
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
}
