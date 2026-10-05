import type { Role } from "@/types";
import type { Permission } from "./permissions";

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",

  dashboard: "/dashboard",
  search: "/search",
  notifications: "/notifications",
  settings: "/settings",

  hospitals: "/hospitals",
  hospitalNew: "/hospitals/new",
  hospital: (id: string) => `/hospitals/${id}`,
  departments: "/departments",
  staff: "/staff",
  doctors: "/doctors",
  doctor: (id: string) => `/doctors/${id}`,
  auditLogs: "/audit-logs",
  analytics: "/analytics",

  patients: "/patients",
  patientNew: "/patients/new",
  patient: (id: string) => `/patients/${id}`,

  appointments: "/appointments",
  appointmentNew: "/appointments/new",
  appointment: (id: string) => `/appointments/${id}`,
  availability: "/availability",
  encounter: (appointmentId: string) => `/encounters/${appointmentId}`,

  prescriptions: "/prescriptions",
  prescription: (id: string) => `/prescriptions/${id}`,

  wards: "/wards",
  admission: (id: string) => `/wards/admissions/${id}`,

  lab: "/lab",
  labOrder: (id: string) => `/lab/${id}`,
  labTests: "/lab/tests",

  pharmacy: "/pharmacy",
  medicine: (id: string) => `/pharmacy/medicines/${id}`,
  dispense: "/pharmacy/dispense",
  dispensePrescription: (id: string) => `/pharmacy/dispense/${id}`,

  billing: "/billing",
  invoiceNew: "/billing/new",
  invoice: (id: string) => `/billing/${id}`,
  claims: "/billing/claims",

  portal: "/portal",
  portalAppointments: "/portal/appointments",
  portalBook: "/portal/book",
  portalRecords: "/portal/records",
  portalRecord: (id: string) => `/portal/records/${id}`,
  portalReports: "/portal/reports",
  portalReport: (id: string) => `/portal/reports/${id}`,
  portalPrescriptions: "/portal/prescriptions",
  portalPrescription: (id: string) => `/portal/prescriptions/${id}`,
  portalInvoices: "/portal/invoices",
  portalInvoice: (id: string) => `/portal/invoices/${id}`,
  portalProfile: "/portal/profile",
} as const;

export const PUBLIC_ROUTES = [ROUTES.login, ROUTES.register, ROUTES.forgotPassword, ROUTES.resetPassword, ROUTES.verifyEmail];

/**
 * Route-level access control. Longest matching prefix wins.
 * Routes not listed here are open to any authenticated staff user.
 */
export const ROUTE_ACCESS: { prefix: string; permission?: Permission; roles?: Role[] }[] = [
  { prefix: "/hospitals", permission: "hospitals:manage" },
  { prefix: "/departments", permission: "departments:read" },
  { prefix: "/staff", permission: "staff:read" },
  { prefix: "/audit-logs", permission: "audit:read" },
  { prefix: "/analytics", permission: "analytics:read" },
  { prefix: "/patients", permission: "patients:read" },
  { prefix: "/patients/new", permission: "patients:write" },
  { prefix: "/appointments", permission: "appointments:read" },
  { prefix: "/appointments/new", permission: "appointments:create" },
  { prefix: "/availability", permission: "availability:manage" },
  { prefix: "/encounters", permission: "emr:write" },
  { prefix: "/prescriptions", permission: "prescriptions:read" },
  { prefix: "/wards", permission: "wards:read" },
  { prefix: "/lab", permission: "lab:read" },
  { prefix: "/pharmacy", permission: "pharmacy:read" },
  { prefix: "/pharmacy/dispense", permission: "pharmacy:dispense" },
  { prefix: "/billing", permission: "billing:read" },
  { prefix: "/billing/claims", permission: "claims:manage" },
  { prefix: "/portal", roles: ["PATIENT"] },
];

export function homeForRole(role: Role): string {
  return role === "PATIENT" ? ROUTES.portal : ROUTES.dashboard;
}
