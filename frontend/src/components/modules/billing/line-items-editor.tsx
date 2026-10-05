"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Zap } from "lucide-react";
import { Controller, useFieldArray, useFormContext, useWatch, type Control } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InvoiceItem, InvoiceItemType } from "@/types";

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

export const ITEM_TYPES: { value: InvoiceItemType; label: string }[] = [
  { value: "CONSULTATION", label: "Consultation" },
  { value: "LAB", label: "Lab" },
  { value: "PHARMACY", label: "Pharmacy" },
  { value: "ROOM", label: "Room" },
  { value: "PROCEDURE", label: "Procedure" },
  { value: "OTHER", label: "Other" },
];

export const lineItemSchema = z.object({
  type: z.enum(["CONSULTATION", "LAB", "PHARMACY", "ROOM", "PROCEDURE", "OTHER"]),
  description: z.string().trim().min(1, "Describe the charge").max(200, "Keep it under 200 characters"),
  quantity: z.number({ invalid_type_error: "Enter a quantity" }).positive("Must be more than 0").max(10_000, "Too large"),
  unitPrice: z.number({ invalid_type_error: "Enter a price" }).min(0, "Can't be negative").max(10_000_000, "Too large"),
  refId: z.string().optional(),
});

export type LineItemValues = z.infer<typeof lineItemSchema>;

/** Fields shared by the create and edit invoice forms. */
export const invoiceFieldsSchema = z.object({
  items: z.array(lineItemSchema).min(1, "Add at least one line item"),
  discount: z.number({ invalid_type_error: "Enter a discount (0 for none)" }).min(0, "Discount can't be negative"),
  notes: z.string().trim().max(500, "Keep notes under 500 characters").optional(),
});

export type InvoiceFieldsValues = z.infer<typeof invoiceFieldsSchema>;

/** Billing integrity: the discount can never exceed the sum of the line items. */
export function refineDiscount(v: { items: LineItemValues[]; discount: number }, ctx: z.RefinementCtx) {
  const { subtotal } = computeTotals(v.items, v.discount);
  if (v.discount > subtotal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discount"],
      message: `Discount can't exceed the subtotal (${formatCurrency(subtotal)})`,
    });
  }
}

export const invoiceFormSchema = invoiceFieldsSchema.superRefine(refineDiscount);

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function lineAmount(it: Partial<LineItemValues> | undefined): number {
  const q = Number(it?.quantity);
  const p = Number(it?.unitPrice);
  return Number.isFinite(q) && Number.isFinite(p) ? round2(q * p) : 0;
}

export function computeTotals(items: Partial<LineItemValues>[] | undefined, discount: number | undefined, taxRate = 0) {
  const subtotal = round2((items ?? []).reduce((s, it) => s + lineAmount(it), 0));
  const d = Number.isFinite(discount) ? Math.max(0, Number(discount)) : 0;
  const tax = round2((subtotal - Math.min(d, subtotal)) * taxRate);
  return { subtotal, discount: round2(d), tax, total: round2(subtotal - Math.min(d, subtotal) + tax) };
}

export const emptyLineItem = (): LineItemValues => ({ type: "OTHER", description: "", quantity: 1, unitPrice: 0 });

export function toLineItemValues(items: InvoiceItem[]): LineItemValues[] {
  return items.map((it) => ({
    type: it.type,
    description: it.description,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    refId: it.refId,
  }));
}

/** Strip form-only values before sending to the API. */
export function toRequestItems(items: LineItemValues[]) {
  return items.map((it) => ({
    type: it.type,
    description: it.description.trim(),
    quantity: it.quantity,
    unitPrice: round2(it.unitPrice),
    ...(it.refId ? { refId: it.refId } : {}),
  }));
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export const LINE_ITEM_PRESETS: (Omit<LineItemValues, "quantity"> & { label: string })[] = [
  { label: "General ward / day", type: "ROOM", description: "Room charge — General ward / day", unitPrice: 1500 },
  { label: "Private room / day", type: "ROOM", description: "Room charge — Private room / day", unitPrice: 4000 },
  { label: "Dressing", type: "PROCEDURE", description: "Dressing", unitPrice: 250 },
  { label: "ECG", type: "PROCEDURE", description: "ECG", unitPrice: 300 },
  { label: "Nebulisation", type: "PROCEDURE", description: "Nebulisation", unitPrice: 200 },
  { label: "Injection admin.", type: "PROCEDURE", description: "Injection administration", unitPrice: 100 },
  { label: "Ambulance", type: "OTHER", description: "Ambulance service (within city)", unitPrice: 1200 },
];

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

const GRID = "sm:grid-cols-[8.5rem_minmax(0,1fr)_4.5rem_7rem_6.5rem_2rem]";

/**
 * Line items for an invoice form. Must be rendered inside a react-hook-form
 * `FormProvider` whose values include `items: LineItemValues[]`.
 */
export function LineItemsEditor({ disabled, idPrefix = "li" }: { disabled?: boolean; idPrefix?: string }) {
  const {
    control,
    register,
    getValues,
    formState: { errors },
  } = useFormContext<InvoiceFieldsValues>();
  const { fields, append, remove, update } = useFieldArray({ control, name: "items" });
  const itemErrors = errors.items;
  const arrayError = itemErrors?.root?.message ?? (itemErrors as { message?: string } | undefined)?.message;

  const addPreset = (p: (typeof LINE_ITEM_PRESETS)[number]) => {
    const item: LineItemValues = { type: p.type, description: p.description, quantity: 1, unitPrice: p.unitPrice };
    const current = getValues("items");
    // Replace a single untouched blank row instead of leaving it dangling.
    if (current.length === 1 && !current[0].description.trim() && !current[0].unitPrice) update(0, item);
    else append(item);
  };

  return (
    <div className="space-y-3">
      <div
        className={cn("text-muted-foreground hidden gap-2 px-1 text-xs font-semibold tracking-wide uppercase sm:grid", GRID)}
        aria-hidden
      >
        <span>Type</span>
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit price</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <ul className="space-y-2" aria-label="Line items">
        <AnimatePresence initial={false}>
          {fields.map((field, i) => {
            const rowErr = Array.isArray(itemErrors) ? itemErrors[i] : undefined;
            return (
              <motion.li
                key={field.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="rounded-lg border p-2.5 sm:border-0 sm:p-0"
              >
                <div className={cn("grid grid-cols-2 gap-2 sm:items-start", GRID)}>
                  <div className="col-span-2 space-y-1 sm:col-span-1">
                    <Label htmlFor={`${idPrefix}-${i}-type`} className="text-muted-foreground text-xs sm:sr-only">
                      Line {i + 1} type
                    </Label>
                    <Controller
                      control={control}
                      name={`items.${i}.type`}
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange} disabled={disabled}>
                          <SelectTrigger id={`${idPrefix}-${i}-type`} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEM_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="col-span-2 space-y-1 sm:col-span-1">
                    <Label htmlFor={`${idPrefix}-${i}-desc`} className="text-muted-foreground text-xs sm:sr-only">
                      Line {i + 1} description
                    </Label>
                    <Input
                      id={`${idPrefix}-${i}-desc`}
                      placeholder="e.g. Consultation — Dr. Mehta"
                      disabled={disabled}
                      aria-invalid={!!rowErr?.description || undefined}
                      {...register(`items.${i}.description`)}
                    />
                    <FieldError errors={[rowErr?.description]} className="text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${idPrefix}-${i}-qty`} className="text-muted-foreground text-xs sm:sr-only">
                      Line {i + 1} quantity
                    </Label>
                    <Input
                      id={`${idPrefix}-${i}-qty`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      className="text-right tabular-nums"
                      disabled={disabled}
                      aria-invalid={!!rowErr?.quantity || undefined}
                      {...register(`items.${i}.quantity`, { valueAsNumber: true })}
                    />
                    <FieldError errors={[rowErr?.quantity]} className="text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${idPrefix}-${i}-price`} className="text-muted-foreground text-xs sm:sr-only">
                      Line {i + 1} unit price (₹)
                    </Label>
                    <Input
                      id={`${idPrefix}-${i}-price`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      className="text-right tabular-nums"
                      disabled={disabled}
                      aria-invalid={!!rowErr?.unitPrice || undefined}
                      {...register(`items.${i}.unitPrice`, { valueAsNumber: true })}
                    />
                    <FieldError errors={[rowErr?.unitPrice]} className="text-xs" />
                  </div>
                  <div className="col-span-2 flex items-center justify-between gap-2 sm:contents">
                    <RowAmount control={control} index={i} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(i)}
                      disabled={disabled || fields.length === 1}
                      aria-label={`Remove line ${i + 1}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {arrayError && <FieldError>{arrayError}</FieldError>}

      <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-start">
        <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLineItem())} disabled={disabled} className="shrink-0">
          <Plus /> Add line
        </Button>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick add common charges">
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Zap className="size-3" aria-hidden /> Quick add
          </span>
          {LINE_ITEM_PRESETS.map((p) => (
            <Button
              key={p.description}
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => addPreset(p)}
              disabled={disabled}
              aria-label={`Add ${p.description}, ${formatCurrency(p.unitPrice)}`}
            >
              {p.label} <span className="text-muted-foreground tabular-nums">{formatCurrency(p.unitPrice)}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RowAmount({ control, index }: { control: Control<InvoiceFieldsValues>; index: number }) {
  const item = useWatch({ control, name: `items.${index}` });
  return (
    <p className="text-sm font-medium tabular-nums sm:flex sm:h-8 sm:items-center sm:justify-end">
      <span className="text-muted-foreground text-xs font-normal sm:sr-only">Amount </span>
      {formatCurrency(lineAmount(item))}
    </p>
  );
}

/** Live subtotal / discount / total for the surrounding invoice form. */
export function InvoiceTotals({ taxRate = 0, className }: { taxRate?: number; className?: string }) {
  const { control } = useFormContext<InvoiceFieldsValues>();
  const items = useWatch({ control, name: "items" });
  const discount = useWatch({ control, name: "discount" });
  const t = computeTotals(items, discount, taxRate);
  return (
    <dl className={cn("space-y-1.5 text-sm", className)} aria-live="polite">
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">
          Subtotal{" "}
          <span className="text-xs">
            ({items?.length ?? 0} {items?.length === 1 ? "item" : "items"})
          </span>
        </dt>
        <dd className="tabular-nums">{formatCurrency(t.subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Discount</dt>
        <dd className="tabular-nums">{t.discount > 0 ? `−${formatCurrency(t.discount)}` : formatCurrency(0)}</dd>
      </div>
      {taxRate > 0 && (
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Tax ({(taxRate * 100).toFixed(0)}%)</dt>
          <dd className="tabular-nums">{formatCurrency(t.tax)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatCurrency(t.total)}</dd>
      </div>
    </dl>
  );
}
