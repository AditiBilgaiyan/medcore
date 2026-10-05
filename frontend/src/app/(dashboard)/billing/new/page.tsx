"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AccessDenied } from "@/components/shared/guards";
import { PageHeader } from "@/components/shared/page-header";
import { PatientPicker } from "@/components/shared/patient-picker";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  InvoiceTotals,
  LineItemsEditor,
  emptyLineItem,
  invoiceFieldsSchema,
  refineDiscount,
  toRequestItems,
} from "@/components/modules/billing/line-items-editor";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";
import { formatDate, formatTime } from "@/lib/format";
import { applyServerErrors } from "@/lib/validation";
import { useAppointments } from "@/services/appointments";
import { useCreateInvoice } from "@/services/billing";
import { usePatient } from "@/services/patients";

const NO_APPOINTMENT = "none";

const schema = invoiceFieldsSchema
  .extend({
    patientId: z.string().min(1, "Choose the patient to bill"),
    appointmentId: z.string().optional(),
  })
  .superRefine(refineDiscount);

type Values = z.infer<typeof schema>;

function NewInvoiceForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useAuth();
  const create = useCreateInvoice();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: params.get("patientId") ?? "",
      appointmentId: params.get("appointmentId") ?? NO_APPOINTMENT,
      items: [emptyLineItem()],
      discount: 0,
      notes: "",
    },
  });
  const { control, register, handleSubmit, setValue, setError, formState } = form;
  const patientId = useWatch({ control, name: "patientId" });
  const appointmentId = useWatch({ control, name: "appointmentId" });

  const { data: patient } = usePatient(patientId || undefined);
  const canSeeAppointments = can("appointments:read");
  const appointments = useAppointments(
    { patientId, status: ["COMPLETED"], sortOrder: "desc", limit: 10 },
    { enabled: !!patientId && canSeeAppointments },
  );
  const selectedAppt = appointments.data?.data.find((a) => a.id === appointmentId);

  const onSubmit = handleSubmit(async (v) => {
    try {
      const inv = await create.mutateAsync({
        patientId: v.patientId,
        appointmentId: v.appointmentId && v.appointmentId !== NO_APPOINTMENT ? v.appointmentId : undefined,
        items: toRequestItems(v.items),
        discount: v.discount || 0,
        notes: v.notes?.trim() || undefined,
      });
      toast.success(`Draft ${inv.number} created`);
      router.push(ROUTES.invoice(inv.id));
    } catch (err) {
      if (err instanceof ApiError) applyServerErrors<Values>(err.details, setError);
    }
  });

  if (!can("billing:write")) return <AccessDenied home={ROUTES.billing} />;

  const pending = create.isPending || formState.isSubmitting;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <PageHeader
          title="New invoice"
          description="Creates a draft. Review it, then finalise to share it with the patient."
          breadcrumbs={[{ label: "Billing", href: ROUTES.billing }, { label: "New invoice" }]}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="min-w-0 space-y-4">
            <SectionCard title="Bill to">
              <FieldGroup className="gap-4 md:grid md:grid-cols-2">
                <Field data-invalid={!!formState.errors.patientId || undefined}>
                  <FieldLabel htmlFor="inv-patient">Patient</FieldLabel>
                  <Controller
                    control={control}
                    name="patientId"
                    render={({ field }) => (
                      <PatientPicker
                        id="inv-patient"
                        value={field.value || undefined}
                        invalid={!!formState.errors.patientId}
                        disabled={pending}
                        onChange={(p) => {
                          field.onChange(p?.id ?? "");
                          setValue("appointmentId", NO_APPOINTMENT);
                        }}
                      />
                    )}
                  />
                  {patient?.insurance ? (
                    <FieldDescription className="flex items-center gap-1">
                      <ShieldCheck className="size-3.5" aria-hidden /> Insured with {patient.insurance.provider} (valid till{" "}
                      {formatDate(patient.insurance.validTill)})
                    </FieldDescription>
                  ) : patient ? (
                    <FieldDescription>No insurance on file.</FieldDescription>
                  ) : null}
                  <FieldError errors={[formState.errors.patientId]} />
                </Field>

                {canSeeAppointments && (
                  <Field>
                    <FieldLabel htmlFor="inv-appt">Link to visit (optional)</FieldLabel>
                    <Controller
                      control={control}
                      name="appointmentId"
                      render={({ field }) => (
                        <Select value={field.value ?? NO_APPOINTMENT} onValueChange={field.onChange} disabled={!patientId || pending}>
                          <SelectTrigger id="inv-appt" className="h-9 w-full">
                            <SelectValue placeholder={patientId ? "Choose a completed visit" : "Choose a patient first"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_APPOINTMENT}>Not linked to a visit</SelectItem>
                            {appointments.data?.data.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {formatDate(a.date)}, {formatTime(a.startTime)} · {a.doctorName} · {a.departmentName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldDescription>
                      {!patientId
                        ? "Recent completed visits appear once a patient is chosen."
                        : appointments.isLoading
                          ? "Loading recent visits…"
                          : appointments.data?.data.length
                            ? "Only completed visits are listed."
                            : "No completed visits for this patient."}
                    </FieldDescription>
                    {selectedAppt?.invoiceId && (
                      <FieldDescription>
                        This visit already has an invoice.{" "}
                        <Link
                          href={ROUTES.invoice(selectedAppt.invoiceId)}
                          className="text-primary inline-flex items-center gap-0.5 font-medium underline-offset-4 hover:underline"
                        >
                          View it <ExternalLink className="size-3" aria-hidden />
                        </Link>
                      </FieldDescription>
                    )}
                  </Field>
                )}
              </FieldGroup>
            </SectionCard>

            <SectionCard title="Line items" description="Amounts are calculated as quantity × unit price.">
              <LineItemsEditor disabled={pending} />
            </SectionCard>

            <SectionCard title="Notes">
              <Field data-invalid={!!formState.errors.notes || undefined}>
                <FieldLabel htmlFor="inv-notes" className="sr-only">
                  Notes
                </FieldLabel>
                <Textarea
                  id="inv-notes"
                  rows={3}
                  placeholder="Optional — printed on the invoice"
                  disabled={pending}
                  {...register("notes")}
                />
                <FieldError errors={[formState.errors.notes]} />
              </Field>
            </SectionCard>
          </div>

          <SectionCard title="Summary" className="lg:sticky lg:top-20" contentClassName="space-y-4">
            <Field data-invalid={!!formState.errors.discount || undefined}>
              <FieldLabel htmlFor="inv-discount">Discount (₹)</FieldLabel>
              <Input
                id="inv-discount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className="text-right tabular-nums"
                disabled={pending}
                aria-invalid={!!formState.errors.discount || undefined}
                {...register("discount", { valueAsNumber: true })}
              />
              <FieldError errors={[formState.errors.discount]} />
            </Field>
            <InvoiceTotals />
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Create draft invoice
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push(ROUTES.billing)} disabled={pending}>
                Cancel
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Healthcare services are GST-exempt. The total always equals the sum of line items less discount.
            </p>
          </SectionCard>
        </div>
      </form>
    </FormProvider>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense>
      <NewInvoiceForm />
    </Suspense>
  );
}
