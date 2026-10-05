"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Minus, Plus, Syringe } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { VitalsPanel } from "@/components/shared/clinical";
import { KeyValueGrid, SectionCard } from "@/components/shared/section-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { ageFromDob, formatDate, humanize } from "@/lib/format";
import { toPlainText } from "@/lib/sanitize";
import { pastDateSchema, requiredString } from "@/lib/validation";
import { usePatientRecords } from "@/services/emr";
import { useAddVaccination, useVaccinations } from "@/services/patients";
import type { Patient } from "@/types";

const FH_LABELS = { diabetes: "Diabetes", hypertension: "Hypertension", cancer: "Cancer", cardiac: "Cardiac disease" } as const;

export function PatientOverview({ patient }: { patient: Patient }) {
  const { can } = useAuth();
  const a = patient.address;
  const ec = patient.emergencyContact;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <SectionCard title="Demographics">
          <KeyValueGrid
            columns={3}
            items={[
              { label: "Date of birth", value: `${formatDate(patient.dob)} (${ageFromDob(patient.dob) ?? "—"} y)` },
              { label: "Gender", value: humanize(patient.gender) },
              { label: "Blood group", value: patient.bloodGroup ?? "Unknown" },
              { label: "Phone", value: <span className="tabular-nums">{patient.phone}</span> },
              { label: "Email", value: patient.email || "—" },
              { label: "Registered", value: formatDate(patient.createdAt) },
              {
                label: "Address",
                value: a?.line1 ? [a.line1, a.line2, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(", ") : "—",
              },
              {
                label: "Emergency contact",
                value: ec?.name ? `${ec.name}${ec.relation ? ` (${ec.relation})` : ""} · ${ec.phone}` : "—",
              },
              {
                label: "Insurance",
                value: patient.insurance
                  ? `${patient.insurance.provider} · ${patient.insurance.policyNumber} · till ${formatDate(patient.insurance.validTill)}`
                  : "Self-pay",
              },
            ]}
          />
        </SectionCard>

        {can("emr:read") && <LatestVitals patientId={patient.id} />}

        <Vaccinations patientId={patient.id} />
      </div>

      <div className="space-y-4">
        <SectionCard title="Chronic conditions">
          {patient.chronicConditions.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {patient.chronicConditions.map((c) => (
                <li key={c} className="bg-secondary text-secondary-foreground rounded-md px-2 py-0.5 text-xs font-medium">
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">None recorded.</p>
          )}
        </SectionCard>
        <SectionCard title="Current medications">
          {patient.currentMedications.length ? (
            <ul className="space-y-1 text-sm">
              {patient.currentMedications.map((m) => (
                <li key={m} className="border-b pb-1 last:border-0 last:pb-0">
                  {m}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">None recorded.</p>
          )}
        </SectionCard>
        <SectionCard title="Family history">
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {(Object.keys(FH_LABELS) as (keyof typeof FH_LABELS)[]).map((k) => {
              const yes = patient.familyHistory?.[k];
              return (
                <li key={k} className="flex items-center gap-1.5">
                  {yes ? (
                    <Check className="text-primary size-4" aria-hidden />
                  ) : (
                    <Minus className="text-muted-foreground size-4" aria-hidden />
                  )}
                  <span className={yes ? "font-medium" : "text-muted-foreground"}>{FH_LABELS[k]}</span>
                  <span className="sr-only">: {yes ? "yes" : "no"}</span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

function LatestVitals({ patientId }: { patientId: string }) {
  const { data, isLoading, error, refetch } = usePatientRecords(patientId, { limit: 10 });
  const record = data?.data.find((r) => r.vitals.length > 0);
  return (
    <SectionCard title="Latest vitals" description={record ? `${record.departmentName} visit with ${record.doctorName}` : undefined}>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} className="py-6" />
      ) : (
        <VitalsPanel vitals={record?.vitals[0]} />
      )}
    </SectionCard>
  );
}

const vaccinationSchema = z
  .object({
    vaccine: requiredString("Vaccine").max(120),
    date: pastDateSchema("Date given"),
    batchNumber: requiredString("Batch number").max(40),
    nextDueDate: z.string(),
  })
  .refine((v) => !v.nextDueDate || v.nextDueDate > v.date, { path: ["nextDueDate"], message: "Next dose must be after the date given" });

function Vaccinations({ patientId }: { patientId: string }) {
  const { role } = useAuth();
  const { data, isLoading, error, refetch } = useVaccinations(patientId);
  const canAdd = role === "DOCTOR" || role === "NURSE";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <SectionCard title="Vaccinations" action={canAdd ? <AddVaccinationDialog patientId={patientId} /> : undefined} contentClassName="p-0">
      {isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} className="py-6" />
      ) : !data?.length ? (
        <EmptyState compact icon={Syringe} title="No vaccinations recorded" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Vaccination history</caption>
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-semibold">
                  Vaccine
                </th>
                <th scope="col" className="px-4 py-2 text-left font-semibold">
                  Given
                </th>
                <th scope="col" className="px-4 py-2 text-left font-semibold">
                  Batch
                </th>
                <th scope="col" className="px-4 py-2 text-left font-semibold">
                  Next due
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((v) => {
                const overdue = v.nextDueDate && v.nextDueDate < today;
                return (
                  <tr key={v.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{v.vaccine}</td>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums">{formatDate(v.date)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{v.batchNumber}</td>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                      {v.nextDueDate ? (
                        <span className={overdue ? "text-destructive font-medium" : undefined}>
                          {formatDate(v.nextDueDate)}
                          {overdue && " (overdue)"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function AddVaccinationDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const add = useAddVaccination(patientId);
  const form = useForm<z.infer<typeof vaccinationSchema>>({
    resolver: zodResolver(vaccinationSchema),
    defaultValues: { vaccine: "", date: new Date().toISOString().slice(0, 10), batchNumber: "", nextDueDate: "" },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (v) => {
    try {
      await add.mutateAsync({
        vaccine: toPlainText(v.vaccine).trim(),
        date: v.date,
        batchNumber: v.batchNumber.trim(),
        nextDueDate: v.nextDueDate || undefined,
      });
      toast.success(`${v.vaccine} recorded`);
      form.reset();
      setOpen(false);
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
        <Button variant="outline" size="sm">
          <Plus /> Add vaccination
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add vaccination</DialogTitle>
          <DialogDescription>Record a dose given to this patient.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate id="vaccination-form">
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.vaccine}>
              <FieldLabel htmlFor="vac-name">Vaccine</FieldLabel>
              <Input id="vac-name" placeholder="e.g. Tdap booster" aria-invalid={!!errors.vaccine} {...form.register("vaccine")} />
              <FieldError errors={[errors.vaccine]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.date}>
                <FieldLabel htmlFor="vac-date">Date given</FieldLabel>
                <Input
                  id="vac-date"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  aria-invalid={!!errors.date}
                  {...form.register("date")}
                />
                <FieldError errors={[errors.date]} />
              </Field>
              <Field data-invalid={!!errors.batchNumber}>
                <FieldLabel htmlFor="vac-batch">Batch number</FieldLabel>
                <Input id="vac-batch" aria-invalid={!!errors.batchNumber} {...form.register("batchNumber")} />
                <FieldError errors={[errors.batchNumber]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.nextDueDate}>
              <FieldLabel htmlFor="vac-next">Next dose due (optional)</FieldLabel>
              <Input id="vac-next" type="date" aria-invalid={!!errors.nextDueDate} {...form.register("nextDueDate")} />
              <FieldError errors={[errors.nextDueDate]} />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={add.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="vaccination-form" disabled={add.isPending}>
            {add.isPending && <Loader2 className="animate-spin" />}
            Save vaccination
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
