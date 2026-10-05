"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEMO_PASSWORD, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/constants/roles";
import { ApiError } from "@/lib/api/client";
import { emailSchema, phoneSchema, requiredString } from "@/lib/validation";
import { useDepartments, useInviteStaff } from "@/services/admin";
import { STAFF_ROLES, type InviteStaffRequest } from "@/types";

const schema = z
  .object({
    firstName: requiredString("First name"),
    lastName: requiredString("Last name"),
    email: emailSchema,
    phone: phoneSchema,
    role: z.enum(STAFF_ROLES as [InviteStaffRequest["role"], ...InviteStaffRequest["role"][]]),
    doctor: z.object({
      departmentIds: z.array(z.string()),
      specialisation: z.string().trim(),
      qualification: z.string().trim(),
      registrationNumber: z.string().trim(),
      experienceYears: z
        .number({ invalid_type_error: "Enter years of experience" })
        .int("Whole years only")
        .min(0, "Can't be negative")
        .max(60, "Check the years"),
      consultationFee: z.number({ invalid_type_error: "Enter the fee" }).min(0, "Can't be negative").max(100_000),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.role !== "DOCTOR") return;
    const req = (path: keyof Values["doctor"], ok: boolean, message: string) => {
      if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["doctor", path], message });
    };
    req("departmentIds", v.doctor.departmentIds.length > 0, "Choose at least one department");
    req("specialisation", !!v.doctor.specialisation, "Specialisation is required");
    req("qualification", !!v.doctor.qualification, "Qualification is required");
    req("registrationNumber", !!v.doctor.registrationNumber, "Medical registration number is required");
  });

type Values = z.infer<typeof schema>;

const DEFAULTS: Values = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "RECEPTIONIST",
  doctor: { departmentIds: [], specialisation: "", qualification: "", registrationNumber: "", experienceYears: 0, consultationFee: 500 },
};

export function InviteStaffDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const invite = useInviteStaff();
  const { data: departments, isLoading: loadingDeps } = useDepartments();
  const { register, control, handleSubmit, reset, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });
  const errors = formState.errors;
  const role = useWatch({ control, name: "role" });
  const isDoctor = role === "DOCTOR";

  const onSubmit = handleSubmit(async (v) => {
    const body: InviteStaffRequest = {
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email.toLowerCase(),
      phone: v.phone,
      role: v.role,
      ...(v.role === "DOCTOR" ? { doctor: v.doctor } : {}),
    };
    try {
      const user = await invite.mutateAsync(body);
      toast.success(`Invitation sent to ${user.email}. Demo password: ${DEMO_PASSWORD}`, { duration: 10_000 });
      setOpen(false);
      reset(DEFAULTS);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "EMAIL_TAKEN")
          setError("email", { type: "server", message: "A user with this email already exists." }, { shouldFocus: true });
        else if (err.details) {
          for (const [field, msgs] of Object.entries(err.details)) {
            if (msgs?.[0]) setError(field as keyof Values, { type: "server", message: msgs[0] });
          }
        }
      }
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset(DEFAULTS);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Invite staff</DialogTitle>
            <DialogDescription>They&apos;ll get an email to sign in. Access is based on the role you pick.</DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
            <Field data-invalid={!!errors.firstName || undefined}>
              <FieldLabel htmlFor="inv-first">First name</FieldLabel>
              <Input
                id="inv-first"
                autoFocus
                autoComplete="off"
                aria-invalid={!!errors.firstName || undefined}
                {...register("firstName")}
              />
              <FieldError errors={[errors.firstName]} />
            </Field>
            <Field data-invalid={!!errors.lastName || undefined}>
              <FieldLabel htmlFor="inv-last">Last name</FieldLabel>
              <Input id="inv-last" autoComplete="off" aria-invalid={!!errors.lastName || undefined} {...register("lastName")} />
              <FieldError errors={[errors.lastName]} />
            </Field>
            <Field data-invalid={!!errors.email || undefined}>
              <FieldLabel htmlFor="inv-email">Work email</FieldLabel>
              <Input id="inv-email" type="email" autoComplete="off" aria-invalid={!!errors.email || undefined} {...register("email")} />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={!!errors.phone || undefined}>
              <FieldLabel htmlFor="inv-phone">Mobile</FieldLabel>
              <Input
                id="inv-phone"
                type="tel"
                placeholder="+91 98765 43210"
                aria-invalid={!!errors.phone || undefined}
                {...register("phone")}
              />
              <FieldError errors={[errors.phone]} />
            </Field>
            <Field data-invalid={!!errors.role || undefined} className="sm:col-span-2">
              <FieldLabel htmlFor="inv-role">Role</FieldLabel>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="inv-role" className="w-full" aria-describedby="inv-role-desc">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription id="inv-role-desc">{ROLE_DESCRIPTIONS[role]}</FieldDescription>
              <FieldError errors={[errors.role]} />
            </Field>
          </FieldGroup>

          <AnimatePresence initial={false}>
            {isDoctor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <FieldSet className="rounded-lg border p-3">
                  <FieldLegend variant="label">Doctor profile</FieldLegend>
                  <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
                    <Field data-invalid={!!errors.doctor?.departmentIds || undefined} className="sm:col-span-2">
                      <span id="inv-deps-label" className="text-sm font-medium">
                        Departments
                      </span>
                      <Controller
                        control={control}
                        name="doctor.departmentIds"
                        render={({ field }) => (
                          <div
                            role="group"
                            aria-labelledby="inv-deps-label"
                            className="grid max-h-40 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2"
                          >
                            {loadingDeps && <p className="text-muted-foreground text-xs">Loading departments…</p>}
                            {!loadingDeps && !departments?.length && (
                              <p className="text-muted-foreground text-xs">Create a department first.</p>
                            )}
                            {departments?.map((d) => {
                              const checked = field.value.includes(d.id);
                              return (
                                <Label
                                  key={d.id}
                                  htmlFor={`inv-dep-${d.id}`}
                                  className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 font-normal"
                                >
                                  <Checkbox
                                    id={`inv-dep-${d.id}`}
                                    checked={checked}
                                    onCheckedChange={(c) =>
                                      field.onChange(c ? [...field.value, d.id] : field.value.filter((x) => x !== d.id))
                                    }
                                  />
                                  <span className="truncate">{d.name}</span>
                                  <span className="text-muted-foreground ml-auto font-mono text-xs">{d.code}</span>
                                </Label>
                              );
                            })}
                          </div>
                        )}
                      />
                      <FieldError errors={[errors.doctor?.departmentIds as { message?: string } | undefined]} />
                    </Field>
                    <Field data-invalid={!!errors.doctor?.specialisation || undefined}>
                      <FieldLabel htmlFor="inv-spec">Specialisation</FieldLabel>
                      <Input
                        id="inv-spec"
                        placeholder="e.g. Interventional Cardiology"
                        aria-invalid={!!errors.doctor?.specialisation || undefined}
                        {...register("doctor.specialisation")}
                      />
                      <FieldError errors={[errors.doctor?.specialisation]} />
                    </Field>
                    <Field data-invalid={!!errors.doctor?.qualification || undefined}>
                      <FieldLabel htmlFor="inv-qual">Qualification</FieldLabel>
                      <Input
                        id="inv-qual"
                        placeholder="e.g. MBBS, MD, DM"
                        aria-invalid={!!errors.doctor?.qualification || undefined}
                        {...register("doctor.qualification")}
                      />
                      <FieldError errors={[errors.doctor?.qualification]} />
                    </Field>
                    <Field data-invalid={!!errors.doctor?.registrationNumber || undefined}>
                      <FieldLabel htmlFor="inv-reg">Medical registration no.</FieldLabel>
                      <Input
                        id="inv-reg"
                        className="font-mono"
                        placeholder="e.g. MMC/2012/04567"
                        aria-invalid={!!errors.doctor?.registrationNumber || undefined}
                        {...register("doctor.registrationNumber")}
                      />
                      <FieldError errors={[errors.doctor?.registrationNumber]} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field data-invalid={!!errors.doctor?.experienceYears || undefined}>
                        <FieldLabel htmlFor="inv-exp">Experience (yrs)</FieldLabel>
                        <Input
                          id="inv-exp"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          className="tabular-nums"
                          aria-invalid={!!errors.doctor?.experienceYears || undefined}
                          {...register("doctor.experienceYears", { valueAsNumber: true })}
                        />
                        <FieldError errors={[errors.doctor?.experienceYears]} />
                      </Field>
                      <Field data-invalid={!!errors.doctor?.consultationFee || undefined}>
                        <FieldLabel htmlFor="inv-fee">Fee (₹)</FieldLabel>
                        <Input
                          id="inv-fee"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={1}
                          className="tabular-nums"
                          aria-invalid={!!errors.doctor?.consultationFee || undefined}
                          {...register("doctor.consultationFee", { valueAsNumber: true })}
                        />
                        <FieldError errors={[errors.doctor?.consultationFee]} />
                      </Field>
                    </div>
                  </FieldGroup>
                </FieldSet>
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={invite.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending && <Loader2 className="animate-spin" />}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
