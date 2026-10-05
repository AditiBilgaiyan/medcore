import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  CreateLabOrderRequest,
  LabOrder,
  LabOrderDetail,
  LabOrderQuery,
  LabTest,
  ReviewLabResultRequest,
  SubmitLabResultRequest,
} from "@/types";
import { cleanQuery, useInvalidatingMutation } from "./helpers";
import { qk } from "./query-keys";

export function useLabTests() {
  return useQuery({ queryKey: qk.lab.tests, queryFn: () => api.get<LabTest[]>("/lab-tests"), staleTime: Infinity });
}

export function useLabOrders(
  query: LabOrderQuery & { sortBy?: "priority" } = {},
  options: { enabled?: boolean; refetchInterval?: number } = {},
) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.lab.list(q),
    queryFn: ({ signal }) => api.list<LabOrder>("/lab-orders", q, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval,
  });
}

export function useLabOrder(id: string | undefined) {
  return useQuery({
    queryKey: qk.lab.detail(id ?? ""),
    queryFn: () => api.get<LabOrderDetail>(`/lab-orders/${id}`),
    enabled: !!id,
  });
}

const LAB_KEYS = [qk.lab.all, qk.records.all, qk.notifications.all];

export function useCreateLabOrder() {
  return useInvalidatingMutation((body: CreateLabOrderRequest) => api.post<LabOrder>("/lab-orders", body), [...LAB_KEYS, qk.billing.all]);
}

export function useCollectSample() {
  return useInvalidatingMutation((id: string) => api.patch<LabOrder>(`/lab-orders/${id}/collect`), LAB_KEYS);
}

export function useStartProcessing() {
  return useInvalidatingMutation((id: string) => api.patch<LabOrder>(`/lab-orders/${id}/start`), LAB_KEYS);
}

export function useSubmitResults(id: string) {
  return useInvalidatingMutation((body: SubmitLabResultRequest) => api.patch<LabOrder>(`/lab-orders/${id}/result`, body), LAB_KEYS);
}

export function useReviewResults(id: string) {
  return useInvalidatingMutation((body: ReviewLabResultRequest) => api.patch<LabOrder>(`/lab-orders/${id}/review`, body), LAB_KEYS);
}

export function useCancelLabOrder() {
  return useInvalidatingMutation((id: string) => api.patch<LabOrder>(`/lab-orders/${id}/cancel`), LAB_KEYS);
}
