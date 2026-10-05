"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Syringe } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AllergyBadges } from "@/components/shared/clinical";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toPlainText } from "@/lib/sanitize";
import { requiredString } from "@/lib/validation";
import { useAdministerMedication } from "@/services/misc";
import type { Allergy } from "@/types";

export const MED_ROUTES = ["Oral", "IV", "IM", "SC", "Topical", "Inhaled"] as const;

const schema = z.object({
  medicine: requiredString("Medicine").max(120),
  dose: requiredString("Dose").max(60),
  route: z.enum(MED_ROUTES, { required_error: "Select a route", invalid_type_error: "Select a route" }),
  notes: z.string().max(500),
});
type Values = z.infer<typeof schema>;

export function AdministerMedicationDialog({
  admissionId,
  patientName,
  allergies,
}: {
  admissionId: string;
  patientName: string;
  allergies?: Allergy[];
}) {
  const [open, setOpen] = useState(false);
  const administer = useAdministerMedication(admissionId);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { medicine: "", dose: "", route: "Oral", notes: "" } });
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (v) => {
    try {
      await administer.mutateAsync({
        medicine: toPlainText(v.medicine).trim(),
        dose: toPlainText(v.dose).trim(),
        route: v.route,
        notes: toPlainText(v.notes).trim() || undefined,
      });
      toast.success(`${v.medicine} ${v.dose} recorded`);
      setOpen(false);
      form.reset();
    } catch {
      // toast from the mutation cache
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Syringe /> Administer medication
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Administer medication</DialogTitle>
          <DialogDescription>Record a dose given to {patientName}. Time and your name are added automatically.</DialogDescription>
        </DialogHeader>
        {allergies && (
          <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
            <span className="text-muted-foreground text-xs font-semibold uppercase">Allergies</span>
            <AllergyBadges allergies={allergies} />
          </div>
        )}
        <form id="mar-form" onSubmit={submit} noValidate>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.medicine}>
              <FieldLabel htmlFor="mar-medicine">Medicine</FieldLabel>
              <Input id="mar-medicine" placeholder="e.g. Paracetamol" aria-invalid={!!errors.medicine} {...form.register("medicine")} />
              <FieldError errors={[errors.medicine]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.dose}>
                <FieldLabel htmlFor="mar-dose">Dose</FieldLabel>
                <Input id="mar-dose" placeholder="e.g. 1 g" aria-invalid={!!errors.dose} {...form.register("dose")} />
                <FieldError errors={[errors.dose]} />
              </Field>
              <Field data-invalid={!!errors.route}>
                <FieldLabel htmlFor="mar-route">Route</FieldLabel>
                <Controller
                  control={form.control}
                  name="route"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="mar-route" className="w-full" aria-invalid={!!errors.route}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MED_ROUTES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.route]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.notes}>
              <FieldLabel htmlFor="mar-notes">Notes (optional)</FieldLabel>
              <Textarea id="mar-notes" rows={2} placeholder="e.g. Given for fever 38.6 °C" {...form.register("notes")} />
              <FieldError errors={[errors.notes]} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={administer.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="mar-form" disabled={administer.isPending}>
            {administer.isPending && <Loader2 className="animate-spin" />}
            Record dose
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
