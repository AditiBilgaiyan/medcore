"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROUTES } from "@/constants/routes";
import { ApiError } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { emailSchema, phoneSchema, requiredString } from "@/lib/validation";
import { useCreateHospital } from "@/services/admin";
import type { CreateHospitalRequest } from "@/types";
import { HOSPITAL_TYPES, HOSPITAL_TYPE_LABEL, INDIAN_STATES, PLANS, PLAN_BY_VALUE } from "./constants";

const schema = z.object({
  name: requiredString("Hospital name").max(120, "Keep it under 120 characters"),
  type: z.enum(["CLINIC", "MULTI_SPECIALITY", "DIAGNOSTIC_CENTRE", "TELEHEALTH"], { required_error: "Choose a type" }),
  registrationNumber: requiredString("Registration number").max(60),
  bedCount: z
    .number({ invalid_type_error: "Enter the number of beds (0 if none)" })
    .int("Whole numbers only")
    .min(0, "Can't be negative")
    .max(10_000, "That's more beds than we support"),
  email: emailSchema,
  phone: phoneSchema,
  address: z.object({
    line1: requiredString("Address line 1"),
    line2: z.string().trim().optional(),
    city: requiredString("City"),
    state: requiredString("State"),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter a 6-digit PIN code"),
    country: requiredString("Country"),
  }),
  plan: z.enum(["STARTER", "GROWTH", "ENTERPRISE"]),
  admin: z.object({
    firstName: requiredString("First name"),
    lastName: requiredString("Last name"),
    email: emailSchema,
    phone: phoneSchema,
  }),
});

type Values = z.infer<typeof schema>;

const STEPS: { title: string; description: string; fields: FieldPath<Values>[] }[] = [
  {
    title: "Hospital",
    description: "Name, type and registration",
    fields: ["name", "type", "registrationNumber", "bedCount", "email", "phone"],
  },
  {
    title: "Address",
    description: "Where the hospital is",
    fields: ["address.line1", "address.line2", "address.city", "address.state", "address.postalCode", "address.country"],
  },
  { title: "Plan", description: "Subscription", fields: ["plan"] },
  { title: "Admin", description: "First Hospital Admin", fields: ["admin.firstName", "admin.lastName", "admin.email", "admin.phone"] },
  { title: "Review", description: "Confirm and create", fields: [] },
];

export function HospitalOnboardingWizard() {
  const router = useRouter();
  const create = useCreateHospital();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [maxReached, setMaxReached] = useState(0);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      type: "MULTI_SPECIALITY",
      registrationNumber: "",
      bedCount: 50,
      email: "",
      phone: "",
      address: { line1: "", line2: "", city: "", state: "", postalCode: "", country: "India" },
      plan: "GROWTH",
      admin: { firstName: "", lastName: "", email: "", phone: "" },
    },
  });
  const { register, control, handleSubmit, trigger, getValues, setError, formState } = form;
  const errors = formState.errors;
  const last = STEPS.length - 1;

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
  };

  const next = async () => {
    const ok = await trigger(STEPS[step].fields, { shouldFocus: true });
    if (ok) goTo(step + 1);
  };

  const submit = handleSubmit(
    async (v) => {
      const body: CreateHospitalRequest = {
        ...v,
        address: { ...v.address, line2: v.address.line2 || undefined },
        admin: { ...v.admin, email: v.admin.email.toLowerCase() },
      };
      try {
        const hospital = await create.mutateAsync(body);
        toast.success(`${hospital.name} onboarded — verify it to go live`);
        router.push(ROUTES.hospital(hospital.id));
      } catch (err) {
        if (err instanceof ApiError && err.code === "EMAIL_TAKEN") {
          goTo(3);
          setError(
            "admin.email",
            { type: "server", message: "This email is already in use. Use a different admin email." },
            { shouldFocus: true },
          );
        }
      }
    },
    (errs) => {
      // Jump back to the first step that has an error.
      const idx = STEPS.findIndex((s) =>
        s.fields.some((f) => f.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], errs)),
      );
      if (idx >= 0) goTo(idx);
    },
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < last) void next();
    else void submit();
  };

  const progress = Math.round((step / last) * 100);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <nav aria-label="Onboarding progress" className="space-y-3">
        <Progress value={progress} aria-label={`Step ${step + 1} of ${STEPS.length}`} />
        <ol className="grid grid-cols-5 gap-1">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            const reachable = i <= maxReached && !create.isPending;
            return (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => reachable && goTo(i)}
                  disabled={!reachable}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "focus-visible:outline-ring flex w-full flex-col items-center gap-1 rounded-lg p-1.5 text-center transition-colors focus-visible:outline-2 sm:flex-row sm:text-left",
                    reachable && !current && "hover:bg-muted",
                    !reachable && "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                      current && "border-primary bg-primary text-primary-foreground",
                      done && "border-primary text-primary",
                      !current && !done && "text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block truncate text-xs font-medium", !current && "text-muted-foreground")}>{s.title}</span>
                    <span className="text-muted-foreground hidden truncate text-xs md:block">{s.description}</span>
                    <span className="sr-only">{done ? "(completed)" : current ? "(current)" : ""}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <form onSubmit={onSubmit} noValidate className="bg-card overflow-hidden rounded-xl border">
        <div className="border-b px-4 py-3">
          <h2 className="font-heading text-base font-semibold">
            {step + 1}.{" "}
            {STEPS[step].title === "Admin"
              ? "First Hospital Admin"
              : STEPS[step].title === "Hospital"
                ? "Hospital details"
                : STEPS[step].title}
          </h2>
          <p className="text-muted-foreground text-xs">
            {
              [
                "Basic details as they appear on the hospital's registration certificate.",
                "Used on invoices, prescriptions and reports.",
                "Billed monthly. You can change the plan any time from the hospital page.",
                "This person gets a Hospital Admin account and sets up departments and staff.",
                "Check everything before creating the tenant. It starts as pending verification.",
              ][step]
            }
          </p>
        </div>

        <div className="p-4">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -12 }}
              transition={{ duration: 0.16 }}
            >
              {step === 0 && (
                <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
                  <Field data-invalid={!!errors.name || undefined} className="sm:col-span-2">
                    <FieldLabel htmlFor="h-name">Hospital name</FieldLabel>
                    <Input
                      id="h-name"
                      autoFocus
                      placeholder="e.g. Sunrise Multispeciality Hospital"
                      aria-invalid={!!errors.name || undefined}
                      {...register("name")}
                    />
                    <FieldError errors={[errors.name]} />
                  </Field>
                  <Field data-invalid={!!errors.type || undefined}>
                    <FieldLabel htmlFor="h-type">Type</FieldLabel>
                    <Controller
                      control={control}
                      name="type"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="h-type" className="w-full" aria-invalid={!!errors.type || undefined}>
                            <SelectValue placeholder="Choose a type" />
                          </SelectTrigger>
                          <SelectContent>
                            {HOSPITAL_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldDescription>{HOSPITAL_TYPES.find((t) => t.value === form.watch("type"))?.hint}</FieldDescription>
                    <FieldError errors={[errors.type]} />
                  </Field>
                  <Field data-invalid={!!errors.registrationNumber || undefined}>
                    <FieldLabel htmlFor="h-reg">Registration number</FieldLabel>
                    <Input
                      id="h-reg"
                      className="font-mono"
                      placeholder="e.g. MH/CEA/2024/01234"
                      aria-invalid={!!errors.registrationNumber || undefined}
                      {...register("registrationNumber")}
                    />
                    <FieldError errors={[errors.registrationNumber]} />
                  </Field>
                  <Field data-invalid={!!errors.bedCount || undefined}>
                    <FieldLabel htmlFor="h-beds">Beds</FieldLabel>
                    <Input
                      id="h-beds"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      className="tabular-nums"
                      aria-invalid={!!errors.bedCount || undefined}
                      {...register("bedCount", { valueAsNumber: true })}
                    />
                    <FieldError errors={[errors.bedCount]} />
                  </Field>
                  <div className="hidden sm:block" />
                  <Field data-invalid={!!errors.email || undefined}>
                    <FieldLabel htmlFor="h-email">Hospital email</FieldLabel>
                    <Input
                      id="h-email"
                      type="email"
                      autoComplete="off"
                      placeholder="contact@hospital.in"
                      aria-invalid={!!errors.email || undefined}
                      {...register("email")}
                    />
                    <FieldError errors={[errors.email]} />
                  </Field>
                  <Field data-invalid={!!errors.phone || undefined}>
                    <FieldLabel htmlFor="h-phone">Hospital phone</FieldLabel>
                    <Input
                      id="h-phone"
                      type="tel"
                      placeholder="+91 22 4000 1234"
                      aria-invalid={!!errors.phone || undefined}
                      {...register("phone")}
                    />
                    <FieldError errors={[errors.phone]} />
                  </Field>
                </FieldGroup>
              )}

              {step === 1 && (
                <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
                  <Field data-invalid={!!errors.address?.line1 || undefined} className="sm:col-span-2">
                    <FieldLabel htmlFor="a-line1">Address line 1</FieldLabel>
                    <Input
                      id="a-line1"
                      autoFocus
                      placeholder="Building, street"
                      aria-invalid={!!errors.address?.line1 || undefined}
                      {...register("address.line1")}
                    />
                    <FieldError errors={[errors.address?.line1]} />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="a-line2">
                      Address line 2 <span className="text-muted-foreground font-normal">(optional)</span>
                    </FieldLabel>
                    <Input id="a-line2" placeholder="Area, landmark" {...register("address.line2")} />
                  </Field>
                  <Field data-invalid={!!errors.address?.city || undefined}>
                    <FieldLabel htmlFor="a-city">City</FieldLabel>
                    <Input id="a-city" aria-invalid={!!errors.address?.city || undefined} {...register("address.city")} />
                    <FieldError errors={[errors.address?.city]} />
                  </Field>
                  <Field data-invalid={!!errors.address?.state || undefined}>
                    <FieldLabel htmlFor="a-state">State / UT</FieldLabel>
                    <Controller
                      control={control}
                      name="address.state"
                      render={({ field }) => (
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <SelectTrigger
                            id="a-state"
                            className="w-full"
                            aria-invalid={!!errors.address?.state || undefined}
                            onBlur={field.onBlur}
                          >
                            <SelectValue placeholder="Choose a state" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {INDIAN_STATES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError errors={[errors.address?.state]} />
                  </Field>
                  <Field data-invalid={!!errors.address?.postalCode || undefined}>
                    <FieldLabel htmlFor="a-pin">PIN code</FieldLabel>
                    <Input
                      id="a-pin"
                      inputMode="numeric"
                      maxLength={6}
                      className="tabular-nums"
                      aria-invalid={!!errors.address?.postalCode || undefined}
                      {...register("address.postalCode")}
                    />
                    <FieldError errors={[errors.address?.postalCode]} />
                  </Field>
                  <Field data-invalid={!!errors.address?.country || undefined}>
                    <FieldLabel htmlFor="a-country">Country</FieldLabel>
                    <Input id="a-country" aria-invalid={!!errors.address?.country || undefined} {...register("address.country")} />
                    <FieldError errors={[errors.address?.country]} />
                  </Field>
                </FieldGroup>
              )}

              {step === 2 && (
                <Controller
                  control={control}
                  name="plan"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid gap-3 md:grid-cols-3"
                      aria-label="Subscription plan"
                    >
                      {PLANS.map((p) => {
                        const selected = field.value === p.value;
                        return (
                          <label
                            key={p.value}
                            htmlFor={`plan-${p.value}`}
                            className={cn(
                              "hover:bg-accent/40 has-[:focus-visible]:ring-ring/50 relative flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-3",
                              selected && "border-primary bg-accent/30 ring-primary ring-1",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-heading font-semibold">{p.name}</p>
                                <p className="text-muted-foreground text-xs">{p.tagline}</p>
                              </div>
                              <RadioGroupItem id={`plan-${p.value}`} value={p.value} />
                            </div>
                            {p.popular && (
                              <span className="bg-primary text-primary-foreground absolute -top-2.5 left-4 rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide uppercase">
                                Most popular
                              </span>
                            )}
                            <p>
                              <span className="font-heading text-2xl font-semibold tabular-nums">{formatCurrency(p.price)}</span>
                              <span className="text-muted-foreground text-xs"> / month</span>
                            </p>
                            <ul className="space-y-1.5 text-xs">
                              {p.features.map((f) => (
                                <li key={f} className="flex items-start gap-1.5">
                                  <Check className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </label>
                        );
                      })}
                    </RadioGroup>
                  )}
                />
              )}

              {step === 3 && (
                <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
                  <Field data-invalid={!!errors.admin?.firstName || undefined}>
                    <FieldLabel htmlFor="ad-first">First name</FieldLabel>
                    <Input
                      id="ad-first"
                      autoFocus
                      autoComplete="off"
                      aria-invalid={!!errors.admin?.firstName || undefined}
                      {...register("admin.firstName")}
                    />
                    <FieldError errors={[errors.admin?.firstName]} />
                  </Field>
                  <Field data-invalid={!!errors.admin?.lastName || undefined}>
                    <FieldLabel htmlFor="ad-last">Last name</FieldLabel>
                    <Input
                      id="ad-last"
                      autoComplete="off"
                      aria-invalid={!!errors.admin?.lastName || undefined}
                      {...register("admin.lastName")}
                    />
                    <FieldError errors={[errors.admin?.lastName]} />
                  </Field>
                  <Field data-invalid={!!errors.admin?.email || undefined}>
                    <FieldLabel htmlFor="ad-email">Work email</FieldLabel>
                    <Input
                      id="ad-email"
                      type="email"
                      autoComplete="off"
                      aria-invalid={!!errors.admin?.email || undefined}
                      {...register("admin.email")}
                    />
                    <FieldDescription>They sign in with this email.</FieldDescription>
                    <FieldError errors={[errors.admin?.email]} />
                  </Field>
                  <Field data-invalid={!!errors.admin?.phone || undefined}>
                    <FieldLabel htmlFor="ad-phone">Mobile</FieldLabel>
                    <Input
                      id="ad-phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      aria-invalid={!!errors.admin?.phone || undefined}
                      {...register("admin.phone")}
                    />
                    <FieldError errors={[errors.admin?.phone]} />
                  </Field>
                </FieldGroup>
              )}

              {step === 4 && <ReviewStep values={getValues()} onEdit={goTo} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="bg-muted/30 flex items-center justify-between gap-2 border-t px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (step === 0 ? router.push(ROUTES.hospitals) : goTo(step - 1))}
            disabled={create.isPending}
          >
            <ArrowLeft /> {step === 0 ? "Cancel" : "Back"}
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">
            Step {step + 1} of {STEPS.length}
          </span>
          {step < last ? (
            <Button type="submit">
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" /> : <Check />}
              Create hospital
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function ReviewStep({ values: v, onEdit }: { values: Values; onEdit: (step: number) => void }) {
  const plan = PLAN_BY_VALUE[v.plan];
  const sections: { title: string; step: number; rows: [string, React.ReactNode][] }[] = [
    {
      title: "Hospital",
      step: 0,
      rows: [
        ["Name", v.name],
        ["Type", HOSPITAL_TYPE_LABEL[v.type]],
        [
          "Registration no.",
          <span key="r" className="font-mono">
            {v.registrationNumber}
          </span>,
        ],
        [
          "Beds",
          <span key="b" className="tabular-nums">
            {v.bedCount}
          </span>,
        ],
        ["Email", v.email],
        ["Phone", v.phone],
      ],
    },
    {
      title: "Address",
      step: 1,
      rows: [
        [
          "Address",
          [v.address.line1, v.address.line2, v.address.city, v.address.state, v.address.postalCode, v.address.country]
            .filter(Boolean)
            .join(", "),
        ],
      ],
    },
    {
      title: "Plan",
      step: 2,
      rows: [["Subscription", `${plan.name} · ${formatCurrency(plan.price)} / month`]],
    },
    {
      title: "Hospital Admin",
      step: 3,
      rows: [
        ["Name", `${v.admin.firstName} ${v.admin.lastName}`],
        ["Email", v.admin.email],
        ["Mobile", v.admin.phone],
      ],
    },
  ];
  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <section key={s.title} className="rounded-lg border p-3" aria-labelledby={`review-${s.step}`}>
          <div className="mb-2 flex items-center justify-between">
            <h3 id={`review-${s.step}`} className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {s.title}
            </h3>
            <Button type="button" variant="ghost" size="xs" onClick={() => onEdit(s.step)} aria-label={`Edit ${s.title.toLowerCase()}`}>
              <Pencil /> Edit
            </Button>
          </div>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {s.rows.map(([k, val]) => (
              <div key={k} className={cn("min-w-0", s.rows.length === 1 && "sm:col-span-2")}>
                <dt className="text-muted-foreground text-xs">{k}</dt>
                <dd className="text-sm font-medium break-words">{val}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="text-muted-foreground text-xs">
        The admin receives an invitation email. The hospital stays <strong>pending verification</strong> until you verify it.
      </p>
    </div>
  );
}
