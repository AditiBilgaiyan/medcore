import {
  Activity,
  BarChart3,
  BedDouble,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
  Home,
  LayoutDashboard,
  type LucideIcon,
  Pill,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Stethoscope,
  TestTubes,
  User,
  Users,
  UserCog,
  Bell,
} from "lucide-react";
import type { Role } from "@/types";
import { hasPermission, type Permission } from "./permissions";
import { ROUTES } from "./routes";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  roles?: Role[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

const STAFF_NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
      { title: "Analytics", href: ROUTES.analytics, icon: BarChart3, permission: "analytics:read" },
      { title: "Notifications", href: ROUTES.notifications, icon: Bell },
    ],
  },
  {
    label: "Platform",
    items: [{ title: "Hospitals", href: ROUTES.hospitals, icon: Building2, permission: "hospitals:manage" }],
  },
  {
    label: "Clinical",
    items: [
      { title: "Patients", href: ROUTES.patients, icon: Users, permission: "patients:read" },
      { title: "Appointments", href: ROUTES.appointments, icon: CalendarDays, permission: "appointments:read" },
      { title: "My Availability", href: ROUTES.availability, icon: CalendarClock, roles: ["DOCTOR"] },
      { title: "Prescriptions", href: ROUTES.prescriptions, icon: ScrollText, permission: "prescriptions:read" },
      { title: "Wards", href: ROUTES.wards, icon: BedDouble, permission: "wards:read" },
      { title: "Doctors", href: ROUTES.doctors, icon: Stethoscope, permission: "doctors:read" },
    ],
  },
  {
    label: "Diagnostics & Pharmacy",
    items: [
      { title: "Lab Orders", href: ROUTES.lab, icon: FlaskConical, permission: "lab:read" },
      { title: "Test Catalogue", href: ROUTES.labTests, icon: TestTubes, roles: ["LAB_TECHNICIAN", "HOSPITAL_ADMIN"] },
      { title: "Inventory", href: ROUTES.pharmacy, icon: Pill, permission: "pharmacy:read" },
      { title: "Dispensing", href: ROUTES.dispense, icon: ClipboardList, permission: "pharmacy:dispense" },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Invoices", href: ROUTES.billing, icon: Receipt, permission: "billing:read" },
      { title: "Insurance Claims", href: ROUTES.claims, icon: ShieldCheck, permission: "claims:manage" },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Departments", href: ROUTES.departments, icon: Activity, permission: "departments:manage" },
      { title: "Staff", href: ROUTES.staff, icon: UserCog, permission: "staff:manage" },
      { title: "Audit Log", href: ROUTES.auditLogs, icon: FileText, permission: "audit:read" },
      { title: "Settings", href: ROUTES.settings, icon: Settings },
    ],
  },
];

const PATIENT_NAV: NavSection[] = [
  {
    label: "My Health",
    items: [
      { title: "Home", href: ROUTES.portal, icon: Home },
      { title: "Appointments", href: ROUTES.portalAppointments, icon: CalendarDays },
      { title: "Medical Records", href: ROUTES.portalRecords, icon: FileText },
      { title: "Lab Reports", href: ROUTES.portalReports, icon: FlaskConical },
      { title: "Prescriptions", href: ROUTES.portalPrescriptions, icon: ScrollText },
      { title: "Bills & Payments", href: ROUTES.portalInvoices, icon: CreditCard },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Notifications", href: ROUTES.notifications, icon: Bell },
      { title: "Profile", href: ROUTES.portalProfile, icon: User },
    ],
  },
];

export function navForRole(role: Role): NavSection[] {
  const source = role === "PATIENT" ? PATIENT_NAV : STAFF_NAV;
  return source
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => (!item.permission || hasPermission(role, item.permission)) && (!item.roles || item.roles.includes(role)),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
