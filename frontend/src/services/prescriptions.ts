import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { CreatePrescriptionRequest, DispenseRequest, ListQuery, Prescription, PrescriptionDetail, PrescriptionStatus } from "@/types";
import { cleanQuery, useInvalidatingMutation } from "./helpers";
import { qk } from "./query-keys";

export interface PrescriptionQuery extends ListQuery {
  status?: PrescriptionStatus[];
  patientId?: string;
  doctorId?: string;
}

export function usePrescriptions(query: PrescriptionQuery = {}, options: { enabled?: boolean } = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.prescriptions.list(q),
    queryFn: ({ signal }) => api.list<Prescription>("/prescriptions", q, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function usePrescription(id: string | undefined) {
  return useQuery({
    queryKey: qk.prescriptions.detail(id ?? ""),
    queryFn: () => api.get<PrescriptionDetail>(`/prescriptions/${id}`),
    enabled: !!id,
  });
}

export function useCreatePrescription() {
  return useInvalidatingMutation(
    (body: CreatePrescriptionRequest) => api.post<Prescription>("/prescriptions", body),
    [qk.prescriptions.all, qk.records.all],
    // ALLERGY_CONFLICT is handled inline with a confirm-to-override dialog.
    { silentError: true },
  );
}

export function useCancelPrescription() {
  return useInvalidatingMutation((id: string) => api.post<Prescription>(`/prescriptions/${id}/cancel`), [qk.prescriptions.all]);
}

export function useDispense(prescriptionId: string) {
  return useInvalidatingMutation(
    (body: DispenseRequest) => api.post<Prescription>(`/prescriptions/${prescriptionId}/dispense`, body),
    [qk.prescriptions.all, qk.pharmacy.all, qk.billing.all],
  );
}
