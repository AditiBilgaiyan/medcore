import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  BillingSummary,
  CheckoutRequest,
  CheckoutSession,
  ClaimStatus,
  CreateClaimRequest,
  CreateInvoiceRequest,
  InsuranceClaim,
  Invoice,
  InvoiceDetail,
  InvoiceQuery,
  ListQuery,
  PaymentWebhookRequest,
  RecordPaymentRequest,
  UpdateClaimRequest,
  UpdateInvoiceRequest,
} from "@/types";
import { cleanQuery, useInvalidatingMutation } from "./helpers";
import { qk } from "./query-keys";

export function useInvoices(query: InvoiceQuery = {}, options: { enabled?: boolean } = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.billing.list(q),
    queryFn: ({ signal }) => api.list<Invoice>("/invoices", q, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useInvoice(id: string | undefined, options: { refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: qk.billing.detail(id ?? ""),
    queryFn: () => api.get<InvoiceDetail>(`/invoices/${id}`),
    enabled: !!id,
    refetchInterval: options.refetchInterval,
  });
}

const BILLING_KEYS = [qk.billing.all, qk.analytics.all, qk.notifications.all];

export function useCreateInvoice() {
  return useInvalidatingMutation((body: CreateInvoiceRequest) => api.post<Invoice>("/invoices", body), BILLING_KEYS);
}

export function useUpdateInvoice(id: string) {
  return useInvalidatingMutation((body: UpdateInvoiceRequest) => api.patch<Invoice>(`/invoices/${id}`, body), BILLING_KEYS);
}

export function useFinaliseInvoice() {
  return useInvalidatingMutation((id: string) => api.post<Invoice>(`/invoices/${id}/finalise`), BILLING_KEYS);
}

export function useVoidInvoice() {
  return useInvalidatingMutation(
    ({ id, reason }: { id: string; reason: string }) => api.post<Invoice>(`/invoices/${id}/void`, { reason }),
    BILLING_KEYS,
  );
}

/** Cash at the counter. Online payments go through checkout + webhook. */
export function useRecordPayment(invoiceId: string) {
  return useInvalidatingMutation((body: RecordPaymentRequest) => api.post<Invoice>(`/invoices/${invoiceId}/payments`, body), BILLING_KEYS);
}

export function useCheckout() {
  return useInvalidatingMutation((body: CheckoutRequest) => api.post<CheckoutSession>("/payments/checkout", body), []);
}

/**
 * Mock mode only: plays the role of Stripe/Razorpay calling our webhook after the
 * customer completes payment. The server verifies the signature; the client never
 * marks an invoice as paid itself.
 */
export function useSimulateGatewayWebhook() {
  // No invalidation here: PaymentDialog refreshes billing data when it closes, so the
  // page behind it doesn't re-render (and unmount the dialog) mid-confirmation.
  return useInvalidatingMutation(
    ({ provider, ...body }: PaymentWebhookRequest & { provider: "STRIPE" | "RAZORPAY" }) =>
      api.post<{ received: boolean }>(`/payments/webhook/${provider.toLowerCase()}`, body, { skipAuth: true }),
    [],
  );
}

/** Query keys to refresh after an online payment completes. */
export const PAYMENT_REFRESH_KEYS = BILLING_KEYS;

export interface ClaimQuery extends ListQuery {
  status?: ClaimStatus[];
}

export function useClaims(query: ClaimQuery = {}) {
  const q = cleanQuery(query);
  return useQuery({
    queryKey: qk.billing.claims(q),
    queryFn: ({ signal }) => api.list<InsuranceClaim>("/claims", q, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCreateClaim() {
  return useInvalidatingMutation((body: CreateClaimRequest) => api.post<InsuranceClaim>("/claims", body), BILLING_KEYS);
}

export function useUpdateClaim() {
  return useInvalidatingMutation(
    ({ id, ...body }: UpdateClaimRequest & { id: string }) => api.patch<InsuranceClaim>(`/claims/${id}`, body),
    BILLING_KEYS,
  );
}

export function useBillingSummary() {
  return useQuery({ queryKey: qk.billing.summary, queryFn: () => api.get<BillingSummary>("/billing/summary") });
}
