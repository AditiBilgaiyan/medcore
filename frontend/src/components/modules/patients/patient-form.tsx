"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api/client";
import { toPlainText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { applyServerErrors, emailSchema, pastDateSchema, phoneSchema, requiredString } from "@/lib/validation";
import type { AllergySeverity, BloodGroup, FamilyHistory, Gender, Patient, UpsertPatientRequest } from "@/types";
import { TagInput } from "./tag-input";

export const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];
const SEVERITIES: AllergySeverity[] = ["MILD", "MODERATE", "SEVERE"];
const FAMILY_HISTORY: { key: keyof FamilyHistory; label: string }[] = [
  { key: "diabetes", label: "Diabetes" },
  { key: "hypertension", label: "Hypertension" },
  { key: "cancer", label: "Cancer" },
  { key: "cardiac", label: "Cardiac disease" },
];
const CONDITION_SUGGESTIONS = ["Type 2 diabetes", "Hypertension", "Asthma", "Hypothyroidism", "COPD", "CKD"];

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\+?[0-9\s-]{10,16}$/.test(v), "Enter a valid phone number");

const patientSchema = z
  .object({
    firstName: requiredString("First name").max(60, "Keep it under 60 characters"),
    lastName: requiredString("Last name").max(60, "Keep it under 60 characters"),
    dob: pastDateSchema("Date of birth").refine((v) => v >= "1900-01-01", "Enter a valid date of birth"),
    gender: z.enum(["MALE", "FEMALE", "OTHER"], { required_error: "Select a gender", invalid_type_error: "Select a gender" }),
    bloodGroup: z.string(),
    phone: phoneSchema,
    email: z.union([z.literal(""), emailSchema]),
    address: z.object({
      line1: requiredString("Address line 1"),
      line2: z.string(),
      city: requiredString("City"),
      state: requiredString("State"),
      postalCode: z
        .string()
        .trim()
        .min(1, "Postal code is required")
        .regex(/^[0-9A-Za-z\s-]{4,10}$/, "Enter a valid postal code"),
      country: requiredString("Country"),
    }),
    emergencyContact: z.object({ name: z.string().trim(), relation: z.string().trim(), phone: optionalPhone }),
    allergies: z.array(
      z.object({
        substance: requiredString("Substance").max(80),
        reaction: z.string().trim().max(200),
        severity: z.enum(["MILD", "MODERATE", "SEVERE"]),
      }),
    ),
    familyHistory: z.object({ diabetes: z.boolean(), hypertension: z.boolean(), cancer: z.boolean(), cardiac: z.boolean() }),
    chronicConditions: z.array(z.string()),
    hasInsurance: z.boolean(),
    insurance: z.object({ provider: z.string().trim(), policyNumber: z.string().trim(), validTill: z.string() }),
  })
  .superRefine((v, ctx) => {
    if (v.emergencyContact.name && !v.emergencyContact.phone) {
      ctx.addIssue({ code: "custom", path: ["emergencyContact", "phone"], message: "Add a phone number for the emergency contact" });
    }
    if (!v.hasInsurance) return;
    if (!v.insurance.provider) ctx.addIssue({ code: "custom", path: ["insurance", "provider"], message: "Provider is required" });
    if (!v.insurance.policyNumber)
      ctx.addIssue({ code: "custom", path: ["insurance", "policyNumber"], message: "Policy number is required" });
    if (!v.insurance.validTill) ctx.addIssue({ code: "custom", path: ["insurance", "validTill"], message: "Validity date is required" });
  });

export type PatientFormValues = z.infer<typeof patientSchema>;

export const EMPTY_PATIENT: PatientFormValues = {
  firstName: "",
  lastName: "",
  dob: "",
  gender: undefined as unknown as Gender,
  bloodGroup: "",
  phone: "",
  email: "",
  address: { line1: "", line2: "", city: "", state: "", postalCode: "", country: "India" },
  emergencyContact: { name: "", relation: "", phone: "" },
  allergies: [],
  familyHistory: { diabetes: false, hypertension: false, cancer: false, cardiac: false },
  chronicConditions: [],
  hasInsurance: false,
  insurance: { provider: "", policyNumber: "", validTill: "" },
};

export function patientToFormValues(p: Patient): PatientFormValues {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    dob: p.dob,
    gender: p.gender,
    bloodGroup: p.bloodGroup ?? "",
    phone: p.phone,
    email: p.email ?? "",
    address: {
      line1: p.address?.line1 ?? "",
      line2: p.address?.line2 ?? "",
      city: p.address?.city ?? "",
      state: p.address?.state ?? "",
      postalCode: p.address?.postalCode ?? "",
      country: p.address?.country || "India",
    },
    emergencyContact: {
      name: p.emergencyContact?.name ?? "",
      relation: p.emergencyContact?.relation ?? "",
      phone: p.emergencyContact?.phone ?? "",
    },
    allergies: p.allergies.map((a) => ({ ...a, reaction: a.reaction ?? "" })),
    familyHistory: { ...EMPTY_PATIENT.familyHistory, ...p.familyHistory },
    chronicConditions: [...p.chronicConditions],
    hasInsurance: !!p.insurance,
    insurance: p.insurance ? { ...p.insurance } : { provider: "", policyNumber: "", validTill: "" },
  };
}

const clean = (s: string) => toPlainText(s).trim();

export function formValuesToRequest(v: PatientFormValues): UpsertPatientRequest {
  return {
    firstName: clean(v.firstName),
    lastName: clean(v.lastName),
    dob: v.dob,
    gender: v.gender,
    bloodGroup: (v.bloodGroup || undefined) as BloodGroup | undefined,
    phone: v.phone.trim(),
    email: v.email.trim() || undefined,
    address: {
      line1: clean(v.address.line1),
      line2: clean(v.address.line2) || undefined,
      city: clean(v.address.city),
      state: clean(v.address.state),
      postalCode: v.address.postalCode.trim(),
      country: clean(v.address.country),
    },
    emergencyContact: {
      name: clean(v.emergencyContact.name),
      relation: clean(v.emergencyContact.relation),
      phone: v.emergencyContact.phone.trim(),
    },
    allergies: v.allergies.map((a) => ({ substance: clean(a.substance), reaction: clean(a.reaction), severity: a.severity })),
    familyHistory: v.familyHistory,
    chronicConditions: v.chronicConditions.map(clean).filter(Boolean),
    insurance: v.hasInsurance
      ? { provider: clean(v.insurance.provider), policyNumber: v.insurance.policyNumber.trim(), validTill: v.insurance.validTill }
      : undefined,
  };
}

interface PatientFormProps {
  defaultValues?: PatientFormValues;
  /** Throw to keep the form open; ApiError details are mapped onto fields. */
  onSubmit: (request: UpsertPatientRequest) => Promise<unknown>;
  submitLabel?: string;
  onCancel?: () => void;
  /** "dialog" uses a flat layout with a sticky footer for scrolling dialogs. */
  variant?: "page" | "dialog";
  idPrefix?: string;
}

type Form = UseFormReturn<PatientFormValues>;

export function PatientForm({
  defaultValues = EMPTY_PATIENT,
  onSubmit,
  submitLabel = "Save",
  onCancel,
  variant = "page",
  idPrefix = "pf",
}: PatientFormProps) {
  const form = useForm<PatientFormValues>({ resolver: zodResolver(patientSchema), defaultValues, mode: "onTouched" });
  const rootError = form.formState.errors.root?.server?.message;

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(formValuesToRequest(values));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "DUPLICATE_PATIENT") {
          form.setError("root.server", { type: "server", message: err.message });
          return;
        }
        const applied = applyServerErrors<PatientFormValues>(err.details, (name, e) => form.setError(name as keyof PatientFormValues, e));
        if (!applied) form.setError("root.server", { type: "server", message: err.message });
      }
    }
  });

  const section = variant === "page" ? "rounded-xl border bg-card p-4 sm:p-5" : "border-b pb-5 last:border-0";
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {rootError && (
        <Alert variant="destructive" role="alert">
          <AlertTriangle aria-hidden />
          <AlertTitle>Couldn&apos;t save this patient</AlertTitle>
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}

      <div className={cn("space-y-5", variant === "page" && "grid gap-5 space-y-0 xl:grid-cols-2")}>
        <Demographics form={form} id={id} className={section} />
        <Contact form={form} id={id} className={section} />
        <AddressSection form={form} id={id} className={section} />
        <EmergencyContact form={form} id={id} className={section} />
        <Allergies form={form} id={id} className={cn(section, variant === "page" && "xl:col-span-2")} />
        <MedicalHistory form={form} id={id} className={section} />
        <Insurance form={form} id={id} className={section} />
      </div>

      <div
        className={cn(
          "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
          variant === "dialog" ? "bg-background sticky bottom-0 -mx-1 border-t px-1 pt-3" : "pt-1",
        )}
      >
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={form.formState.isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

type SectionProps = { form: Form; id: (n: string) => string; className?: string };

function TextField({
  form,
  name,
  label,
  id,
  required,
  type = "text",
  autoComplete,
  placeholder,
  max,
  description,
}: {
  form: Form;
  name: Parameters<Form["register"]>[0];
  label: string;
  id: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  max?: string;
  description?: string;
}) {
  const error = name.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], form.formState.errors) as
    { message?: string } | undefined;
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </FieldLabel>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        max={max}
        aria-invalid={!!error}
        aria-required={required || undefined}
        {...form.register(name)}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError errors={[error]} />
    </Field>
  );
}

function Demographics({ form, id, className }: SectionProps) {
  const errors = form.formState.errors;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <FieldSet className={className}>
      <FieldLegend>Demographics</FieldLegend>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="firstName" label="First name" id={id("firstName")} required autoComplete="off" />
        <TextField form={form} name="lastName" label="Last name" id={id("lastName")} required autoComplete="off" />
        <TextField form={form} name="dob" label="Date of birth" id={id("dob")} type="date" required max={today} />
        <Field data-invalid={!!errors.gender}>
          <FieldLabel htmlFor={id("gender")}>
            Gender
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </FieldLabel>
          <Controller
            control={form.control}
            name="gender"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger id={id("gender")} className="w-full" aria-invalid={!!errors.gender} onBlur={field.onBlur}>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.gender]} />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("bloodGroup")}>Blood group</FieldLabel>
          <Controller
            control={form.control}
            name="bloodGroup"
            render={({ field }) => (
              <Select value={field.value || "unknown"} onValueChange={(v) => field.onChange(v === "unknown" ? "" : v)}>
                <SelectTrigger id={id("bloodGroup")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  {BLOOD_GROUPS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

function Contact({ form, id, className }: SectionProps) {
  return (
    <FieldSet className={className}>
      <FieldLegend>Contact</FieldLegend>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <TextField
          form={form}
          name="phone"
          label="Phone"
          id={id("phone")}
          type="tel"
          required
          autoComplete="off"
          placeholder="+91 98765 43210"
        />
        <TextField
          form={form}
          name="email"
          label="Email"
          id={id("email")}
          type="email"
          autoComplete="off"
          description="Used for appointment and report notifications."
        />
      </FieldGroup>
    </FieldSet>
  );
}

function AddressSection({ form, id, className }: SectionProps) {
  return (
    <FieldSet className={className}>
      <FieldLegend>Address</FieldLegend>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField form={form} name="address.line1" label="Address line 1" id={id("line1")} required autoComplete="off" />
        </div>
        <div className="sm:col-span-2">
          <TextField form={form} name="address.line2" label="Address line 2" id={id("line2")} autoComplete="off" />
        </div>
        <TextField form={form} name="address.city" label="City" id={id("city")} required autoComplete="off" />
        <TextField form={form} name="address.state" label="State" id={id("state")} required autoComplete="off" />
        <TextField form={form} name="address.postalCode" label="Postal code" id={id("postalCode")} required autoComplete="off" />
        <TextField form={form} name="address.country" label="Country" id={id("country")} required autoComplete="off" />
      </FieldGroup>
    </FieldSet>
  );
}

function EmergencyContact({ form, id, className }: SectionProps) {
  return (
    <FieldSet className={className}>
      <FieldLegend>Emergency contact</FieldLegend>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField form={form} name="emergencyContact.name" label="Name" id={id("ecName")} autoComplete="off" />
        </div>
        <TextField
          form={form}
          name="emergencyContact.relation"
          label="Relation"
          id={id("ecRelation")}
          autoComplete="off"
          placeholder="e.g. Spouse"
        />
        <TextField form={form} name="emergencyContact.phone" label="Phone" id={id("ecPhone")} type="tel" autoComplete="off" />
      </FieldGroup>
    </FieldSet>
  );
}

function Allergies({ form, id, className }: SectionProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "allergies" });
  const errors = form.formState.errors.allergies;
  return (
    <FieldSet className={className}>
      <FieldLegend>Allergies</FieldLegend>
      <div className="-mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {fields.length === 0
            ? "No known allergies. Add any drug, food or environmental allergies."
            : "Shown prominently wherever the patient is prescribed."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ substance: "", reaction: "", severity: "MODERATE" })}>
          <Plus /> Add allergy
        </Button>
      </div>
      {fields.length > 0 && (
        <ul className="space-y-3">
          {fields.map((f, i) => (
            <li key={f.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1.4fr_10rem_auto] sm:items-start">
              <Field data-invalid={!!errors?.[i]?.substance}>
                <FieldLabel htmlFor={id(`al-${i}-substance`)}>Substance</FieldLabel>
                <Input
                  id={id(`al-${i}-substance`)}
                  placeholder="e.g. Penicillin"
                  aria-invalid={!!errors?.[i]?.substance}
                  {...form.register(`allergies.${i}.substance`)}
                />
                <FieldError errors={[errors?.[i]?.substance]} />
              </Field>
              <Field>
                <FieldLabel htmlFor={id(`al-${i}-reaction`)}>Reaction</FieldLabel>
                <Input id={id(`al-${i}-reaction`)} placeholder="e.g. Hives, swelling" {...form.register(`allergies.${i}.reaction`)} />
              </Field>
              <Field>
                <FieldLabel htmlFor={id(`al-${i}-severity`)}>Severity</FieldLabel>
                <Controller
                  control={form.control}
                  name={`allergies.${i}.severity`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={id(`al-${i}-severity`)} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEVERITIES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sm:mt-6"
                onClick={() => remove(i)}
                aria-label={`Remove allergy ${i + 1}`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </FieldSet>
  );
}

function MedicalHistory({ form, id, className }: SectionProps) {
  return (
    <FieldSet className={className}>
      <FieldLegend>Medical history</FieldLegend>
      <FieldGroup className="gap-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Family history</legend>
          <div className="grid grid-cols-2 gap-2">
            {FAMILY_HISTORY.map((fh) => (
              <Controller
                key={fh.key}
                control={form.control}
                name={`familyHistory.${fh.key}`}
                render={({ field }) => (
                  <Field orientation="horizontal" className="rounded-lg border px-3 py-2">
                    <Checkbox id={id(`fh-${fh.key}`)} checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} />
                    <FieldLabel htmlFor={id(`fh-${fh.key}`)} className="font-normal">
                      {fh.label}
                    </FieldLabel>
                  </Field>
                )}
              />
            ))}
          </div>
        </fieldset>
        <Field>
          <FieldLabel htmlFor={id("conditions")}>Chronic conditions</FieldLabel>
          <Controller
            control={form.control}
            name="chronicConditions"
            render={({ field }) => (
              <TagInput
                id={id("conditions")}
                value={field.value}
                onChange={field.onChange}
                placeholder="Type a condition and press Enter"
                suggestions={CONDITION_SUGGESTIONS}
                aria-describedby={id("conditions-desc")}
              />
            )}
          />
          <FieldDescription id={id("conditions-desc")}>Press Enter or comma to add each condition.</FieldDescription>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

function Insurance({ form, id, className }: SectionProps) {
  const hasInsurance = form.watch("hasInsurance");
  return (
    <FieldSet className={className}>
      <FieldLegend>Insurance</FieldLegend>
      <div className="-mt-3">
        <Controller
          control={form.control}
          name="hasInsurance"
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Switch id={id("hasInsurance")} checked={field.value} onCheckedChange={field.onChange} />
              <label htmlFor={id("hasInsurance")} className="text-sm">
                Patient is insured
              </label>
            </div>
          )}
        />
      </div>
      {hasInsurance ? (
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField form={form} name="insurance.provider" label="Provider / TPA" id={id("insProvider")} required autoComplete="off" />
          </div>
          <TextField form={form} name="insurance.policyNumber" label="Policy number" id={id("insPolicy")} required autoComplete="off" />
          <TextField form={form} name="insurance.validTill" label="Valid till" id={id("insValid")} type="date" required />
        </FieldGroup>
      ) : (
        <p className="text-muted-foreground text-sm">Self-pay. Turn on to record a policy for cashless claims.</p>
      )}
    </FieldSet>
  );
}
