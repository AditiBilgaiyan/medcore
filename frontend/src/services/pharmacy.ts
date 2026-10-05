import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  AddBatchRequest,
  ExpiryAlert,
  ExpiryScanReport,
  Medicine,
  MedicineQuery,
  PharmacySummary,
  UpsertMedicineRequest,
} from "@/types";
import { cleanQuery, useInvalidatingMutation } from "./helpers";
import { qk } from "./query-keys";

export function useMedicines(query: MedicineQuery & { category?: string } = {}, options: { enabled?: boolean } = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.pharmacy.list(q),
    queryFn: ({ signal }) => api.list<Medicine>("/medicines", q, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useMedicine(id: string | undefined) {
  return useQuery({
    queryKey: qk.pharmacy.detail(id ?? ""),
    queryFn: () => api.get<Medicine>(`/medicines/${id}`),
    enabled: !!id,
  });
}

export function useCreateMedicine() {
  return useInvalidatingMutation((body: UpsertMedicineRequest) => api.post<Medicine>("/medicines", body), [qk.pharmacy.all]);
}

export function useUpdateMedicine() {
  return useInvalidatingMutation(
    ({ id, ...body }: Partial<UpsertMedicineRequest> & { id: string }) => api.patch<Medicine>(`/medicines/${id}`, body),
    [qk.pharmacy.all],
  );
}

export function useAddBatch(medicineId: string) {
  return useInvalidatingMutation(
    (body: AddBatchRequest) => api.post<Medicine>(`/medicines/${medicineId}/batches`, body),
    [qk.pharmacy.all],
  );
}

export function useQuarantineBatch() {
  return useInvalidatingMutation(
    ({ medicineId, batchId }: { medicineId: string; batchId: string }) =>
      api.patch<Medicine>(`/medicines/${medicineId}/batches/${batchId}/quarantine`),
    [qk.pharmacy.all],
  );
}

export function usePharmacySummary() {
  return useQuery({ queryKey: qk.pharmacy.summary, queryFn: () => api.get<PharmacySummary>("/pharmacy/summary") });
}

export function useExpiryAlerts(withinDays = 30) {
  return useQuery({
    queryKey: qk.pharmacy.expiry(withinDays),
    queryFn: () => api.get<ExpiryAlert[]>("/pharmacy/expiry-alerts", { withinDays }),
  });
}

export function useRunExpiryScan() {
  return useInvalidatingMutation(() => api.post<ExpiryScanReport>("/pharmacy/expiry-scan"), [qk.pharmacy.all, qk.notifications.all]);
}
