"use client";

import { BadgeCheck, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useUpdateHospitalStatus } from "@/services/admin";
import type { Hospital } from "@/types";

/** Verify / suspend / reactivate a tenant. Shared by the hospitals list and detail page. */
export function HospitalStatusActions({ hospital, size = "default" }: { hospital: Hospital; size?: "default" | "xs" | "sm" }) {
  const mutation = useUpdateHospitalStatus();

  if (hospital.status === "ACTIVE") {
    return (
      <ConfirmDialog
        title={`Suspend ${hospital.name}?`}
        description="All staff and patients of this hospital lose access immediately. Their data is kept and access returns when you reactivate the tenant."
        confirmLabel="Suspend hospital"
        destructive
        onConfirm={async () => {
          await mutation.mutateAsync({ id: hospital.id, status: "SUSPENDED" });
          toast.success(`${hospital.name} suspended`);
        }}
        trigger={
          <Button size={size} variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Ban /> Suspend
          </Button>
        }
      />
    );
  }

  const verifying = hospital.status === "PENDING_VERIFICATION";
  return (
    <ConfirmDialog
      title={verifying ? `Verify ${hospital.name}?` : `Reactivate ${hospital.name}?`}
      description={
        verifying
          ? `Confirm you've checked registration number ${hospital.registrationNumber}. The tenant goes live and the hospital admin is notified.`
          : "Staff and patients regain access straight away."
      }
      confirmLabel={verifying ? "Verify & activate" : "Reactivate"}
      onConfirm={async () => {
        await mutation.mutateAsync({ id: hospital.id, status: "ACTIVE" });
        toast.success(verifying ? `${hospital.name} verified and active` : `${hospital.name} reactivated`);
      }}
      trigger={
        <Button size={size} variant={verifying ? "default" : "outline"}>
          {verifying ? <BadgeCheck /> : <RotateCcw />}
          {verifying ? "Verify" : "Reactivate"}
        </Button>
      }
    />
  );
}
