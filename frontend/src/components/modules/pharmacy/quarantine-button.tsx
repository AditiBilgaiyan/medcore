"use client";

import { ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { useQuarantineBatch } from "@/services/pharmacy";

interface QuarantineButtonProps {
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  expired: boolean;
  size?: "xs" | "sm";
}

export function QuarantineButton({
  medicineId,
  medicineName,
  batchId,
  batchNumber,
  quantity,
  expired,
  size = "xs",
}: QuarantineButtonProps) {
  const quarantine = useQuarantineBatch();
  return (
    <ConfirmDialog
      title={`Quarantine batch ${batchNumber}?`}
      description={
        <>
          {formatNumber(quantity)} unit{quantity === 1 ? "" : "s"} of {medicineName}
          {expired ? " (expired)" : ""} will be removed from dispensable stock. This is recorded in the audit log.
        </>
      }
      confirmLabel="Quarantine batch"
      destructive
      onConfirm={async () => {
        await quarantine.mutateAsync({ medicineId, batchId });
        toast.success(`Batch ${batchNumber} quarantined`);
      }}
      trigger={
        <Button variant={expired ? "destructive" : "ghost"} size={size} aria-label={`Quarantine ${medicineName} batch ${batchNumber}`}>
          <ShieldOff /> Quarantine
        </Button>
      }
    />
  );
}
