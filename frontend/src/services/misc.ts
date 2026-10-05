import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  AdministerMedicationRequest,
  Admission,
  AdmitPatientRequest,
  AppointmentAnalytics,
  DateRangeQuery,
  HospitalOverview,
  ListQuery,
  Notification,
  PatientGrowthAnalytics,
  PlatformOverview,
  RecordVitalsRequest,
  RevenueAnalytics,
  SearchQuery,
  SearchResult,
  WardWithOccupancy,
} from "@/types";
import { cleanQuery, useInvalidatingMutation } from "./helpers";
import { qk } from "./query-keys";

/* ---------------- Notifications ---------------- */

export function useNotifications(query: ListQuery & { unread?: boolean } = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.notifications.list(q),
    queryFn: ({ signal }) => api.list<Notification>("/notifications/me", q, signal),
    placeholderData: keepPreviousData,
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: qk.notifications.unread,
    queryFn: () => api.get<{ count: number }>("/notifications/me/unread-count"),
    refetchInterval: 60_000,
    enabled,
  });
}

export function useMarkNotificationRead() {
  return useInvalidatingMutation((id: string) => api.patch<Notification>(`/notifications/${id}/read`), [qk.notifications.all]);
}

export function useMarkAllNotificationsRead() {
  return useInvalidatingMutation(() => api.post<null>("/notifications/me/read-all"), [qk.notifications.all]);
}

/* ---------------- Analytics ---------------- */

export function useRevenueAnalytics(query: DateRangeQuery = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.analytics.revenue(q),
    queryFn: () => api.get<RevenueAnalytics>("/analytics/revenue", q),
    placeholderData: keepPreviousData,
  });
}

export function useAppointmentAnalytics(query: DateRangeQuery = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.analytics.appointments(q),
    queryFn: () => api.get<AppointmentAnalytics>("/analytics/appointments", q),
    placeholderData: keepPreviousData,
  });
}

export function usePatientAnalytics(query: DateRangeQuery = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.analytics.patients(q),
    queryFn: () => api.get<PatientGrowthAnalytics>("/analytics/patients", q),
    placeholderData: keepPreviousData,
  });
}

export function useHospitalOverview(hospitalId?: string) {
  return useQuery({
    queryKey: qk.analytics.overview(hospitalId),
    queryFn: () => api.get<HospitalOverview>("/analytics/overview", { hospitalId }),
    refetchInterval: 60_000,
  });
}

export function usePlatformOverview() {
  return useQuery({ queryKey: qk.analytics.platform, queryFn: () => api.get<PlatformOverview>("/analytics/platform") });
}

/* ---------------- Search ---------------- */

export function useGlobalSearch(query: SearchQuery) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.search(q),
    queryFn: ({ signal }) => api.list<SearchResult>("/search", q, signal),
    enabled: (query.q?.trim().length ?? 0) >= 2,
    placeholderData: keepPreviousData,
  });
}

/* ---------------- Wards ---------------- */

export function useWards() {
  return useQuery({ queryKey: qk.wards.list, queryFn: () => api.get<WardWithOccupancy[]>("/wards") });
}

export function useAdmissions(
  query: ListQuery & { wardId?: string; status?: string[]; doctorId?: string } = {},
  options: { enabled?: boolean } = {},
) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.wards.admissions(q),
    queryFn: ({ signal }) => api.list<Admission>("/admissions", q, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useAdmission(id: string | undefined) {
  return useQuery({
    queryKey: qk.wards.admission(id ?? ""),
    queryFn: () => api.get<Admission>(`/admissions/${id}`),
    enabled: !!id,
  });
}

export function useAdmitPatient() {
  return useInvalidatingMutation(
    (body: AdmitPatientRequest) => api.post<Admission>("/admissions", body),
    [qk.wards.all, qk.departments.all, qk.analytics.all],
  );
}

export function useRecordAdmissionVitals(id: string) {
  return useInvalidatingMutation((body: RecordVitalsRequest) => api.post<Admission>(`/admissions/${id}/vitals`, body), [qk.wards.all]);
}

export function useAdministerMedication(id: string) {
  return useInvalidatingMutation(
    (body: AdministerMedicationRequest) => api.post<Admission>(`/admissions/${id}/medications`, body),
    [qk.wards.all],
  );
}

export function useAddAdmissionNote(id: string) {
  return useInvalidatingMutation((body: { text: string }) => api.post<Admission>(`/admissions/${id}/notes`, body), [qk.wards.all]);
}

export function useDischargePatient() {
  return useInvalidatingMutation(
    (id: string) => api.post<Admission>(`/admissions/${id}/discharge`),
    [qk.wards.all, qk.departments.all, qk.analytics.all],
  );
}
