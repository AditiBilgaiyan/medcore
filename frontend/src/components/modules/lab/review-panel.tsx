"use client";

import { AlertTriangle, CheckCircle2, FileText, ShieldAlert, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LabResultsTable } from "@/components/shared/clinical";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { USE_MOCK_API } from "@/constants/config";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";
import { formatBytes } from "@/lib/format";
import { useReviewResults } from "@/services/lab";
import type { LabOrderDetail } from "@/types";

export function ResultsSummary({ order }: { order: LabOrderDetail }) {
  const critical = order.results.filter((r) => r.flag === "CRITICAL");
  const abnormal = order.results.filter((r) => r.flag !== "NORMAL").length;
  return (
    <div className="space-y-3">
      {critical.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertTriangle />
          <AlertTitle>
            {critical.length} critical value{critical.length > 1 ? "s" : ""}
          </AlertTitle>
          <AlertDescription>{critical.map((c) => `${c.parameter} ${c.value} ${c.unit}`).join(" · ")}</AlertDescription>
        </Alert>
      )}
      <LabResultsTable results={order.results} tests={order.tests} />
      <p className="text-muted-foreground text-xs tabular-nums">
        {order.results.length} parameters · {abnormal} outside reference range
      </p>
      {order.technicianRemarks && (
        <div className="bg-muted/30 rounded-lg border px-3 py-2 text-sm">
          <p className="text-muted-foreground text-xs font-medium uppercase">Technician remarks</p>
          <p className="mt-0.5 whitespace-pre-wrap">{order.technicianRemarks}</p>
        </div>
      )}
      {order.reportAttachment && (
        <a
          href={order.reportAttachment.url}
          download={order.reportAttachment.name}
          className="text-primary focus-visible:outline-ring inline-flex items-center gap-1.5 rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2"
        >
          <FileText className="size-4" aria-hidden />
          {order.reportAttachment.name}
          <span className="text-muted-foreground text-xs font-normal">({formatBytes(order.reportAttachment.sizeBytes)})</span>
        </a>
      )}
    </div>
  );
}

export function ReviewPanel({ order }: { order: LabOrderDetail }) {
  const { user } = useAuth();
  const review = useReviewResults(order.id);
  const [serverBlocked, setServerBlocked] = useState(false);
  const selfProcessed = order.processedById === user?.id || serverBlocked;

  const decide = async (decision: "APPROVE" | "REJECT", reason?: string) => {
    try {
      await review.mutateAsync({ decision, reason });
      if (decision === "APPROVE")
        toast.success("Report approved and released", { description: "The patient and ordering doctor have been notified." });
      else toast.success("Results sent back for correction");
    } catch (err) {
      if (err instanceof ApiError && err.code === "SELF_APPROVAL_NOT_ALLOWED") setServerBlocked(true);
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      <ResultsSummary order={order} />

      {selfProcessed ? (
        <Alert>
          <ShieldAlert />
          <AlertTitle>You can&apos;t approve your own results</AlertTitle>
          <AlertDescription>
            <p>
              Four-eyes rule: results entered by {order.processedByName ?? "you"} must be verified and approved by a different lab
              technician before they&apos;re released to the doctor and patient.
            </p>
            {USE_MOCK_API && (
              <p className="mt-1">
                Demo: sign in as the other technician (<span className="font-mono text-xs">lab.senior@citycare.dev</span> or{" "}
                <span className="font-mono text-xs">lab@citycare.dev</span>) to review this order.
              </p>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-muted-foreground text-sm">
          Entered by <span className="text-foreground font-medium">{order.processedByName ?? "—"}</span>. Check every value against the
          sample and instrument printout before approving.
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <ConfirmDialog
          title="Send results back?"
          description="The technician who entered these results will be asked to correct and resubmit them."
          confirmLabel="Reject results"
          destructive
          reason={{ label: "Reason for rejection", placeholder: "e.g. Haemolysed sample — please re-run potassium", required: true }}
          onConfirm={(reason) => decide("REJECT", reason)}
          trigger={
            <Button variant="outline" disabled={selfProcessed || review.isPending}>
              <Undo2 /> Reject
            </Button>
          }
        />
        <ConfirmDialog
          title="Approve and release report?"
          description={`${order.patientName} and ${order.doctorName} will be notified that the report is ready. Approved results can't be edited.`}
          confirmLabel="Approve report"
          onConfirm={() => decide("APPROVE")}
          trigger={
            <Button disabled={selfProcessed || review.isPending}>
              <CheckCircle2 /> Approve
            </Button>
          }
        />
      </div>
    </div>
  );
}
