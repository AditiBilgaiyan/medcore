"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/shared/section-card";
import { ApiError, errorMessage } from "@/lib/api/client";
import { passwordSchema } from "@/lib/validation";
import { useChangePassword } from "@/services/auth";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Re-enter the new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a password you haven't just used" });
type Values = z.infer<typeof schema>;

export function PasswordCard() {
  const change = useChangePassword();
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      toast.success("Password changed", { description: "Use your new password next time you sign in." });
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_PASSWORD") {
        setError("currentPassword", { type: "server", message: err.message }, { shouldFocus: true });
      } else if (err instanceof ApiError && err.code === "WEAK_PASSWORD") {
        setError("newPassword", { type: "server", message: err.message }, { shouldFocus: true });
      } else {
        toast.error(errorMessage(err));
      }
    }
  });

  const type = show ? "text" : "password";

  return (
    <SectionCard
      title="Change password"
      description="At least 8 characters with upper and lower case letters, a number and a symbol."
      action={
        <Button type="button" variant="ghost" size="xs" onClick={() => setShow((s) => !s)} aria-pressed={show}>
          {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          {show ? "Hide" : "Show"} passwords
        </Button>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4">
          <Field data-invalid={!!errors.currentPassword}>
            <FieldLabel htmlFor="pw-current">Current password</FieldLabel>
            <Input
              id="pw-current"
              type={type}
              autoComplete="current-password"
              aria-invalid={!!errors.currentPassword}
              {...register("currentPassword")}
            />
            <FieldError errors={[errors.currentPassword]} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.newPassword}>
              <FieldLabel htmlFor="pw-new">New password</FieldLabel>
              <Input id="pw-new" type={type} autoComplete="new-password" aria-invalid={!!errors.newPassword} {...register("newPassword")} />
              <FieldError errors={[errors.newPassword]} />
            </Field>
            <Field data-invalid={!!errors.confirmPassword}>
              <FieldLabel htmlFor="pw-confirm">Confirm new password</FieldLabel>
              <Input
                id="pw-confirm"
                type={type}
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                {...register("confirmPassword")}
              />
              <FieldError errors={[errors.confirmPassword]} />
            </Field>
          </div>
          <FieldDescription>
            Other signed-in devices stay signed in. Use “Sign out all devices” below if you think your account was compromised.
          </FieldDescription>
          <div className="flex justify-end">
            <Button type="submit" disabled={change.isPending}>
              {change.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
              Update password
            </Button>
          </div>
        </FieldGroup>
      </form>
    </SectionCard>
  );
}
