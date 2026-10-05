"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { humanize } from "@/lib/format";
import { applyServerErrors, requiredString } from "@/lib/validation";
import { useCreateMedicine, useUpdateMedicine } from "@/services/pharmacy";
import { MEDICINE_FORMS, type Medicine, type UpsertMedicineRequest } from "@/types";

const schema = z.object({
  name: requiredString("Brand name").pipe(z.string().max(120, "Keep it under 120 characters")),
  genericName: requiredString("Generic name").pipe(z.string().max(120, "Keep it under 120 characters")),
  form: z.enum(MEDICINE_FORMS, { errorMap: () => ({ message: "Choose a form" }) }),
  strength: requiredString("Strength").pipe(z.string().max(40, "Keep it under 40 characters")),
  manufacturer: requiredString("Manufacturer"),
  category: requiredString("Category"),
  reorderLevel: z
    .number({ invalid_type_error: "Enter a number" })
    .int("Use a whole number")
    .min(0, "Can't be negative")
    .max(100000, "That's unusually high"),
  requiresPrescription: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: "",
  genericName: "",
  form: "TABLET",
  strength: "",
  manufacturer: "",
  category: "",
  reorderLevel: 50,
  requiresPrescription: true,
};

interface MedicineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode when provided. */
  medicine?: Medicine;
  categories?: string[];
  onSaved?: (m: Medicine) => void;
}

export function MedicineFormDialog({ open, onOpenChange, medicine, categories = [], onSaved }: MedicineFormDialogProps) {
  const uid = useId();
  const create = useCreateMedicine();
  const update = useUpdateMedicine();
  const pending = create.isPending || update.isPending;

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { register, control, handleSubmit, reset, setError, formState } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (open) {
      reset(
        medicine
          ? {
              name: medicine.name,
              genericName: medicine.genericName,
              form: medicine.form,
              strength: medicine.strength,
              manufacturer: medicine.manufacturer,
              category: medicine.category,
              reorderLevel: medicine.reorderLevel,
              requiresPrescription: medicine.requiresPrescription,
            }
          : EMPTY,
      );
    }
  }, [open, medicine, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const body: UpsertMedicineRequest = { ...values };
    try {
      const saved = medicine ? await update.mutateAsync({ id: medicine.id, ...body }) : await create.mutateAsync(body);
      toast.success(medicine ? "Medicine updated" : `${saved.name} ${saved.strength} added to the formulary`);
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "DUPLICATE_MEDICINE") {
          setError("name", { type: "server", message: "A medicine with this name and strength is already in the formulary." });
          setError("strength", { type: "server", message: "Change the strength or edit the existing medicine." });
        } else applyServerErrors<FormValues>(err.details, setError);
      }
    }
  });

  const id = (k: string) => `${uid}-${k}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{medicine ? `Edit ${medicine.name}` : "Add medicine"}</DialogTitle>
          <DialogDescription>
            {medicine
              ? "Changes apply to all batches of this medicine."
              : "Add a new item to the hospital formulary. Receive stock against it afterwards."}
          </DialogDescription>
        </DialogHeader>
        <form id={id("form")} onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.name || undefined}>
                <FieldLabel htmlFor={id("name")}>Brand name</FieldLabel>
                <Input id={id("name")} aria-invalid={!!errors.name || undefined} autoComplete="off" {...register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={!!errors.genericName || undefined}>
                <FieldLabel htmlFor={id("generic")}>Generic name</FieldLabel>
                <Input
                  id={id("generic")}
                  aria-invalid={!!errors.genericName || undefined}
                  autoComplete="off"
                  {...register("genericName")}
                />
                <FieldError errors={[errors.genericName]} />
              </Field>
              <Field data-invalid={!!errors.form || undefined}>
                <FieldLabel htmlFor={id("form-select")}>Form</FieldLabel>
                <Controller
                  control={control}
                  name="form"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={id("form-select")} className="w-full" aria-invalid={!!errors.form || undefined}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEDICINE_FORMS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {humanize(f)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.form]} />
              </Field>
              <Field data-invalid={!!errors.strength || undefined}>
                <FieldLabel htmlFor={id("strength")}>Strength</FieldLabel>
                <Input
                  id={id("strength")}
                  placeholder="e.g. 500 mg"
                  aria-invalid={!!errors.strength || undefined}
                  autoComplete="off"
                  {...register("strength")}
                />
                <FieldError errors={[errors.strength]} />
              </Field>
              <Field data-invalid={!!errors.manufacturer || undefined}>
                <FieldLabel htmlFor={id("mfr")}>Manufacturer</FieldLabel>
                <Input id={id("mfr")} aria-invalid={!!errors.manufacturer || undefined} {...register("manufacturer")} />
                <FieldError errors={[errors.manufacturer]} />
              </Field>
              <Field data-invalid={!!errors.category || undefined}>
                <FieldLabel htmlFor={id("category")}>Category</FieldLabel>
                <Input
                  id={id("category")}
                  list={id("categories")}
                  placeholder="e.g. Antibiotic"
                  aria-invalid={!!errors.category || undefined}
                  autoComplete="off"
                  {...register("category")}
                />
                <datalist id={id("categories")}>
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <FieldError errors={[errors.category]} />
              </Field>
              <Field data-invalid={!!errors.reorderLevel || undefined}>
                <FieldLabel htmlFor={id("reorder")}>Reorder level (units)</FieldLabel>
                <Input
                  id={id("reorder")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  className="tabular-nums"
                  aria-invalid={!!errors.reorderLevel || undefined}
                  {...register("reorderLevel", { valueAsNumber: true })}
                />
                <FieldDescription className="text-xs">Low-stock alerts fire at or below this quantity.</FieldDescription>
                <FieldError errors={[errors.reorderLevel]} />
              </Field>
              <Field orientation="horizontal" className="self-start sm:pt-6">
                <Controller
                  control={control}
                  name="requiresPrescription"
                  render={({ field }) => (
                    <Checkbox id={id("rx")} checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  )}
                />
                <FieldLabel htmlFor={id("rx")} className="font-normal">
                  Requires prescription (Rx)
                </FieldLabel>
              </Field>
            </div>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={id("form")} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {medicine ? "Save changes" : "Add medicine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
