"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BedDouble, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PatientPicker } from "@/components/shared/patient-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/constants/routes";
import { ApiError } from "@/lib/api/client";
import { toPlainText } from "@/lib/sanitize";
import { requiredString } from "@/lib/validation";
import { useDoctors } from "@/services/doctors";
import { useAdmissions, useAdmitPatient } from "@/services/misc";
import type { WardWithOccupancy } from "@/types";

const schema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  wardId: z.string().min(1, "Select a ward"),
  bedNumber: requiredString("Bed number")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and dashes only"),
  attendingDoctorId: z.string().min(1, "Select the attending doctor"),
  diagnosis: requiredString("Admitting diagnosis").max(300),
});
type Values = z.infer<typeof schema>;

const bedPrefix = (wardName: string) =>
  wardName
    .split(" ")
    .map((w) => w[0])
    .join("");

export function AdmitPatientDialog({ wards, defaultWardId }: { wards: WardWithOccupancy[]; defaultWardId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const admit = useAdmitPatient();
  const doctors = useDoctors({}, { enabled: open });
  const initialWard = wards.find((w) => w.id === defaultWardId && w.occupiedBeds < w.totalBeds)?.id ?? "";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { patientId: "", wardId: initialWard, bedNumber: "", attendingDoctorId: "", diagnosis: "" },
  });
  const errors = form.formState.errors;
  const wardId = form.watch("wardId");
  const ward = wards.find((w) => w.id === wardId);
  const occupancy = useAdmissions({ wardId: wardId || undefined, limit: 100 }, { enabled: open && !!wardId });

  const freeBeds = useMemo(() => {
    if (!ward || !occupancy.data) return [];
    const taken = new Set(occupancy.data.data.map((a) => a.bedNumber.toUpperCase()));
    const prefix = bedPrefix(ward.name);
    const out: string[] = [];
    for (let i = 1; i <= ward.totalBeds && out.length < 6; i++) {
      const bed = `${prefix}-${String(i).padStart(2, "0")}`;
      if (!taken.has(bed.toUpperCase())) out.push(bed);
    }
    return out;
  }, [ward, occupancy.data]);

  const submit = form.handleSubmit(async (v) => {
    try {
      const adm = await admit.mutateAsync({
        ...v,
        bedNumber: v.bedNumber.trim().toUpperCase(),
        diagnosis: toPlainText(v.diagnosis).trim(),
      });
      toast.success(`${adm.patientName} admitted`, { description: `${adm.wardName} · bed ${adm.bedNumber}` });
      setOpen(false);
      form.reset();
      router.push(ROUTES.admission(adm.id));
    } catch (err) {
      if (!(err instanceof ApiError)) return;
      if (err.code === "BED_OCCUPIED") form.setError("bedNumber", { type: "server", message: err.message });
      else if (err.code === "WARD_FULL") form.setError("wardId", { type: "server", message: err.message });
      else if (err.code === "ALREADY_ADMITTED") form.setError("patientId", { type: "server", message: err.message });
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) form.reset({ patientId: "", wardId: initialWard, bedNumber: "", attendingDoctorId: "", diagnosis: "" });
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <BedDouble /> Admit patient
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Admit patient</DialogTitle>
          <DialogDescription>Assign a bed and attending doctor. Only wards with free beds are selectable.</DialogDescription>
        </DialogHeader>
        <form id="admit-form" onSubmit={submit} noValidate>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.patientId}>
              <FieldLabel htmlFor="admit-patient">Patient</FieldLabel>
              <Controller
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <PatientPicker
                    id="admit-patient"
                    value={field.value || undefined}
                    onChange={(p) => field.onChange(p?.id ?? "")}
                    invalid={!!errors.patientId}
                  />
                )}
              />
              <FieldError errors={[errors.patientId]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.wardId}>
                <FieldLabel htmlFor="admit-ward">Ward</FieldLabel>
                <Controller
                  control={form.control}
                  name="wardId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue("bedNumber", "");
                      }}
                    >
                      <SelectTrigger id="admit-ward" className="w-full" aria-invalid={!!errors.wardId}>
                        <SelectValue placeholder="Select ward" />
                      </SelectTrigger>
                      <SelectContent>
                        {wards.map((w) => {
                          const free = w.totalBeds - w.occupiedBeds;
                          return (
                            <SelectItem key={w.id} value={w.id} disabled={free <= 0}>
                              {w.name} · {free <= 0 ? "full" : `${free} free`}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.wardId]} />
              </Field>
              <Field data-invalid={!!errors.bedNumber}>
                <FieldLabel htmlFor="admit-bed">Bed number</FieldLabel>
                <Input
                  id="admit-bed"
                  placeholder="e.g. GWA-12"
                  autoComplete="off"
                  aria-invalid={!!errors.bedNumber}
                  {...form.register("bedNumber")}
                />
                <FieldError errors={[errors.bedNumber]} />
              </Field>
            </div>
            {freeBeds.length > 0 && (
              <div className="-mt-2 flex flex-wrap items-center gap-1" role="group" aria-label="Free beds">
                <span className="text-muted-foreground text-xs">Free:</span>
                {freeBeds.map((b) => (
                  <Button
                    key={b}
                    type="button"
                    size="xs"
                    variant="outline"
                    className="font-mono"
                    onClick={() => form.setValue("bedNumber", b, { shouldValidate: true })}
                  >
                    {b}
                  </Button>
                ))}
              </div>
            )}
            <Field data-invalid={!!errors.attendingDoctorId}>
              <FieldLabel htmlFor="admit-doctor">Attending doctor</FieldLabel>
              <Controller
                control={form.control}
                name="attendingDoctorId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="admit-doctor" className="w-full" aria-invalid={!!errors.attendingDoctorId}>
                      <SelectValue placeholder={doctors.isLoading ? "Loading doctors…" : "Select doctor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.data?.data.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          Dr. {d.firstName} {d.lastName} · {d.specialisation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.attendingDoctorId]} />
            </Field>
            <Field data-invalid={!!errors.diagnosis}>
              <FieldLabel htmlFor="admit-dx">Admitting diagnosis</FieldLabel>
              <Textarea id="admit-dx" rows={2} aria-invalid={!!errors.diagnosis} {...form.register("diagnosis")} />
              <FieldDescription>Shown on the ward board and handover.</FieldDescription>
              <FieldError errors={[errors.diagnosis]} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={admit.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="admit-form" disabled={admit.isPending}>
            {admit.isPending && <Loader2 className="animate-spin" />}
            Admit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
