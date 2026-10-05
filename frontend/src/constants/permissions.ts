import type { Role } from "@/types";

const SA: Role = "SUPER_ADMIN";
const HA: Role = "HOSPITAL_ADMIN";
const DR: Role = "DOCTOR";
const NU: Role = "NURSE";
const RE: Role = "RECEPTIONIST";
const LT: Role = "LAB_TECHNICIAN";
const PH: Role = "PHARMACIST";
const AC: Role = "ACCOUNTANT";
const PT: Role = "PATIENT";

const ALL_STAFF: Role[] = [HA, DR, NU, RE, LT, PH, AC];

/**
 * Permissions matrix (PRD §06). The backend's @Roles() guards are the source of
 * truth; the frontend mirrors this to hide UI the user can't use.
 */
export const PERMISSIONS = {
  "hospitals:manage": [SA],
  "platform:analytics": [SA],
  "departments:read": [...ALL_STAFF],
  "departments:manage": [HA],
  "staff:read": [HA],
  "staff:manage": [HA],
  "doctors:read": [SA, ...ALL_STAFF, PT],
  "patients:read": [HA, DR, NU, RE, LT, PH, AC],
  "patients:write": [HA, RE],
  "appointments:read": [HA, DR, NU, RE, PT],
  "appointments:create": [HA, RE, PT],
  "appointments:status": [HA, DR, RE],
  "appointments:emergency": [HA, DR, RE],
  "availability:manage": [HA, DR],
  "emr:read": [DR, NU, PT],
  "emr:write": [DR],
  "vitals:write": [DR, NU],
  "prescriptions:read": [DR, NU, PH, PT],
  "prescriptions:write": [DR],
  "lab:read": [HA, DR, NU, LT, PT],
  "lab:order": [DR],
  "lab:collect": [LT, RE],
  "lab:process": [LT],
  "lab:approve": [LT],
  "pharmacy:read": [HA, DR, PH],
  "pharmacy:manage": [PH],
  "pharmacy:dispense": [PH],
  "billing:read": [HA, RE, AC, PT],
  "billing:write": [RE, AC],
  "billing:pay": [RE, AC, PT],
  "claims:manage": [AC],
  "analytics:read": [SA, HA, AC],
  "audit:read": [SA, HA],
  "wards:read": [HA, DR, NU],
  "wards:manage": [NU],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function permissionsForRole(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => hasPermission(role, p));
}
