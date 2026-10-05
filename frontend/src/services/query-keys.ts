/**
 * Query-key factory. Every key starts with its domain so a mutation can
 * invalidate a whole domain with e.g. `qk.appointments.all`.
 */
export const qk = {
  auth: {
    sessions: ["auth", "sessions"] as const,
    publicHospitals: ["auth", "public-hospitals"] as const,
  },
  hospitals: {
    all: ["hospitals"] as const,
    list: (q: object) => ["hospitals", "list", q] as const,
    detail: (id: string) => ["hospitals", "detail", id] as const,
  },
  departments: {
    all: ["departments"] as const,
    list: (hospitalId?: string) => ["departments", "list", hospitalId ?? "mine"] as const,
  },
  staff: {
    all: ["staff"] as const,
    list: (q: object) => ["staff", "list", q] as const,
  },
  auditLogs: {
    all: ["audit-logs"] as const,
    list: (q: object) => ["audit-logs", "list", q] as const,
  },
  doctors: {
    all: ["doctors"] as const,
    list: (q: object) => ["doctors", "list", q] as const,
    detail: (id: string) => ["doctors", "detail", id] as const,
    availability: (id: string) => ["doctors", "availability", id] as const,
    slots: (id: string, date: string) => ["doctors", "slots", id, date] as const,
  },
  patients: {
    all: ["patients"] as const,
    list: (q: object) => ["patients", "list", q] as const,
    detail: (id: string) => ["patients", "detail", id] as const,
    vaccinations: (id: string) => ["patients", "vaccinations", id] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    list: (q: object) => ["appointments", "list", q] as const,
    detail: (id: string) => ["appointments", "detail", id] as const,
  },
  records: {
    all: ["records"] as const,
    byPatient: (patientId: string, q: object) => ["records", "patient", patientId, q] as const,
    detail: (id: string) => ["records", "detail", id] as const,
    byAppointment: (appointmentId: string) => ["records", "appointment", appointmentId] as const,
    icd10: (search: string) => ["records", "icd10", search] as const,
  },
  prescriptions: {
    all: ["prescriptions"] as const,
    list: (q: object) => ["prescriptions", "list", q] as const,
    detail: (id: string) => ["prescriptions", "detail", id] as const,
  },
  lab: {
    all: ["lab"] as const,
    tests: ["lab", "tests"] as const,
    list: (q: object) => ["lab", "orders", q] as const,
    detail: (id: string) => ["lab", "order", id] as const,
  },
  pharmacy: {
    all: ["pharmacy"] as const,
    list: (q: object) => ["pharmacy", "medicines", q] as const,
    detail: (id: string) => ["pharmacy", "medicine", id] as const,
    summary: ["pharmacy", "summary"] as const,
    expiry: (withinDays: number) => ["pharmacy", "expiry", withinDays] as const,
  },
  billing: {
    all: ["billing"] as const,
    list: (q: object) => ["billing", "invoices", q] as const,
    detail: (id: string) => ["billing", "invoice", id] as const,
    claims: (q: object) => ["billing", "claims", q] as const,
    summary: ["billing", "summary"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (q: object) => ["notifications", "list", q] as const,
    unread: ["notifications", "unread"] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    revenue: (q: object) => ["analytics", "revenue", q] as const,
    appointments: (q: object) => ["analytics", "appointments", q] as const,
    patients: (q: object) => ["analytics", "patients", q] as const,
    overview: (hospitalId?: string) => ["analytics", "overview", hospitalId ?? "mine"] as const,
    platform: ["analytics", "platform"] as const,
  },
  search: (q: object) => ["search", q] as const,
  wards: {
    all: ["wards"] as const,
    list: ["wards", "list"] as const,
    admissions: (q: object) => ["wards", "admissions", q] as const,
    admission: (id: string) => ["wards", "admission", id] as const,
  },
};
