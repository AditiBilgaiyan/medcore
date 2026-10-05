"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { applyServerErrors } from "@/lib/validation";
import { useCreateClaim, useRecordPayment, useUpdateInvoice } from "@/services/billing";
import type { InvoiceDetail } from "@/types";
import { isApiErrorCode } from "./constants";
import {
  InvoiceTotals,
  LineItemsEditor,
  invoiceFormSchema,
  toLineItemValues,
  toRequestItems,
  type InvoiceFieldsValues,
} from "./line-items-editor";

/* ------------------------------------------------------------------ */
/* Edit draft line items                                               */
/* ------------------------------------------------------------------ */

export function EditInvoiceSheet({ invoice, trigger }: { invoice: InvoiceDetail; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateInvoice(invoice.id);
  const form = useForm<InvoiceFieldsValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: { items: toLineItemValues(invoice.items), discount: invoice.discount, notes: invoice.notes ?? "" },
  });
  const { register, handleSubmit, reset, setError, formState } = form;

  const onOpenChange = (v: boolean) => {
    if (v) reset({ items: toLineItemValues(invoice.items), discount: invoice.discount, notes: invoice.notes ?? "" });
    setOpen(v);
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ items: toRequestItems(values.items), discount: values.discount, notes: values.notes ?? "" });
      toast.success(`${invoice.number} updated`);
      setOpen(false);
    } catch (err) {
      if (err instanceof ApiError) applyServerErrors<InvoiceFieldsValues>(err.details, setError);
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="flex h-full min-h-0 flex-col" noValidate>
            <SheetHeader className="border-b">
              <SheetTitle>Edit {invoice.number}</SheetTitle>
              <SheetDescription>Draft for {invoice.patientName}. Totals are recalculated from the line items on save.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              <LineItemsEditor disabled={update.isPending} idPrefix="edit-li" />
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup className="gap-4">
                  <Field data-invalid={!!formState.errors.discount || undefined}>
                    <FieldLabel htmlFor="edit-discount">Discount (₹)</FieldLabel>
                    <Input
                      id="edit-discount"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      className="tabular-nums"
                      aria-invalid={!!formState.errors.discount || undefined}
                      {...register("discount", { valueAsNumber: true })}
                    />
                    <FieldError errors={[formState.errors.discount]} />
                  </Field>
                  <Field data-invalid={!!formState.errors.notes || undefined}>
                    <FieldLabel htmlFor="edit-notes">Notes</FieldLabel>
                    <Textarea id="edit-notes" rows={3} placeholder="Shown on the invoice" {...register("notes")} />
                    <FieldError errors={[formState.errors.notes]} />
                  </Field>
                </FieldGroup>
                <div className="bg-muted/30 self-start rounded-lg border p-3">
                  <InvoiceTotals taxRate={invoice.taxRate} />
                </div>
              </div>
            </div>
            <SheetFooter className="flex-row justify-end border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={update.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                {update.isPending && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </SheetFooter>
          </form>
        </FormProvider>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Cash payment at the counter                                         */
/* ------------------------------------------------------------------ */

export function RecordCashPaymentDialog({ invoice, trigger }: { invoice: InvoiceDetail; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const record = useRecordPayment(invoice.id);
  const balance = invoice.balanceDue;
  const schema = z.object({
    amount: z
      .number({ invalid_type_error: "Enter the amount received" })
      .positive("Amount must be more than 0")
      .max(balance, `Can't exceed the balance due (${formatCurrency(balance)})`),
  });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, reset, setError, setValue, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: balance },
  });

  const onSubmit = handleSubmit(async ({ amount }) => {
    try {
      const inv = await record.mutateAsync({ method: "CASH", amount });
      toast.success(
        inv.balanceDue > 0
          ? `Cash payment of ${formatCurrency(amount)} recorded. ${formatCurrency(inv.balanceDue)} still due.`
          : `Cash payment of ${formatCurrency(amount)} recorded. ${invoice.number} is paid in full.`,
      );
      setOpen(false);
    } catch (err) {
      if (isApiErrorCode(err, "OVERPAYMENT")) setError("amount", { type: "server", message: err.message });
      else if (err instanceof ApiError) applyServerErrors<Values>(err.details, setError);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) reset({ amount: balance });
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Record cash payment</DialogTitle>
            <DialogDescription>
              {invoice.number} · {invoice.patientName}. Balance due{" "}
              <span className="text-foreground font-medium tabular-nums">{formatCurrency(balance)}</span>.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!formState.errors.amount || undefined}>
            <FieldLabel htmlFor="cash-amount">Amount received (₹)</FieldLabel>
            <Input
              id="cash-amount"
              type="number"
              inputMode="decimal"
              min={0}
              max={balance}
              step="0.01"
              autoFocus
              className="text-right text-base tabular-nums"
              aria-invalid={!!formState.errors.amount || undefined}
              {...register("amount", { valueAsNumber: true })}
            />
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="xs" variant="secondary" onClick={() => setValue("amount", balance, { shouldValidate: true })}>
                Full balance
              </Button>
              {balance >= 1000 && (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => setValue("amount", Math.round(balance / 2), { shouldValidate: true })}
                >
                  Half ({formatCurrency(Math.round(balance / 2))})
                </Button>
              )}
            </div>
            <FieldError errors={[formState.errors.amount]} />
            <FieldDescription>
              Card, UPI and netbanking go through &ldquo;Collect online&rdquo; so the gateway confirms them.
            </FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={record.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending && <Loader2 className="animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Insurance claim                                                     */
/* ------------------------------------------------------------------ */

export function RaiseClaimDialog({ invoice, trigger }: { invoice: InvoiceDetail; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const create = useCreateClaim();
  const insurance = invoice.patient?.insurance;
  const balance = invoice.balanceDue;
  const expired = !!insurance?.validTill && insurance.validTill < new Date().toISOString().slice(0, 10);
  const schema = z.object({
    tpaName: z.string().trim().min(1, "Enter the insurer / TPA"),
    policyNumber: z.string().trim().min(1, "Enter the policy number"),
    claimAmount: z
      .number({ invalid_type_error: "Enter the claim amount" })
      .positive("Must be more than 0")
      .max(balance, `Can't exceed the balance due (${formatCurrency(balance)})`),
  });
  type Values = z.infer<typeof schema>;
  const defaults = (): Values => ({
    tpaName: insurance?.provider ?? "",
    policyNumber: insurance?.policyNumber ?? "",
    claimAmount: balance,
  });
  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({ invoiceId: invoice.id, ...values });
      toast.success(`Claim of ${formatCurrency(values.claimAmount)} submitted to ${values.tpaName}`);
      setOpen(false);
    } catch (err) {
      if (err instanceof ApiError) applyServerErrors<Values>(err.details, setError);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) reset(defaults());
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Raise insurance claim</DialogTitle>
            <DialogDescription>
              {invoice.number} · balance due <span className="text-foreground font-medium tabular-nums">{formatCurrency(balance)}</span>.
              The invoice moves to &ldquo;Insurance pending&rdquo; until the TPA decides.
            </DialogDescription>
          </DialogHeader>
          {expired && (
            <p role="alert" className="border-warning/40 bg-warning/10 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              The policy on file expired on {formatDate(insurance?.validTill)}. Confirm cover with the patient before submitting.
            </p>
          )}
          <FieldGroup className="gap-4">
            <Field data-invalid={!!formState.errors.tpaName || undefined}>
              <FieldLabel htmlFor="claim-tpa">Insurer / TPA</FieldLabel>
              <Input id="claim-tpa" aria-invalid={!!formState.errors.tpaName || undefined} {...register("tpaName")} />
              <FieldError errors={[formState.errors.tpaName]} />
            </Field>
            <Field data-invalid={!!formState.errors.policyNumber || undefined}>
              <FieldLabel htmlFor="claim-policy">Policy number</FieldLabel>
              <Input
                id="claim-policy"
                className="font-mono"
                aria-invalid={!!formState.errors.policyNumber || undefined}
                {...register("policyNumber")}
              />
              {insurance?.validTill && <FieldDescription>Valid till {formatDate(insurance.validTill)}</FieldDescription>}
              <FieldError errors={[formState.errors.policyNumber]} />
            </Field>
            <Field data-invalid={!!formState.errors.claimAmount || undefined}>
              <FieldLabel htmlFor="claim-amount">Claim amount (₹)</FieldLabel>
              <Input
                id="claim-amount"
                type="number"
                inputMode="decimal"
                min={0}
                max={balance}
                step="0.01"
                className="text-right tabular-nums"
                aria-invalid={!!formState.errors.claimAmount || undefined}
                {...register("claimAmount", { valueAsNumber: true })}
              />
              <FieldError errors={[formState.errors.claimAmount]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              Submit claim
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
