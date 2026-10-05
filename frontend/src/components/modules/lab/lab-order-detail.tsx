"use client";

import { motion } from "framer-motion";
import { Ban, ClipboardList, FlaskConical, Hourglass, Loader2, Play, TestTubeDiagonal } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LabReportDocument, PrintActions } from "@/components/shared/documents";
import { PageHeader } from "@/components/shared/page-header";
import { KeyValueGrid, SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDateTime, humanize } from "@/lib/format";
import { useCancelLabOrder, useCollectSample, useLabOrder, useStartProcessing } from "@/services/lab";
import type { LabOrderDetail } from "@/types";
import { LabWorkflowStepper } from "./lab-workflow-stepper";
import { formatDuration, priorityLabel, turnaround } from "./lab-utils";
import { ResultEntryForm } from "./result-entry-form";
import { ResultsSummary, ReviewPanel } from "./review-panel";

function WaitingPanel({
  icon,
  title,
  description,
  action,
}: {
  icon: typeof Hourglass;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return <EmptyState icon={icon} title={title} description={description} action={action} />;
}

function ActionPanel({ order }: { order: LabOrderDetail }) {
  const { user, can } = useAuth();
  const collect = useCollectSample();
  const start = useStartProcessing();

  switch (order.status) {
    case "ORDERED":
      return (
        <SectionCard
          title="Sample collection"
          description={`${order.testDefinitions
            .map((t) => t.sampleType)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(", ")} required`}
        >
          <WaitingPanel
            icon={TestTubeDiagonal}
            title="Awaiting sample"
            description={
              can("lab:collect")
                ? "Confirm the patient's identity and label the sample before marking it collected."
                : "The lab will collect the sample shortly."
            }
            action={
              can("lab:collect") && (
                <Button
                  disabled={collect.isPending}
                  onClick={() => collect.mutate(order.id, { onSuccess: () => toast.success("Sample collected") })}
                >
                  {collect.isPending ? <Loader2 className="animate-spin" /> : <TestTubeDiagonal />} Collect sample
                </Button>
              )
            }
          />
        </SectionCard>
      );
    case "SAMPLE_COLLECTED":
      return (
        <SectionCard title="Processing">
          <WaitingPanel
            icon={FlaskConical}
            title="Sample received"
            description={
              can("lab:process") ? "Start processing to unlock result entry." : "Waiting for a lab technician to start processing."
            }
            action={
              can("lab:process") && (
                <Button
                  disabled={start.isPending}
                  onClick={() => start.mutate(order.id, { onSuccess: () => toast.success("Processing started") })}
                >
                  {start.isPending ? <Loader2 className="animate-spin" /> : <Play />} Start processing
                </Button>
              )
            }
          />
        </SectionCard>
      );
    case "PROCESSING":
    case "REJECTED":
      if (can("lab:process")) {
        return (
          <SectionCard
            title={order.status === "REJECTED" ? "Correct results" : "Result entry"}
            description="Flags update as you type, using the patient's gender-specific reference ranges."
          >
            <ResultEntryForm order={order} />
          </SectionCard>
        );
      }
      return (
        <SectionCard title="Results">
          <WaitingPanel
            icon={Hourglass}
            title={order.status === "REJECTED" ? "Results being corrected" : "In progress"}
            description={
              order.status === "REJECTED"
                ? `Sent back by the reviewer: ${order.rejectionReason ?? "—"}`
                : "Results will appear here once entered and approved."
            }
          />
        </SectionCard>
      );
    case "PENDING_APPROVAL":
      if (can("lab:approve")) {
        return (
          <SectionCard title="Review results" description="Verify and approve to release the report to the doctor and patient.">
            <ReviewPanel order={order} />
          </SectionCard>
        );
      }
      return (
        <SectionCard title="Preliminary results" description="Awaiting verification by a second lab technician — not yet released.">
          <ResultsSummary order={order} />
        </SectionCard>
      );
    case "APPROVED":
      return <LabReportDocument order={order} hospitalName={user?.hospitalName ?? undefined} />;
    case "CANCELLED":
      return (
        <SectionCard title="Order cancelled">
          <WaitingPanel
            icon={Ban}
            title="This order was cancelled"
            description={`Cancelled ${formatDateTime(order.updatedAt)}. No further action is needed.`}
          />
        </SectionCard>
      );
  }
}

function OrderDetails({ order }: { order: LabOrderDetail }) {
  const { can } = useAuth();
  const tat = turnaround(order);
  return (
    <SectionCard title="Order details" className="no-print">
      <KeyValueGrid
        items={[
          {
            label: "Patient",
            value: can("patients:read") ? (
              <Link href={ROUTES.patient(order.patientId)} className="text-primary underline-offset-4 hover:underline">
                {order.patientName}
              </Link>
            ) : (
              order.patientName
            ),
          },
          { label: "Gender", value: humanize(order.patientGender) },
          { label: "Ordering doctor", value: order.doctorName },
          { label: "Priority", value: <StatusBadge status={order.priority} label={priorityLabel(order.priority)} /> },
          { label: "Ordered", value: <span className="tabular-nums">{formatDateTime(order.createdAt)}</span> },
          {
            label: "Sample collected",
            value: order.collectedAt ? (
              <>
                <span className="tabular-nums">{formatDateTime(order.collectedAt)}</span>
                {order.collectedByName && (
                  <span className="text-muted-foreground block text-xs font-normal">by {order.collectedByName}</span>
                )}
              </>
            ) : (
              "—"
            ),
          },
          { label: "Processed by", value: order.processedByName ?? "—" },
          {
            label: "Approved",
            value: order.approvedAt ? (
              <>
                <span className="tabular-nums">{formatDateTime(order.approvedAt)}</span>
                {order.approvedByName && <span className="text-muted-foreground block text-xs font-normal">by {order.approvedByName}</span>}
              </>
            ) : (
              "—"
            ),
          },
          {
            label: tat.done ? "Turnaround" : "Elapsed",
            value: order.status === "CANCELLED" ? "—" : <span className="tabular-nums">{formatDuration(tat.elapsedMinutes)}</span>,
          },
        ]}
      />
      <div className="mt-4 space-y-1">
        <p className="text-muted-foreground text-xs">Tests</p>
        <ul className="divide-y rounded-lg border text-sm">
          {order.testDefinitions.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="min-w-0">
                <span className="font-medium">{t.name}</span> <span className="text-muted-foreground font-mono text-xs">{t.code}</span>
                <span className="text-muted-foreground block text-xs">
                  {t.sampleType} · {t.turnaroundHours}h TAT
                </span>
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">{formatCurrency(t.price)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-muted-foreground text-xs">Clinical notes</p>
        <p className="text-sm whitespace-pre-wrap">{order.clinicalNotes || <span className="text-muted-foreground">None provided</span>}</p>
      </div>
    </SectionCard>
  );
}

export function LabOrderDetailView({ id }: { id: string }) {
  const { user, can } = useAuth();
  const { data: order, isLoading, error, refetch } = useLabOrder(id);
  const cancel = useCancelLabOrder();

  if (isLoading) return <DetailSkeleton />;
  if (error || !order) return <ErrorState error={error ?? new Error("Lab order not found")} onRetry={() => refetch()} />;

  const canCancel =
    can("lab:order") &&
    !!user?.doctorId &&
    user.doctorId === order.doctorId &&
    (order.status === "ORDERED" || order.status === "SAMPLE_COLLECTED");

  return (
    <div className="space-y-4">
      <PageHeader
        className="no-print pb-1"
        breadcrumbs={[{ label: "Lab", href: ROUTES.lab }, { label: order.number }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{order.number}</span>
            <StatusBadge status={order.priority} label={priorityLabel(order.priority)} />
            <StatusBadge status={order.status} />
          </span>
        }
        description={
          <>
            {order.patientName} · {humanize(order.patientGender)} · ordered by {order.doctorName}
          </>
        }
        actions={
          <>
            {canCancel && (
              <ConfirmDialog
                title="Cancel this lab order?"
                description="The lab will stop work on this order. This can't be undone."
                confirmLabel="Cancel order"
                destructive
                onConfirm={async () => {
                  await cancel.mutateAsync(order.id);
                  toast.success("Lab order cancelled");
                }}
                trigger={
                  <Button variant="outline">
                    <Ban /> Cancel order
                  </Button>
                }
              />
            )}
            {order.status === "APPROVED" && <PrintActions pdfPath={`/lab-orders/${order.id}/pdf`} />}
          </>
        }
      />

      <Card className="no-print px-4 py-4">
        <LabWorkflowStepper order={order} />
      </Card>

      {order.status === "REJECTED" && !can("lab:process") && order.rejectionReason && (
        <Alert variant="destructive" className="no-print">
          <ClipboardList />
          <AlertTitle>Results rejected at review</AlertTitle>
          <AlertDescription>{order.rejectionReason}</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <motion.div
          key={order.status}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="min-w-0 lg:col-span-2"
        >
          <ActionPanel order={order} />
        </motion.div>
        <OrderDetails order={order} />
      </div>
    </div>
  );
}
