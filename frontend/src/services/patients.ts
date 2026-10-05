import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AddVaccinationRequest, Patient, PatientQuery, UpsertPatientRequest, Vaccination } from "@/types";
import { cleanQuery, useInvalidatingMutation } from "./helpers";
import { qk } from "./query-keys";

export function usePatients(query: PatientQuery = {}, options: { enabled?: boolean } = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.patients.list(q),
    queryFn: ({ signal }) => api.list<Patient>("/patients", q, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: qk.patients.detail(id ?? ""),
    queryFn: () => api.get<Patient>(`/patients/${id}`),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  return useInvalidatingMutation((body: UpsertPatientRequest) => api.post<Patient>("/patients", body), [qk.patients.all, qk.analytics.all]);
}

export function useUpdatePatient() {
  return useInvalidatingMutation(
    ({ id, ...body }: Partial<UpsertPatientRequest> & { id: string; currentMedications?: string[] }) =>
      api.patch<Patient>(`/patients/${id}`, body),
    [qk.patients.all],
  );
}

export function useArchivePatient() {
  return useInvalidatingMutation((id: string) => api.delete<null>(`/patients/${id}`), [qk.patients.all]);
}

export function useVaccinations(patientId: string | undefined) {
  return useQuery({
    queryKey: qk.patients.vaccinations(patientId ?? ""),
    queryFn: () => api.get<Vaccination[]>(`/patients/${patientId}/vaccinations`),
    enabled: !!patientId,
  });
}

export function useAddVaccination(patientId: string) {
  return useInvalidatingMutation(
    (body: AddVaccinationRequest) => api.post<Vaccination>(`/patients/${patientId}/vaccinations`, body),
    [qk.patients.vaccinations(patientId)],
  );
}
