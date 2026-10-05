"use client";

import { DatabaseZap, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { USE_MOCK_API } from "@/constants/config";

/** Mock mode only: wipe the in-browser database and reseed it on next load. */
export function DemoResetCard() {
  if (!USE_MOCK_API) return null;

  const resetDemo = async () => {
    const { resetDb } = await import("@/lib/mock/db");
    await resetDb();
    window.location.href = "/login";
  };

  return (
    <Card className="border-destructive/40 gap-0 py-0">
      <div className="border-destructive/20 flex items-start gap-3 border-b px-4 py-3">
        <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="space-y-0.5">
          <h2 className="font-heading text-sm font-semibold">Danger zone</h2>
          <p className="text-muted-foreground text-xs">Demo mode only — this app is running on an in-browser mock backend.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Reset demo data</p>
          <p className="text-muted-foreground text-sm">
            Discards every change made in this browser (patients, appointments, invoices…) and restores the original seed data. You&apos;ll
            be signed out.
          </p>
        </div>
        <ConfirmDialog
          title="Reset all demo data?"
          description="Everything you've created or changed in this browser will be lost and the seed data restored. This can't be undone."
          confirmLabel="Reset demo data"
          destructive
          onConfirm={resetDemo}
          trigger={
            <Button variant="destructive" className="shrink-0">
              <DatabaseZap aria-hidden /> Reset demo data
            </Button>
          }
        />
      </div>
    </Card>
  );
}
