"use client";

import { ExternalLink, Pill } from "lucide-react";
import Link from "next/link";
import { PrescriptionDocument, PrintActions } from "@/components/shared/documents";
import { DetailSkeleton, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate } from "@/lib/format";
import { usePrescription } from "@/services/prescriptions";
import { PRESCRIPTION_STATUS_COPY, prescriptionHref } from "./portal-utils";

/**
 * Prescription viewer. Renders the full document in a wide sheet; when the sheet is
 * open, the page behind it should add `print:hidden` so only the document prints.
 */
export function PrescriptionSheet({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  const rx = usePrescription(id ?? undefined);
  const copy = rx.data ? PRESCRIPTION_STATUS_COPY[rx.data.status] : null;

  return (
    <Sheet open={!!id} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-3xl print:static print:inset-auto print:h-auto print:max-w-none print:overflow-visible print:border-0 print:shadow-none"
      >
        <SheetHeader className="no-print border-b pr-12">
          <SheetTitle className="flex items-center gap-2">
            <Pill className="text-muted-foreground size-4" aria-hidden />
            {rx.data ? `Prescription ${rx.data.number}` : "Prescription"}
          </SheetTitle>
          <SheetDescription>
            {rx.data
              ? `Issued ${formatDate(rx.data.signedAt)} by ${rx.data.doctorName}. ${copy?.help ?? ""}`
              : "Loading your prescription…"}
          </SheetDescription>
          {rx.data && (
            <div className="flex flex-wrap gap-2 pt-1">
              <PrintActions pdfPath={`/prescriptions/${rx.data.id}/pdf`} />
              <Button variant="ghost" size="sm" asChild>
                <Link href={prescriptionHref(rx.data.id)}>
                  <ExternalLink /> Open full page
                </Link>
              </Button>
            </div>
          )}
        </SheetHeader>
        <div className="px-4 pb-6 print:p-0">
          {rx.isLoading ? (
            <DetailSkeleton />
          ) : rx.error ? (
            <ErrorState error={rx.error} onRetry={() => rx.refetch()} />
          ) : rx.data ? (
            <PrescriptionDocument prescription={rx.data} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
