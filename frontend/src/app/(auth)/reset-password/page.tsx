"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/constants/routes";
import { errorMessage } from "@/lib/api/client";
import { passwordSchema } from "@/lib/validation";
import { useResetPassword } from "@/services/auth";

const schema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const reset = useResetPassword();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { password: "", confirmPassword: "" } });
  const e = form.formState.errors;

  const submit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await reset.mutateAsync({ token, password });
      toast.success("Password updated. Sign in with your new password.");
      router.push(ROUTES.login);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  if (!token) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          This reset link is incomplete.{" "}
          <Link className="font-medium underline" href={ROUTES.forgotPassword}>
            Request a new one
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="text-muted-foreground text-sm">You&apos;ll be signed out of all other devices.</p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={submit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!e.password}>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              aria-invalid={!!e.password}
              {...form.register("password")}
            />
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
          <Button type="submit" size="lg" className="w-full" disabled={reset.isPending}>
            {reset.isPending && <Loader2 className="animate-spin" />}
            Update password
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
