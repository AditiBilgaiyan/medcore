import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  Appointment,
  AppointmentQuery,
  CreateAppointmentRequest,
  RescheduleAppointmentRequest,
  UpdateAppointmentStatusRequest,
} from "@/types";
import { cleanQuery, useInvalidatingMutation } from "./helpers";
import { qk } from "./query-keys";

export function useAppointments(query: AppointmentQuery = {}, options: { enabled?: boolean; refetchInterval?: number } = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.appointments.list(q),
    queryFn: ({ signal }) => api.list<Appointment>("/appointments", q, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: qk.appointments.detail(id ?? ""),
    queryFn: () => api.get<Appointment>(`/appointments/${id}`),
    enabled: !!id,
  });
}

/** Booking touches slots, the patient's history and dashboards. */
const BOOKING_KEYS = [qk.appointments.all, ["doctors", "slots"], qk.analytics.all, qk.notifications.all];

export function useCreateAppointment() {
  return useInvalidatingMutation(
    (body: CreateAppointmentRequest) => api.post<Appointment>("/appointments", body),
    BOOKING_KEYS,
    // The booking form shows SLOT_UNAVAILABLE / PATIENT_CONFLICT inline.
    { silentError: true },
  );
}

export function useUpdateAppointmentStatus() {
  return useInvalidatingMutation(
    ({ id, ...body }: UpdateAppointmentStatusRequest & { id: string }) => api.patch<Appointment>(`/appointments/${id}/status`, body),
    [...BOOKING_KEYS, qk.records.all, qk.billing.all],
  );
}

export function useRescheduleAppointment() {
  return useInvalidatingMutation(
    ({ id, ...body }: RescheduleAppointmentRequest & { id: string }) => api.patch<Appointment>(`/appointments/${id}/reschedule`, body),
    BOOKING_KEYS,
    { silentError: true },
  );
}
