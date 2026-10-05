"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PackagePlus } from "lucide-react";
import { useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";
import { applyServerErrors } from "@/lib/validation";
import { useAddBatch } from "@/services/pharmacy";
import type { Medicine } from "@/types";
import { todayISO } from "./pharmacy-utils";

const money = (label: string) =>
  z
    .number({ invalid_type_error: `Enter the ${label}` })
    .positive(`${label[0].toUpperCase()}${label.slice(1)} must be greater than 0`)
    .max(1_000_000, "That's unusually high");

const schema = z
  .object({
    batchNumber: z
      .string()
      .trim()
      .min(1, "Batch number is required")
      .max(40, "Keep it under 40 characters")
      .regex(/^[A-Za-z0-9\-/]+$/, "Use letters, numbers, - or / only"),
    mfgDate: z
      .string()
      .min(1, "Manufacturing date is required")
      .refine((v) => v <= todayISO(), "Can't be in the future"),
    expiryDate: z
      .string()
      .min(1, "Expiry date is required")
      .refine((v) => v > todayISO(), "Must be after today — don't receive expired stock"),
    quantity: z
      .number({ invalid_type_error: "Enter the quantity" })
      .int("Use a whole number")
      .min(1, "Must be at least 1")
      .max(1_000_000, "That's unusually high"),
    unitCost: money("unit cost"),
    mrp: money("MRP"),
  })
  .superRefine((v, ctx) => {
    if (v.mfgDate && v.expiryDate && v.expiryDate <= v.mfgDate)
      ctx.addIssue({ code: "custom", path: ["expiryDate"], message: "Must be after the manufacturing date" });
    if (Number.isFinite(v.mrp) && Number.isFinite(v.unitCost) && v.mrp < v.unitCost)
      ctx.addIssue({ code: "custom", path: ["mrp"], message: "MRP can't be lower than the unit cost" });
  });
type FormValues = z.infer<typeof schema>;

export function ReceiveStockDialog({ medicine }: { medicine: Medicine }) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const add = useAddBatch(medicine.id);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      batchNumber: "",
      mfgDate: "",
      expiryDate: "",
      quantity: undefined,
      unitCost: undefined,
      mrp: medicine.unitPrice || undefined,
    },
  });
  const { register, handleSubmit, reset, setError, formState, control } = form;
  const errors = formState.errors;
  const [qty, unitCost, mrp] = useWatch({ control, name: ["quantity", "unitCost", "mrp"] });
  const today = todayISO();

  const onOpenChange = (v: boolean) => {
    if (add.isPending) return;
    setOpen(v);
    if (!v) reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await add.mutateAsync({ ...values, batchNumber: values.batchNumber.trim().toUpperCase() });
      toast.success(`Received ${values.quantity} × ${medicine.name}`, { description: `Batch ${values.batchNumber.toUpperCase()}` });
      setOpen(false);
      reset();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "DUPLICATE_BATCH")
          setError("batchNumber", { type: "server", message: "This batch number already exists for this medicine." });
        else applyServerErrors<FormValues>(err.details, setError);
      }
    }
  });

  const id = (k: string) => `${uid}-${k}`;
  const field = (name: keyof FormValues) => ({ "aria-invalid": !!errors[name] || undefined });
  const margin = Number.isFinite(unitCost) && Number.isFinite(mrp) && unitCost > 0 ? ((mrp - unitCost) / unitCost) * 100 : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PackagePlus /> Receive stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive stock</DialogTitle>
          <DialogDescription>
            {medicine.name} {medicine.strength} · {medicine.genericName}
          </DialogDescription>
        </DialogHeader>
        <form id={id("form")} onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.batchNumber || undefined}>
              <FieldLabel htmlFor={id("batch")}>Batch number</FieldLabel>
              <Input
                id={id("batch")}
                className="font-mono uppercase"
                autoComplete="off"
                {...field("batchNumber")}
                {...register("batchNumber")}
              />
              <FieldError errors={[errors.batchNumber]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.mfgDate || undefined}>
                <FieldLabel htmlFor={id("mfg")}>Manufacturing date</FieldLabel>
                <Input id={id("mfg")} type="date" max={today} {...field("mfgDate")} {...register("mfgDate")} />
                <FieldError errors={[errors.mfgDate]} />
              </Field>
              <Field data-invalid={!!errors.expiryDate || undefined}>
                <FieldLabel htmlFor={id("exp")}>Expiry date</FieldLabel>
                <Input id={id("exp")} type="date" min={today} {...field("expiryDate")} {...register("expiryDate")} />
                <FieldError errors={[errors.expiryDate]} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={!!errors.quantity || undefined}>
                <FieldLabel htmlFor={id("qty")}>Quantity (units)</FieldLabel>
                <Input
                  id={id("qty")}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  className="tabular-nums"
                  {...field("quantity")}
                  {...register("quantity", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.quantity]} />
              </Field>
              <Field data-invalid={!!errors.unitCost || undefined}>
                <FieldLabel htmlFor={id("cost")}>Unit cost (₹)</FieldLabel>
                <Input
                  id={id("cost")}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="tabular-nums"
                  {...field("unitCost")}
                  {...register("unitCost", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.unitCost]} />
              </Field>
              <Field data-invalid={!!errors.mrp || undefined}>
                <FieldLabel htmlFor={id("mrp")}>MRP (₹)</FieldLabel>
                <Input
                  id={id("mrp")}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="tabular-nums"
                  {...field("mrp")}
                  {...register("mrp", { valueAsNumber: true })}
                />
                <FieldError errors={[errors.mrp]} />
              </Field>
            </div>
            <FieldDescription className="text-xs tabular-nums" aria-live="polite">
              {Number.isFinite(qty) && Number.isFinite(unitCost) && qty > 0 && unitCost > 0
                ? `Batch value ${formatCurrency(qty * unitCost)}${margin != null && margin >= 0 ? ` · margin ${margin.toFixed(1)}%` : ""}`
                : "Batches are dispensed first-expiry-first-out (FIFO)."}
            </FieldDescription>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={add.isPending}>
            Cancel
          </Button>
          <Button type="submit" form={id("form")} disabled={add.isPending}>
            {add.isPending && <Loader2 className="animate-spin" />}
            Receive stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
