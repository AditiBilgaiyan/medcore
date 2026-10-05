"use client";

import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ROUTES } from "@/constants/routes";
import { errorMessage } from "@/lib/api/client";
import { useResendOtp, useVerifyEmail } from "@/services/auth";

function VerifyEmailForm() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const verify = useVerifyEmail();
  const resend = useResendOtp();
  const router = useRouter();

  const submit = async (value = code) => {
    if (value.length !== 6) return;
    setError(null);
    try {
      await verify.mutateAsync({ email, code: value });
      toast.success("Email verified. You can sign in now.");
      router.push(ROUTES.login);
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
    }
  };

  return (
    <div className="space-y-6">
      <span className="bg-secondary text-secondary-foreground flex size-11 items-center justify-center rounded-full" aria-hidden>
        <MailCheck className="size-5" />
      </span>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          We sent a 6-digit code to <span className="text-foreground font-medium">{email || "your email"}</span>. It expires in 10 minutes.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(v) => {
            setCode(v);
            if (v.length === 6) void submit(v);
          }}
          aria-label="Verification code"
          autoFocus
          inputMode="numeric"
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }).map((_, i) => (
              <InputOTPSlot key={i} index={i} className="size-11 text-lg" />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <Button type="submit" className="w-full" size="lg" disabled={code.length !== 6 || verify.isPending}>
          {verify.isPending && <Loader2 className="animate-spin" />}
          Verify email
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">
        Didn&apos;t get it?{" "}
        <button
          type="button"
          className="text-primary cursor-pointer font-medium underline-offset-4 hover:underline disabled:opacity-50"
          disabled={resend.isPending || !email}
          onClick={async () => {
            const res = await resend.mutateAsync(email);
            toast.success("A new code is on its way.", {
              description: res.devOtp ? `Demo code: ${res.devOtp}` : undefined,
              duration: 20_000,
            });
          }}
        >
          Resend code
        </button>{" "}
        ·{" "}
        <Link href={ROUTES.login} className="text-primary font-medium underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
