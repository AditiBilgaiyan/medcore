"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROUTES } from "@/constants/routes";
import { ApiError, errorMessage } from "@/lib/api/client";
import { applyServerErrors, emailSchema, passwordSchema, pastDateSchema, phoneSchema, requiredString } from "@/lib/validation";
import { usePublicHospitals, useRegister } from "@/services/auth";

const schema = z
  .object({
    firstName: requiredString("First name"),
    lastName: requiredString("Last name"),
    email: emailSchema,
    phone: phoneSchema,
    dob: pastDateSchema("Date of birth"),
    gender: z.enum(["MALE", "FEMALE", "OTHER"], { required_error: "Select a gender" }),
    hospitalId: z.string().min(1, "Choose your hospital"),
    password: passwordSchema,
    confirmPassword: z.string(),
    consent: z.literal(true, { errorMap: () => ({ message: "You need to accept to continue" }) }),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const register = useRegister();
  const hospitals = usePublicHospitals();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", dob: "", hospitalId: "", password: "", confirmPassword: "" },
  });
  const e = form.formState.errors;

  const submit = form.handleSubmit(async ({ firstName, lastName, email, phone, dob, gender, hospitalId, password }) => {
    const values = { firstName, lastName, email, phone, dob, gender, hospitalId, password };
    setError(null);
    try {
      const res = await register.mutateAsync(values);
      if (res.devOtp) toast.info(`Demo: your verification code is ${res.devOtp}`, { duration: 20_000 });
      router.push(`${ROUTES.verifyEmail}?email=${encodeURIComponent(res.email)}`);
    } catch (err) {
      if (err instanceof ApiError && applyServerErrors<FormValues>(err.details, form.setError)) return;
      setError(errorMessage(err));
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Create your patient account</h1>
        <p className="text-muted-foreground text-sm">View records, book appointments and pay bills online.</p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={submit} noValidate>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!e.firstName}>
              <FieldLabel htmlFor="firstName">First name</FieldLabel>
              <Input id="firstName" autoComplete="given-name" aria-invalid={!!e.firstName} {...form.register("firstName")} />
              <FieldError errors={[e.firstName]} />
            </Field>
            <Field data-invalid={!!e.lastName}>
              <FieldLabel htmlFor="lastName">Last name</FieldLabel>
              <Input id="lastName" autoComplete="family-name" aria-invalid={!!e.lastName} {...form.register("lastName")} />
              <FieldError errors={[e.lastName]} />
            </Field>
          </div>
          <Field data-invalid={!!e.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!e.email} {...form.register("email")} />
            <FieldError errors={[e.email]} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!e.phone}>
              <FieldLabel htmlFor="phone">Mobile number</FieldLabel>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 98xxx xxxxx"
                aria-invalid={!!e.phone}
                {...form.register("phone")}
              />
              <FieldError errors={[e.phone]} />
            </Field>
            <Field data-invalid={!!e.dob}>
              <FieldLabel htmlFor="dob">Date of birth</FieldLabel>
              <Input
                id="dob"
                type="date"
                autoComplete="bday"
                max={new Date().toISOString().slice(0, 10)}
                aria-invalid={!!e.dob}
                {...form.register("dob")}
              />
              <FieldError errors={[e.dob]} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!e.gender}>
              <FieldLabel htmlFor="gender">Gender</FieldLabel>
              <Controller
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="gender" className="w-full" aria-invalid={!!e.gender}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[e.gender]} />
            </Field>
            <Field data-invalid={!!e.hospitalId}>
              <FieldLabel htmlFor="hospitalId">Hospital</FieldLabel>
              <Controller
                control={form.control}
                name="hospitalId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={hospitals.isLoading}>
                    <SelectTrigger id="hospitalId" className="w-full" aria-invalid={!!e.hospitalId}>
                      <SelectValue placeholder={hospitals.isLoading ? "Loading…" : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {hospitals.data?.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name} · {h.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[e.hospitalId]} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!e.password}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!e.password} {...form.register("password")} />
              <FieldDescription>8+ characters with upper & lower case, a number and a symbol.</FieldDescription>
              <FieldError errors={[e.password]} />
            </Field>
            <Field data-invalid={!!e.confirmPassword}>
              <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!e.confirmPassword}
                {...form.register("confirmPassword")}
              />
              <FieldError errors={[e.confirmPassword]} />
            </Field>
          </div>
          <Field orientation="horizontal" data-invalid={!!e.consent}>
            <Controller
              control={form.control}
              name="consent"
              render={({ field }) => (
                <Checkbox
                  id="consent"
                  checked={field.value === true}
                  onCheckedChange={(v) => field.onChange(v === true ? true : undefined)}
                  aria-invalid={!!e.consent}
                />
              )}
            />
            <FieldLabel htmlFor="consent" className="font-normal">
              I consent to MedCore storing my health information to provide care, as described in the privacy notice.
            </FieldLabel>
          </Field>
          <FieldError errors={[e.consent]} />
          <Button type="submit" size="lg" className="w-full" disabled={register.isPending}>
            {register.isPending && <Loader2 className="animate-spin" />}
            Create account
          </Button>
        </FieldGroup>
      </form>
      <p className="text-muted-foreground text-center text-sm">
        Already registered?{" "}
        <Link href={ROUTES.login} className="text-primary font-medium underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
