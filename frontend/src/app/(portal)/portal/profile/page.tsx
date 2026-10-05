"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, Loader2, LogOut, Phone, ShieldCheck, Syringe, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { get, useForm, type FieldPath, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FadeIn, InfoNote } from "@/components/modules/portal/portal-ui";
import { countdownLabel, daysUntil } from "@/components/modules/portal/portal-utils";
import { AllergyBadges } from "@/components/shared/clinical";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { KeyValueGrid, SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, ErrorState } from "@/components/shared/states";
import { StatusBadge, type BadgeTone } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { ageFromDob, formatDate, fullName, humanize } from "@/lib/format";
import { applyServerErrors, emailSchema, passwordSchema, phoneSchema, requiredString } from "@/lib/validation";
import { useChangePassword, useLogoutAll } from "@/services/auth";
import { usePatient, useUpdatePatient, useVaccinations } from "@/services/patients";
import type { Patient, Vaccination } from "@/types";

/* ---------------- Contact form ---------------- */

const contactSchema = z.object({
  phone: phoneSchema,
  email: z.union([emailSchema, z.literal("")]),
  address: z.object({
    line1: requiredString("Address line 1"),
    line2: z.string().trim().optional(),
    city: requiredString("City"),
    state: requiredString("State"),
    postalCode: z
      .string()
      .trim()
      .min(1, "PIN code is required")
      .regex(/^[A-Za-z0-9\s-]{4,10}$/, "Enter a valid PIN code"),
    country: requiredString("Country"),
  }),
  emergencyContact: z.object({
    name: requiredString("Name"),
    relation: requiredString("Relationship"),
    phone: phoneSchema,
  }),
});
type ContactValues = z.infer<typeof contactSchema>;

function contactDefaults(p?: Patient): ContactValues {
  return {
    phone: p?.phone ?? "",
    email: p?.email ?? "",
    address: {
      line1: p?.address?.line1 ?? "",
      line2: p?.address?.line2 ?? "",
      city: p?.address?.city ?? "",
      state: p?.address?.state ?? "",
      postalCode: p?.address?.postalCode ?? "",
      country: p?.address?.country || "India",
    },
    emergencyContact: {
      name: p?.emergencyContact?.name ?? "",
      relation: p?.emergencyContact?.relation ?? "",
      phone: p?.emergencyContact?.phone ?? "",
    },
  };
}

function TextField<T extends Record<string, unknown>>({
  form,
  name,
  label,
  type = "text",
  autoComplete,
  inputMode,
  optional,
  className,
}: {
  form: UseFormReturn<T>;
  name: FieldPath<T>;
  label: string;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  optional?: boolean;
  className?: string;
}) {
  const error = get(form.formState.errors, name) as { message?: string } | undefined;
  const id = `f-${name.replace(/\./g, "-")}`;
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>
        {label}
        {optional && <span className="text-muted-foreground font-normal">(optional)</span>}
      </FieldLabel>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={!!error}
        className="h-10"
        {...form.register(name)}
      />
      <FieldError errors={[error]} />
    </Field>
  );
}

function ContactForm({ patient }: { patient: Patient }) {
  const update = useUpdatePatient();
  const form = useForm<ContactValues>({ resolver: zodResolver(contactSchema), defaultValues: contactDefaults(patient) });

  // Re-sync when fresh data arrives, unless the patient is mid-edit.
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(contactDefaults(patient));
  }, [patient, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        id: patient.id,
        phone: values.phone,
        email: values.email || undefined,
        address: { ...values.address, line2: values.address.line2 || undefined },
        emergencyContact: values.emergencyContact,
      });
      form.reset(values);
      toast.success("Contact details saved");
    } catch (err) {
      if (err instanceof ApiError) applyServerErrors<ContactValues>(err.details, (n, e) => form.setError(n as FieldPath<ContactValues>, e));
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup>
        <FieldSet>
          <FieldLegend>How we reach you</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="phone" label="Mobile number" type="tel" autoComplete="tel" inputMode="tel" />
            <TextField form={form} name="email" label="Email" type="email" autoComplete="email" optional />
          </div>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Home address</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="address.line1" label="Address line 1" autoComplete="address-line1" className="sm:col-span-2" />
            <TextField
              form={form}
              name="address.line2"
              label="Address line 2"
              autoComplete="address-line2"
              optional
              className="sm:col-span-2"
            />
            <TextField form={form} name="address.city" label="City" autoComplete="address-level2" />
            <TextField form={form} name="address.state" label="State" autoComplete="address-level1" />
            <TextField form={form} name="address.postalCode" label="PIN code" autoComplete="postal-code" inputMode="numeric" />
            <TextField form={form} name="address.country" label="Country" autoComplete="country-name" />
          </div>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Emergency contact</FieldLegend>
          <FieldDescription>Someone we can call if you&apos;re unwell and can&apos;t speak for yourself.</FieldDescription>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField form={form} name="emergencyContact.name" label="Full name" autoComplete="off" />
            <TextField form={form} name="emergencyContact.relation" label="Relationship" autoComplete="off" />
            <TextField form={form} name="emergencyContact.phone" label="Phone" type="tel" inputMode="tel" autoComplete="off" />
          </div>
        </FieldSet>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => form.reset(contactDefaults(patient))}
            disabled={!form.formState.isDirty || update.isPending}
          >
            Discard changes
          </Button>
          <Button type="submit" size="lg" disabled={!form.formState.isDirty || update.isPending}>
            {update.isPending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

/* ---------------- Vaccinations ---------------- */

function dueStatus(next?: string): { tone: BadgeTone; label: string } | null {
  if (!next) return null;
  const d = daysUntil(next);
  if (d < 0) return { tone: "danger", label: `Overdue since ${formatDate(next)}` };
  if (d <= 30) return { tone: "warning", label: `Due ${countdownLabel(next).toLowerCase()}` };
  return { tone: "info", label: `Next dose ${formatDate(next)}` };
}

function Vaccinations({ patientId }: { patientId: string }) {
  const vax = useVaccinations(patientId);
  const list: Vaccination[] = vax.data ?? [];
  // Only the latest dose of each vaccine carries a meaningful "next due" date.
  const latest = new Set<string>();
  const rows = list.map((v) => {
    const isLatest = !latest.has(v.vaccine);
    latest.add(v.vaccine);
    return { v, due: isLatest ? dueStatus(v.nextDueDate) : null };
  });
  const upcoming = rows.filter((r) => r.due && r.due.tone !== "info");

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Syringe className="text-muted-foreground size-4" aria-hidden /> Vaccinations
        </span>
      }
      description="Recorded by your care team."
    >
      {vax.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : vax.error ? (
        <ErrorState error={vax.error} onRetry={() => vax.refetch()} className="py-6" />
      ) : !list.length ? (
        <p className="text-muted-foreground text-base md:text-sm">
          No vaccinations recorded yet. Bring your vaccination card to your next visit so we can add them.
        </p>
      ) : (
        <div className="space-y-3">
          {upcoming.length > 0 && (
            <div
              role="status"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-base text-amber-900 md:text-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
            >
              {upcoming.length === 1
                ? `${upcoming[0].v.vaccine}: ${upcoming[0].due!.label.toLowerCase()}.`
                : `${upcoming.length} vaccine doses are due soon or overdue.`}{" "}
              Ask at your next visit or book an appointment.
            </div>
          )}
          <ul className="divide-y">
            {rows.map(({ v, due }) => (
              <li key={v.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-base font-medium md:text-sm">{v.vaccine}</p>
                  <p className="text-muted-foreground text-sm">
                    Given {formatDate(v.date)} · Batch <span className="font-mono">{v.batchNumber}</span>
                  </p>
                </div>
                {due ? <StatusBadge status={due.tone} tone={due.tone} label={due.label} /> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

/* ---------------- Security ---------------- */

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Re-enter your new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a password you haven't used here" });
type PasswordValues = z.infer<typeof passwordFormSchema>;

function PasswordInput({
  id,
  label,
  autoComplete,
  form,
  name,
  description,
}: {
  id: string;
  label: string;
  autoComplete: string;
  form: UseFormReturn<PasswordValues>;
  name: keyof PasswordValues;
  description?: string;
}) {
  const [show, setShow] = useState(false);
  const error = form.formState.errors[name];
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup className="h-10">
        <InputGroupInput
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          {...form.register(name)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {description && !error && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={[error]} />
    </Field>
  );
}

function ChangePasswordForm() {
  const change = useChangePassword();
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const submit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      form.reset();
      toast.success("Password changed", { description: "Use your new password next time you sign in." });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "INVALID_PASSWORD") form.setError("currentPassword", { type: "server", message: "That's not your current password." });
      else if (code === "WEAK_PASSWORD") form.setError("newPassword", { type: "server", message: errorMessage(err) });
      else form.setError("root", { type: "server", message: errorMessage(err) });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup className="gap-4">
        {form.formState.errors.root && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
          </Alert>
        )}
        <PasswordInput id="pw-current" name="currentPassword" label="Current password" autoComplete="current-password" form={form} />
        <PasswordInput
          id="pw-new"
          name="newPassword"
          label="New password"
          autoComplete="new-password"
          form={form}
          description="At least 8 characters, with upper and lower case letters, a number and a symbol."
        />
        <PasswordInput id="pw-confirm" name="confirmPassword" label="Confirm new password" autoComplete="new-password" form={form} />
        <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={change.isPending}>
          {change.isPending && <Loader2 className="animate-spin" />}
          Change password
        </Button>
      </FieldGroup>
    </form>
  );
}

function SignOutEverywhere() {
  const logoutAll = useLogoutAll();
  const qc = useQueryClient();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-base font-medium md:text-sm">Sign out of all devices</p>
        <p className="text-muted-foreground text-sm">
          Lost a phone or used a shared computer? This signs you out everywhere, including here.
        </p>
      </div>
      <ConfirmDialog
        trigger={
          <Button variant="outline" size="lg" className="shrink-0">
            <LogOut /> Sign out everywhere
          </Button>
        }
        title="Sign out of all devices?"
        description="You'll be signed out on every phone, tablet and computer, including this one. You can sign in again with your email and password."
        confirmLabel="Sign out everywhere"
        destructive
        onConfirm={async () => {
          await logoutAll.mutateAsync();
          qc.clear();
          router.replace(ROUTES.login);
        }}
      />
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function PortalProfilePage() {
  const { user } = useAuth();
  const patient = usePatient(user?.patientId);
  const p = patient.data;
  const header = (
    <PageHeader
      title="My profile"
      description="Your personal details, health information and account settings."
      breadcrumbs={[{ label: "Home", href: ROUTES.portal }, { label: "Profile" }]}
    />
  );

  if (patient.isLoading || !user?.patientId) return <DetailSkeleton />;
  if (patient.error || !p) {
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        <ErrorState error={patient.error} onRetry={() => patient.refetch()} />
      </div>
    );
  }

  const age = ageFromDob(p.dob);
  const insuranceExpired = p.insurance ? daysUntil(p.insurance.validTill) < 0 : false;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {header}

      <FadeIn className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <UserRound className="text-muted-foreground size-4" aria-hidden /> Personal details
            </span>
          }
          description="To correct these, please contact the hospital reception."
        >
          <KeyValueGrid
            items={[
              { label: "Full name", value: fullName(p) },
              { label: "Patient ID (MRN)", value: <span className="font-mono">{p.mrn}</span> },
              { label: "Date of birth", value: `${formatDate(p.dob)}${age != null ? ` (${age} years)` : ""}` },
              { label: "Gender", value: humanize(p.gender) },
              { label: "Blood group", value: p.bloodGroup ?? "Not recorded" },
              { label: "Account email", value: user.email },
            ]}
          />
        </SectionCard>

        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="text-muted-foreground size-4" aria-hidden /> Insurance
            </span>
          }
          description="Updated by the hospital billing desk."
        >
          {p.insurance ? (
            <div className="space-y-3">
              <KeyValueGrid
                items={[
                  { label: "Provider", value: p.insurance.provider },
                  { label: "Policy number", value: <span className="font-mono">{p.insurance.policyNumber}</span> },
                  {
                    label: "Valid until",
                    value: (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {formatDate(p.insurance.validTill)}
                        {insuranceExpired && <StatusBadge status="EXPIRED" label="Expired" />}
                      </span>
                    ),
                  },
                ]}
              />
              {insuranceExpired && (
                <p className="text-muted-foreground text-sm">
                  Your policy has expired. Share your renewed policy at the billing desk so claims can be made.
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-base md:text-sm">
              No insurance on file. If you have a policy, share it at the billing desk so we can claim on your behalf.
            </p>
          )}
        </SectionCard>
      </FadeIn>

      <FadeIn delay={0.04}>
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Phone className="text-muted-foreground size-4" aria-hidden /> Contact details
            </span>
          }
          description="Keep these up to date so we can send reminders and reach you about results."
        >
          <ContactForm patient={p} />
        </SectionCard>
      </FadeIn>

      <FadeIn delay={0.08} className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Allergies & health conditions" description="Contact your doctor to update these.">
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-medium uppercase">Allergies</h3>
              {p.allergies.length ? (
                <ul className="space-y-2">
                  {p.allergies.map((a) => (
                    <li key={a.substance} className="flex flex-wrap items-center gap-2 text-base md:text-sm">
                      <span className="font-medium">{a.substance}</span>
                      <StatusBadge status={a.severity} />
                      <span className="text-muted-foreground">{a.reaction}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <AllergyBadges allergies={[]} />
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-medium uppercase">Long-term conditions</h3>
              {p.chronicConditions.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {p.chronicConditions.map((c) => (
                    <li key={c} className="bg-muted rounded-md px-2 py-0.5 text-sm">
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">None recorded</p>
              )}
            </div>
            {p.currentMedications.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-muted-foreground text-xs font-medium uppercase">Regular medicines</h3>
                <p className="text-base md:text-sm">{p.currentMedications.join(", ")}</p>
              </div>
            )}
          </div>
        </SectionCard>
        <Vaccinations patientId={p.id} />
      </FadeIn>

      <FadeIn delay={0.12}>
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="text-muted-foreground size-4" aria-hidden /> Account security
            </span>
          }
        >
          <div className="space-y-6">
            <div className="max-w-md space-y-3">
              <h3 className="text-base font-medium md:text-sm">Change password</h3>
              <ChangePasswordForm />
            </div>
            <div className="border-t pt-4">
              <SignOutEverywhere />
            </div>
          </div>
        </SectionCard>
      </FadeIn>

      <InfoNote>Your health information is private. Only your care team at {user.hospitalName ?? "the hospital"} can see it.</InfoNote>
    </div>
  );
}
