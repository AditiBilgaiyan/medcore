import { ApiError } from "@/lib/api/client";
import type { ClaimStatus, InvoiceStatus } from "@/types";

export const INVOICE_TABS: { value: "ALL" | InvoiceStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "ISSUED", label: "Issued" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "INSURANCE_PENDING", label: "Insurance pending" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
];

export const CLAIM_TABS: { value: "ALL" | ClaimStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "SETTLED", label: "Settled" },
];

/** Statuses that can still take money at the counter. */
export const PAYABLE_STATUSES: InvoiceStatus[] = ["ISSUED", "PARTIALLY_PAID", "INSURANCE_PENDING"];
/** Statuses that can be paid online (gateway checkout). */
export const ONLINE_PAYABLE_STATUSES: InvoiceStatus[] = ["ISSUED", "PARTIALLY_PAID"];

export function isApiErrorCode(err: unknown, ...codes: string[]): err is ApiError {
  return err instanceof ApiError && codes.includes(err.code);
}
