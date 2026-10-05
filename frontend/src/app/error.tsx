"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Sentry.captureException(error) in production.
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[60svh] flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
      <span className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">An unexpected error occurred. Try again, or reload the page.</p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
