import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AvailabilityResponse, AvailabilityRule, Doctor, DoctorQuery, TimeSlot, UpsertAvailabilityRequest } from "@/types";
import { cleanQuery, useInvalidatingMutation } from "./helpers";
import { qk } from "./query-keys";

export function useDoctors(query: DoctorQuery = {}, options: { enabled?: boolean } = {}) {
  const q = cleanQuery({ limit: 100, ...query });
  return useQuery({
    queryKey: qk.doctors.list(q),
    queryFn: ({ signal }) => api.list<Doctor>("/doctors", q, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: options.enabled ?? true,
  });
}

export function useDoctor(id: string | undefined) {
  return useQuery({
    queryKey: qk.doctors.detail(id ?? ""),
    queryFn: () => api.get<Doctor>(`/doctors/${id}`),
    enabled: !!id,
  });
}

export function useUpdateDoctor() {
  return useInvalidatingMutation(
    ({ id, ...body }: Partial<Doctor> & { id: string }) => api.patch<Doctor>(`/doctors/${id}`, body),
    [qk.doctors.all],
  );
}

export function useAvailability(doctorId: string | undefined) {
  return useQuery({
    queryKey: qk.doctors.availability(doctorId ?? ""),
    queryFn: () => api.get<AvailabilityResponse>(`/doctors/${doctorId}/availability`),
    enabled: !!doctorId,
  });
}

export function useSaveAvailability(doctorId: string) {
  return useInvalidatingMutation(
    (body: UpsertAvailabilityRequest) => api.put<AvailabilityRule[]>(`/doctors/${doctorId}/availability`, body),
    [qk.doctors.availability(doctorId), ["doctors", "slots", doctorId]],
  );
}

export function useAddAvailabilityException(doctorId: string) {
  return useInvalidatingMutation(
    (body: { date: string; reason: string }) =>
      api.post<{ exception: { id: string }; affectedAppointments: number }>(`/doctors/${doctorId}/availability/exceptions`, body),
    [qk.doctors.availability(doctorId), ["doctors", "slots", doctorId]],
  );
}

export function useRemoveAvailabilityException(doctorId: string) {
  return useInvalidatingMutation(
    (exceptionId: string) => api.delete<null>(`/doctors/${doctorId}/availability/exceptions/${exceptionId}`),
    [qk.doctors.availability(doctorId), ["doctors", "slots", doctorId]],
  );
}

/** Availability changes often — keep it fresh (PRD: 60 s cache TTL). */
export function useSlots(doctorId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: qk.doctors.slots(doctorId ?? "", date ?? ""),
    queryFn: () => api.get<TimeSlot[]>(`/doctors/${doctorId}/slots`, { date }),
    enabled: !!doctorId && !!date,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}
