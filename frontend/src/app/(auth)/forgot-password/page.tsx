"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/constants/routes";
import { emailSchema } from "@/lib/validation";
import { useForgotPassword } from "@/services/auth";

const schema = z.object({ email: emailSchema });

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | undefined>();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const submit = form.handleSubmit(async ({ email }) => {
    const res = await forgot.mutateAsync(email);
    setDevToken(res.devResetToken);
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <div className="space-y-6">
        <span className="bg-secondary text-secondary-foreground flex size-11 items-center justify-center rounded-full" aria-hidden>
          <MailCheck className="size-5" />
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Check your inbox</h1>
          <p className="text-muted-foreground text-sm">
            If an account exists for <span className="text-foreground font-medium">{sentTo}</span>, we&apos;ve sent a link to reset your
            password. It expires in 10 minutes.
          </p>
        </div>
        {devToken && (
          <Alert>
            <AlertDescription>
              Demo mode: emails aren&apos;t sent.{" "}
              <Link className="text-primary font-medium underline underline-offset-4" href={`${ROUTES.resetPassword}?token=${devToken}`}>
                Open the reset link
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <Button variant="outline" asChild className="w-full">
          <Link href={ROUTES.login}>Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <span className="bg-secondary text-secondary-foreground flex size-11 items-center justify-center rounded-full" aria-hidden>
        <KeyRound className="size-5" />
      </span>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-muted-foreground text-sm">Enter the email on your account and we&apos;ll send you a reset link.</p>
      </div>
      <form onSubmit={submit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!form.formState.errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={forgot.isPending}>
            {forgot.isPending && <Loader2 className="animate-spin" />}
            Send reset link
          </Button>
        </FieldGroup>
      </form>
      <p className="text-center text-sm">
        <Link href={ROUTES.login} className="text-primary font-medium underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
