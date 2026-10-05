import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  AddNoteRequest,
  Icd10Code,
  ListQuery,
  MedicalRecord,
  RecordVitalsRequest,
  UpdateMedicalRecordRequest,
  UploadAttachmentRequest,
} from "@/types";
import { cleanQuery, useInvalidatingMutation } from "./helpers";
import { qk } from "./query-keys";

export function usePatientRecords(patientId: string | undefined, query: ListQuery = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.records.byPatient(patientId ?? "", q),
    queryFn: ({ signal }) => api.list<MedicalRecord>(`/patients/${patientId}/medical-records`, q, signal),
    enabled: !!patientId,
    placeholderData: keepPreviousData,
  });
}

export function useMedicalRecord(id: string | undefined) {
  return useQuery({
    queryKey: qk.records.detail(id ?? ""),
    queryFn: () => api.get<MedicalRecord>(`/medical-records/${id}`),
    enabled: !!id,
  });
}

export function useRecordByAppointment(appointmentId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.records.byAppointment(appointmentId ?? ""),
    queryFn: () => api.get<MedicalRecord>(`/medical-records/by-appointment/${appointmentId}`),
    enabled: !!appointmentId && (options.enabled ?? true),
    retry: false,
  });
}

export function useStartEncounter() {
  return useInvalidatingMutation(
    (appointmentId: string) => api.post<MedicalRecord>("/medical-records", { appointmentId }),
    [qk.records.all, qk.appointments.all],
  );
}

export function useUpdateRecord(id: string) {
  return useInvalidatingMutation(
    (body: UpdateMedicalRecordRequest) => api.patch<MedicalRecord>(`/medical-records/${id}`, body),
    [qk.records.all, qk.patients.all],
  );
}

export function useRecordVitals(id: string) {
  return useInvalidatingMutation(
    (body: RecordVitalsRequest) => api.post<MedicalRecord>(`/medical-records/${id}/vitals`, body),
    [qk.records.all],
  );
}

export function useAddRecordNote(id: string) {
  return useInvalidatingMutation((body: AddNoteRequest) => api.post<MedicalRecord>(`/medical-records/${id}/notes`, body), [qk.records.all]);
}

export function useAddAttachment(id: string) {
  return useInvalidatingMutation(
    (body: UploadAttachmentRequest) => api.post<MedicalRecord>(`/medical-records/${id}/attachments`, body),
    [qk.records.all],
  );
}

export function useFinaliseRecord(id: string) {
  return useInvalidatingMutation(() => api.post<MedicalRecord>(`/medical-records/${id}/finalise`), [qk.records.all]);
}

export function useIcd10Search(search: string) {
  return useQuery({
    queryKey: qk.records.icd10(search),
    queryFn: () => api.get<Icd10Code[]>("/icd10", { search }),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}
