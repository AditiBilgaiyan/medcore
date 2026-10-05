"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { useSendPhoneOtp, useVerifyPhone } from "@/services/auth";

const CODE_LENGTH = 6;

export function PhoneVerification() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useSendPhoneOtp();
  const verify = useVerifyPhone();

  if (!user) return null;
  const verified = user.isPhoneVerified;

  const sendCode = () => {
    setError(null);
    setCode("");
    send.mutate(undefined, {
      onSuccess: (res) =>
        toast.success(`Code sent to ${user.phone}`, {
          description: res?.devOtp ? `Demo mode — your code is ${res.devOtp}` : "It expires in 10 minutes.",
          duration: res?.devOtp ? 20_000 : undefined,
        }),
    });
  };

  const submit = (value = code) => {
    if (value.length !== CODE_LENGTH || verify.isPending) return;
    setError(null);
    verify.mutate(value, {
      onSuccess: () => {
        toast.success("Phone number verified");
        setOpen(false);
      },
      onError: (err) => {
        setCode("");
        setError(err instanceof ApiError && (err.code === "INVALID_CODE" || err.code === "CODE_EXPIRED") ? err.message : errorMessage(err));
      },
    });
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) sendCode();
    else {
      setCode("");
      setError(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg" aria-hidden>
          <Smartphone className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Phone verification</p>
          <p className="text-muted-foreground truncate text-xs">{user.phone || "No phone number on file"}</p>
        </div>
        {verified ? (
          <StatusBadge status="VERIFIED" tone="success" label="Verified" />
        ) : (
          <StatusBadge status="UNVERIFIED" tone="warning" label="Unverified" />
        )}
      </div>
      {!verified && (
        <Button variant="outline" size="sm" onClick={() => onOpenChange(true)} disabled={!user.phone}>
          <ShieldCheck aria-hidden /> Verify
        </Button>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Verify your phone</DialogTitle>
            <DialogDescription>
              Enter the {CODE_LENGTH}-digit code we sent by SMS to <span className="text-foreground font-medium">{user.phone}</span>.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col items-center gap-2">
              <Label htmlFor="phone-otp" className="sr-only">
                Verification code
              </Label>
              <InputOTP
                id="phone-otp"
                maxLength={CODE_LENGTH}
                pattern={REGEXP_ONLY_DIGITS}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (error) setError(null);
                }}
                onComplete={(v: string) => submit(v)}
                autoComplete="one-time-code"
                aria-invalid={!!error}
                aria-describedby={error ? "phone-otp-error" : undefined}
                disabled={verify.isPending}
                autoFocus
              >
                <InputOTPGroup>
                  {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} className="size-10 text-base" aria-invalid={!!error} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {error && (
                <p id="phone-otp-error" role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
            </div>
            <p className="text-muted-foreground text-center text-xs">
              Didn&apos;t get it?{" "}
              <Button type="button" variant="link" size="xs" className="h-auto p-0" onClick={sendCode} disabled={send.isPending}>
                {send.isPending ? "Sending…" : "Resend code"}
              </Button>
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={verify.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={code.length !== CODE_LENGTH || verify.isPending}>
                {verify.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Verify
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
