"use client";

import { Ban, PackageCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PrescriptionDocument, PrintActions } from "@/components/shared/documents";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime } from "@/lib/format";
import { useCancelPrescription, usePrescription } from "@/services/prescriptions";

export default function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, can } = useAuth();
  const { data: rx, isLoading, error, refetch } = usePrescription(id);
  const cancel = useCancelPrescription();

  if (isLoading) return <DetailSkeleton />;
  if (error || !rx) return <ErrorState error={error ?? new Error("Prescription not found")} onRetry={() => refetch()} />;

  const canCancel = rx.status === "ISSUED" && !!user?.doctorId && user.doctorId === rx.doctorId;
  const itemName = (itemId: string) => rx.items.find((i) => i.id === itemId)?.medicineName ?? "Item";
  const dispensedHistory = [...rx.dispensations].sort((a, b) => b.dispensedAt.localeCompare(a.dispensedAt));

  return (
    <div>
      <PageHeader
        title={<span className="font-mono">{rx.number}</span>}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {rx.patientName} · {rx.doctorName} <StatusBadge status={rx.status} />
          </span>
        }
        breadcrumbs={[{ label: "Prescriptions", href: ROUTES.prescriptions }, { label: rx.number }]}
        actions={
          <>
            {can("patients:read") && (
              <Button variant="outline" size="sm" asChild>
                <Link href={ROUTES.patient(rx.patientId)}>
                  <UserRound /> Patient chart
                </Link>
              </Button>
            )}
            {canCancel && (
              <ConfirmDialog
                trigger={
                  <Button variant="destructive" size="sm">
                    <Ban /> Cancel prescription
                  </Button>
                }
                title={`Cancel ${rx.number}?`}
                description="The pharmacy won't be able to dispense it. This can't be undone; issue a new prescription if needed."
                confirmLabel="Cancel prescription"
                destructive
                onConfirm={async () => {
                  await cancel.mutateAsync(rx.id);
                  toast.success(`${rx.number} cancelled`);
                }}
              />
            )}
            <PrintActions pdfPath={`/prescriptions/${rx.id}/pdf`} />
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <PrescriptionDocument prescription={rx} />

        <aside className="no-print space-y-4" aria-label="Dispensing">
          <SectionCard title="Dispensing progress">
            <ul className="space-y-3">
              {rx.items.map((it) => {
                const pct = it.quantity ? Math.min(100, Math.round((it.dispensedQty / it.quantity) * 100)) : 0;
                return (
                  <li key={it.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{it.medicineName}</span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {it.dispensedQty}/{it.quantity}
                      </span>
                    </div>
                    <Progress value={pct} aria-label={`${it.medicineName}: ${it.dispensedQty} of ${it.quantity} dispensed`} />
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard title="Dispensing history" contentClassName="p-0">
            {dispensedHistory.length === 0 ? (
              <EmptyState
                compact
                icon={PackageCheck}
                title="Not dispensed yet"
                description={rx.status === "CANCELLED" ? "This prescription was cancelled." : undefined}
              />
            ) : (
              <ol className="divide-y">
                {dispensedHistory.map((d) => (
                  <li key={d.id} className="px-4 py-2.5 text-sm">
                    <p className="flex justify-between gap-2">
                      <span className="truncate font-medium">{itemName(d.itemId)}</span>
                      <span className="shrink-0 tabular-nums">× {d.quantity}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Batch <span className="font-mono">{d.batchNumber}</span> · {d.dispensedByName}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">{formatDateTime(d.dispensedAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
