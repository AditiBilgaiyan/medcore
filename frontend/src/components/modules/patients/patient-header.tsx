"use client";

import { Archive, CalendarPlus, Droplet, Pencil, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AllergyBadges } from "@/components/shared/clinical";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ageGender, formatDate, fullName } from "@/lib/format";
import { useArchivePatient, useUpdatePatient } from "@/services/patients";
import type { Patient } from "@/types";
import { PatientForm, patientToFormValues } from "./patient-form";

const EDIT_ROLES = ["HOSPITAL_ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE"];

export function PatientHeader({ patient }: { patient: Patient }) {
  const { can, role } = useAuth();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const update = useUpdatePatient();
  const archive = useArchivePatient();
  const name = fullName(patient);
  const insuranceExpired = patient.insurance && patient.insurance.validTill < new Date().toISOString().slice(0, 10);

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <UserAvatar name={name} className="size-12 text-base" />
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">{name}</h1>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-foreground font-mono">{patient.mrn}</span>
              <span className="tabular-nums">{ageGender(patient.dob, patient.gender)}</span>
              <span className="inline-flex items-center gap-1">
                <Droplet className="size-3.5" aria-hidden />
                <span className="sr-only">Blood group</span>
                {patient.bloodGroup ?? "Unknown"}
              </span>
              <a href={`tel:${patient.phone}`} className="hover:text-foreground inline-flex items-center gap-1 tabular-nums">
                <Phone className="size-3.5" aria-hidden />
                {patient.phone}
              </a>
            </p>
            {patient.insurance && (
              <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
                <ShieldCheck className="size-3.5" aria-hidden />
                {patient.insurance.provider} · {patient.insurance.policyNumber} ·{" "}
                <span className={insuranceExpired ? "text-destructive font-medium" : undefined}>
                  {insuranceExpired ? "expired" : "valid till"} {formatDate(patient.insurance.validTill)}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="no-print flex flex-wrap gap-2">
          {role && EDIT_ROLES.includes(role) && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
          )}
          {can("appointments:create") && (
            <Button size="sm" asChild>
              <Link href={`${ROUTES.appointmentNew}?patientId=${patient.id}`}>
                <CalendarPlus /> Book appointment
              </Link>
            </Button>
          )}
          {role === "HOSPITAL_ADMIN" && (
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="sm">
                  <Archive /> Archive
                </Button>
              }
              title={`Archive ${name}?`}
              description="The patient is hidden from search and booking. Medical records are kept and never deleted. This is recorded in the audit log."
              confirmLabel="Archive patient"
              destructive
              onConfirm={async () => {
                await archive.mutateAsync(patient.id);
                toast.success(`${name} archived`);
                router.push(ROUTES.patients);
              }}
            />
          )}
        </div>
      </div>

      <div className="bg-muted/30 flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Allergies</span>
        <AllergyBadges allergies={patient.allergies} />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit patient</DialogTitle>
            <DialogDescription>
              {name} · {patient.mrn}
            </DialogDescription>
          </DialogHeader>
          {editOpen && (
            <PatientForm
              variant="dialog"
              idPrefix="edit-patient"
              defaultValues={patientToFormValues(patient)}
              submitLabel="Save changes"
              onCancel={() => setEditOpen(false)}
              onSubmit={async (body) => {
                // `null` clears a removed policy (undefined would be dropped from the JSON body).
                await update.mutateAsync({ id: patient.id, ...body, insurance: body.insurance ?? null });
                toast.success("Patient details updated");
                setEditOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
