import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  AuditLog,
  CreateHospitalRequest,
  Department,
  Hospital,
  HospitalDetail,
  HospitalStatus,
  InviteStaffRequest,
  ListQuery,
  Role,
  UpsertDepartmentRequest,
  User,
  UserStatus,
} from "@/types";
import { cleanQuery, useInvalidatingMutation } from "./helpers";
import { qk } from "./query-keys";

/* ---------------- Hospitals (Super Admin) ---------------- */

export interface HospitalQuery extends ListQuery {
  status?: HospitalStatus[];
}

export function useHospitals(query: HospitalQuery = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.hospitals.list(q),
    queryFn: ({ signal }) => api.list<Hospital>("/hospitals", q, signal),
    placeholderData: keepPreviousData,
  });
}

export function useHospital(id: string | undefined) {
  return useQuery({
    queryKey: qk.hospitals.detail(id ?? ""),
    queryFn: () => api.get<HospitalDetail>(`/hospitals/${id}`),
    enabled: !!id,
  });
}

export function useCreateHospital() {
  return useInvalidatingMutation(
    (body: CreateHospitalRequest) => api.post<Hospital>("/hospitals", body),
    [qk.hospitals.all, qk.analytics.all],
  );
}

export function useUpdateHospitalStatus() {
  return useInvalidatingMutation(
    ({ id, status }: { id: string; status: Extract<HospitalStatus, "ACTIVE" | "SUSPENDED"> }) =>
      api.patch<Hospital>(`/hospitals/${id}/status`, { status }),
    [qk.hospitals.all, qk.analytics.all],
  );
}

export function useUpdateHospital() {
  return useInvalidatingMutation(
    ({ id, ...body }: Partial<Hospital> & { id: string }) => api.patch<Hospital>(`/hospitals/${id}`, body),
    [qk.hospitals.all],
  );
}

/* ---------------- Departments ---------------- */

export function useDepartments(hospitalId?: string) {
  return useQuery({
    queryKey: qk.departments.list(hospitalId),
    queryFn: () => api.get<Department[]>("/departments", { hospitalId }),
    staleTime: 60_000,
  });
}

export function useCreateDepartment() {
  return useInvalidatingMutation((body: UpsertDepartmentRequest) => api.post<Department>("/departments", body), [qk.departments.all]);
}

export function useUpdateDepartment() {
  return useInvalidatingMutation(
    ({ id, ...body }: Partial<UpsertDepartmentRequest> & { id: string }) => api.patch<Department>(`/departments/${id}`, body),
    [qk.departments.all],
  );
}

export function useDeleteDepartment() {
  return useInvalidatingMutation((id: string) => api.delete<null>(`/departments/${id}`), [qk.departments.all]);
}

/* ---------------- Staff ---------------- */

export interface StaffQuery extends ListQuery {
  role?: Role[];
  status?: UserStatus[];
}

export function useStaff(query: StaffQuery = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.staff.list(q),
    queryFn: ({ signal }) => api.list<User>("/staff", q, signal),
    placeholderData: keepPreviousData,
  });
}

export function useInviteStaff() {
  return useInvalidatingMutation((body: InviteStaffRequest) => api.post<User>("/staff/invite", body), [qk.staff.all, qk.doctors.all]);
}

export function useUpdateStaff() {
  return useInvalidatingMutation(
    ({ id, ...body }: { id: string; status?: UserStatus; role?: Role }) => api.patch<User>(`/staff/${id}`, body),
    [qk.staff.all],
  );
}

/* ---------------- Audit log ---------------- */

export interface AuditLogQuery extends ListQuery {
  action?: string[];
  entityType?: string[];
  from?: string;
  to?: string;
}

export function useAuditLogs(query: AuditLogQuery = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.auditLogs.list(q),
    queryFn: ({ signal }) => api.list<AuditLog>("/audit-logs", q, signal),
    placeholderData: keepPreviousData,
  });
}
