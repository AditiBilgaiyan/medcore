"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Eye, EyeOff, Loader2, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { USE_MOCK_API } from "@/constants/config";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { ApiError, errorMessage } from "@/lib/api/client";
import { emailSchema } from "@/lib/validation";
import { useLogin } from "@/services/auth";

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const login = useLogin();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await login.mutateAsync({ ...values, deviceName: navigator.userAgent.includes("Mac") ? "Mac · Browser" : "Web browser" });
      // The auth layout redirects to ?next= or the role's home.
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
        router.push(`${ROUTES.verifyEmail}?email=${encodeURIComponent(values.email)}`);
        return;
      }
      setError(errorMessage(err));
    }
  });

  const signInAsDemo = (email: string) => {
    form.setValue("email", email, { shouldValidate: true });
    form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    void submit();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 lg:hidden">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <Stethoscope className="size-4" aria-hidden />
          </span>
          <span className="font-heading font-semibold">MedCore HMS</span>
        </div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Use your hospital account. Patients can sign in with the email they registered with.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
          <Field data-invalid={!!form.formState.errors.password}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link href={ROUTES.forgotPassword} className="text-primary text-sm font-medium underline-offset-4 hover:underline">
                Forgot password?
              </Link>
            </div>
            <InputGroup>
              <InputGroupInput
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={!!form.formState.errors.password}
                {...form.register("password")}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[form.formState.errors.password]} />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
            {login.isPending && <Loader2 className="animate-spin" />}
            Sign in
          </Button>
        </FieldGroup>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        New patient?{" "}
        <Link href={ROUTES.register} className="text-primary font-medium underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>

      {USE_MOCK_API && (
        <Collapsible defaultOpen className="bg-muted/30 rounded-xl border">
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left text-sm font-medium">
            Demo accounts — one per role
            <ChevronDown className="size-4 transition-transform [[data-state=open]_&]:rotate-180" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-muted-foreground px-4 text-xs">
              Password for all: <code className="bg-muted rounded px-1 font-mono">{DEMO_PASSWORD}</code>. Data lives in this browser only.
            </p>
            <ul className="grid gap-1 p-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.role}>
                  <button
                    type="button"
                    onClick={() => signInAsDemo(a.email)}
                    disabled={login.isPending}
                    className="hover:bg-accent focus-visible:outline-ring w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-2 disabled:opacity-50"
                    title={ROLE_DESCRIPTIONS[a.role]}
                  >
                    <span className="block text-sm font-medium">{ROLE_LABELS[a.role]}</span>
                    <span className="text-muted-foreground block truncate text-xs">{a.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
