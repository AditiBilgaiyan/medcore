"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Landmark, Loader2, SearchCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";
import { applyServerErrors } from "@/lib/validation";
import { useUpdateClaim } from "@/services/billing";
import type { InsuranceClaim } from "@/types";

type DialogKind = "review" | "approve" | "reject" | "settle" | null;

/** Next-step buttons for a claim, following SUBMITTED → UNDER_REVIEW → APPROVED → SETTLED (or REJECTED). */
export function ClaimActions({ claim }: { claim: InsuranceClaim }) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const update = useUpdateClaim();
  const close = (v: boolean) => !v && setDialog(null);

  if (claim.status === "REJECTED" || claim.status === "SETTLED") return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <div className="flex items-center justify-end gap-1.5">
      {claim.status === "SUBMITTED" && (
        <Button size="xs" variant="outline" onClick={() => setDialog("review")}>
          <SearchCheck /> Start review
        </Button>
      )}
      {claim.status === "UNDER_REVIEW" && (
        <Button size="xs" onClick={() => setDialog("approve")}>
          <CheckCircle2 /> Approve
        </Button>
      )}
      {(claim.status === "SUBMITTED" || claim.status === "UNDER_REVIEW") && (
        <Button
          size="xs"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDialog("reject")}
        >
          <XCircle /> Reject
        </Button>
      )}
      {claim.status === "APPROVED" && (
        <Button size="xs" onClick={() => setDialog("settle")}>
          <Landmark /> Mark settled
        </Button>
      )}

      <ConfirmDialog
        open={dialog === "review"}
        onOpenChange={close}
        title="Move claim to review?"
        description={`${claim.invoiceNumber} · ${claim.tpaName} has acknowledged the claim of ${formatCurrency(claim.claimAmount)} and is reviewing it.`}
        confirmLabel="Start review"
        onConfirm={async () => {
          await update.mutateAsync({ id: claim.id, status: "UNDER_REVIEW" });
          toast.success(`${claim.invoiceNumber} claim is under review`);
        }}
      />
      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={close}
        title="Reject claim?"
        description={`The invoice ${claim.invoiceNumber} goes back to the patient for payment. A new claim can be raised later.`}
        confirmLabel="Reject claim"
        destructive
        reason={{ label: "Remarks from the TPA", placeholder: "e.g. Pre-existing condition not covered", required: true }}
        onConfirm={async (remarks) => {
          await update.mutateAsync({ id: claim.id, status: "REJECTED", remarks });
          toast.success(`${claim.invoiceNumber} claim rejected`);
        }}
      />
      <ConfirmDialog
        open={dialog === "settle"}
        onOpenChange={close}
        title="Mark claim as settled?"
        description={
          <>
            Records an insurance payment of{" "}
            <strong className="tabular-nums">{formatCurrency(claim.approvedAmount ?? claim.claimAmount)}</strong> from {claim.tpaName}{" "}
            against {claim.invoiceNumber}. Any remaining balance stays due from the patient.
          </>
        }
        confirmLabel="Record settlement"
        onConfirm={async () => {
          await update.mutateAsync({ id: claim.id, status: "SETTLED" });
          toast.success(`Settlement recorded on ${claim.invoiceNumber}`);
        }}
      />
      <ApproveClaimDialog claim={claim} open={dialog === "approve"} onOpenChange={close} />
    </div>
  );
}

function ApproveClaimDialog({ claim, open, onOpenChange }: { claim: InsuranceClaim; open: boolean; onOpenChange: (v: boolean) => void }) {
  const update = useUpdateClaim();
  const schema = z.object({
    approvedAmount: z
      .number({ invalid_type_error: "Enter the approved amount" })
      .positive("Must be more than 0")
      .max(claim.claimAmount, `Can't exceed the claim (${formatCurrency(claim.claimAmount)})`),
    remarks: z.string().trim().max(500).optional(),
  });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    values: open ? { approvedAmount: claim.claimAmount, remarks: "" } : undefined,
  });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync({ id: claim.id, status: "APPROVED", approvedAmount: v.approvedAmount, remarks: v.remarks || undefined });
      toast.success(`Approved ${formatCurrency(v.approvedAmount)} on ${claim.invoiceNumber}`);
      onOpenChange(false);
      reset();
    } catch (err) {
      if (err instanceof ApiError) applyServerErrors<Values>(err.details, setError);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Approve claim</DialogTitle>
            <DialogDescription>
              {claim.invoiceNumber} · {claim.patientName} · {claim.tpaName}. Claimed{" "}
              <span className="text-foreground font-medium tabular-nums">{formatCurrency(claim.claimAmount)}</span>.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!formState.errors.approvedAmount || undefined}>
              <FieldLabel htmlFor={`approve-${claim.id}`}>Approved amount (₹)</FieldLabel>
              <Input
                id={`approve-${claim.id}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={claim.claimAmount}
                step="0.01"
                autoFocus
                className="text-right tabular-nums"
                aria-invalid={!!formState.errors.approvedAmount || undefined}
                {...register("approvedAmount", { valueAsNumber: true })}
              />
              <FieldError errors={[formState.errors.approvedAmount]} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`approve-remarks-${claim.id}`}>Remarks</FieldLabel>
              <Textarea
                id={`approve-remarks-${claim.id}`}
                rows={3}
                placeholder="e.g. Room rent capped as per policy"
                {...register("remarks")}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
