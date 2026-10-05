"use client";

import { CheckCircle2, CreditCard, Landmark, Loader2, Lock, Smartphone, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { USE_MOCK_API } from "@/constants/config";
import { errorMessage } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PAYMENT_REFRESH_KEYS, useCheckout, useSimulateGatewayWebhook } from "@/services/billing";
import type { CheckoutSession, PaymentWebhookRequest } from "@/types";

type Method = PaymentWebhookRequest["method"];

const METHODS: { value: Method; label: string; provider: "STRIPE" | "RAZORPAY"; icon: typeof CreditCard; hint: string }[] = [
  { value: "STRIPE_CARD", label: "Card", provider: "STRIPE", icon: CreditCard, hint: "Visa, Mastercard, RuPay via Stripe" },
  { value: "RAZORPAY_UPI", label: "UPI", provider: "RAZORPAY", icon: Smartphone, hint: "GPay, PhonePe, Paytm via Razorpay" },
  { value: "RAZORPAY_NETBANKING", label: "Netbanking", provider: "RAZORPAY", icon: Landmark, hint: "All major banks via Razorpay" },
];

/**
 * Online payment. Creates a checkout session on our API, then (in mock mode) plays
 * the gateway: it posts a signed webhook to our API, which is what marks the invoice
 * paid. The client never asserts that a payment succeeded.
 */
export function PaymentDialog({
  invoiceId,
  amount,
  trigger,
  onPaid,
}: {
  invoiceId: string;
  amount: number;
  trigger: React.ReactNode;
  onPaid?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Method>("RAZORPAY_UPI");
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [upi, setUpi] = useState("patient@okhdfc");
  const [result, setResult] = useState<"succeeded" | "failed" | null>(null);
  const checkout = useCheckout();
  const webhook = useSimulateGatewayWebhook();
  const qc = useQueryClient();
  const selected = METHODS.find((m) => m.value === method)!;

  const reset = () => {
    setSession(null);
    setResult(null);
  };

  const start = async () => {
    try {
      setSession(await checkout.mutateAsync({ invoiceId, provider: selected.provider }));
    } catch {
      /* toast from mutation cache */
    }
  };

  const pay = async (outcome: "succeeded" | "failed") => {
    if (!session) return;
    if (!USE_MOCK_API) {
      toast.info("Redirecting to the payment gateway…");
      return;
    }
    try {
      await webhook.mutateAsync({
        provider: session.provider,
        sessionId: session.sessionId,
        outcome,
        method,
        signature: `whsec_mock_${session.sessionId}`,
      });
      setResult(outcome);
      if (outcome === "succeeded") toast.success(`Payment of ${formatCurrency(session.amount)} received`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          // Refresh billing data only once the confirmation has been seen.
          if (result) {
            PAYMENT_REFRESH_KEYS.forEach((queryKey) => void qc.invalidateQueries({ queryKey }));
            if (result === "succeeded") onPaid?.();
          }
          reset();
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay {formatCurrency(amount)}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden /> Payments are processed by Stripe and Razorpay{USE_MOCK_API ? " (test mode)" : ""}.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
            {result === "succeeded" ? (
              <CheckCircle2 className="size-10 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="size-10 text-red-600" aria-hidden />
            )}
            <p className="font-medium">{result === "succeeded" ? "Payment successful" : "Payment failed"}</p>
            <p className="text-muted-foreground text-sm">
              {result === "succeeded"
                ? "The gateway confirmed your payment. A receipt has been emailed to you."
                : "Your bank declined the payment. No money was taken."}
            </p>
          </div>
        ) : !session ? (
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)} className="gap-2" aria-label="Payment method">
            {METHODS.map((m) => (
              <Label
                key={m.value}
                htmlFor={`pm-${m.value}`}
                className={cn(
                  "hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                  method === m.value && "border-primary bg-accent/40",
                )}
              >
                <RadioGroupItem id={`pm-${m.value}`} value={m.value} />
                <m.icon className="text-muted-foreground size-4" aria-hidden />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="text-muted-foreground block text-xs font-normal">{m.hint}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        ) : (
          <div className="bg-muted/30 space-y-3 rounded-lg border p-4">
            <p className="text-muted-foreground text-xs">
              {selected.provider === "STRIPE" ? "Stripe Checkout" : "Razorpay"} · session{" "}
              <span className="font-mono">{session.sessionId.slice(0, 18)}…</span>
            </p>
            {method === "STRIPE_CARD" && (
              <div className="space-y-1.5">
                <Label htmlFor="card">Card number</Label>
                <Input id="card" inputMode="numeric" value={card} onChange={(e) => setCard(e.target.value)} />
                <p className="text-muted-foreground text-xs">Test card 4242 4242 4242 4242, any future date and CVC.</p>
              </div>
            )}
            {method === "RAZORPAY_UPI" && (
              <div className="space-y-1.5">
                <Label htmlFor="upi">UPI ID</Label>
                <Input id="upi" value={upi} onChange={(e) => setUpi(e.target.value)} />
              </div>
            )}
            {method === "RAZORPAY_NETBANKING" && (
              <p className="text-sm">You&apos;ll be redirected to your bank to authorise the payment.</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {result ? (
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          ) : !session ? (
            <Button onClick={start} disabled={checkout.isPending} className="w-full sm:w-auto">
              {checkout.isPending && <Loader2 className="animate-spin" />}
              Continue to {selected.provider === "STRIPE" ? "Stripe" : "Razorpay"}
            </Button>
          ) : (
            <>
              {USE_MOCK_API && (
                <Button variant="outline" onClick={() => pay("failed")} disabled={webhook.isPending}>
                  Simulate decline
                </Button>
              )}
              <Button onClick={() => pay("succeeded")} disabled={webhook.isPending}>
                {webhook.isPending && <Loader2 className="animate-spin" />}
                Pay {formatCurrency(session.amount)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
