"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Eye, Loader2, PlayCircle, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AttachmentsSection } from "@/components/modules/emr/attachments-section";
import { ClinicalNotesSection } from "@/components/modules/emr/clinical-notes-section";
import { EncounterBanner } from "@/components/modules/emr/encounter-banner";
import { LabOrdersSection } from "@/components/modules/emr/lab-orders-section";
import { AddNoteForm, NotesTimeline } from "@/components/modules/emr/notes-timeline";
import { PatientHistory } from "@/components/modules/emr/patient-history";
import { VitalsForm } from "@/components/modules/emr/vitals-form";
import { PrescriptionBuilder } from "@/components/modules/prescriptions/prescription-builder";
import { VitalsPanel } from "@/components/shared/clinical";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";
import { humanize } from "@/lib/format";
import { useAppointment, useUpdateAppointmentStatus } from "@/services/appointments";
import { useAddRecordNote, useFinaliseRecord, useRecordByAppointment, useRecordVitals } from "@/services/emr";
import { usePatient } from "@/services/patients";
import type { Allergy, MedicalRecord } from "@/types";

const isVersionConflict = (err: unknown) => err instanceof ApiError && err.code === "VERSION_CONFLICT";

export default function EncounterPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user } = useAuth();
  const apptQ = useAppointment(appointmentId);
  const appt = apptQ.data;
  const patientQ = usePatient(appt?.patientId);
  const hasRecord = !!appt && (!!appt.medicalRecordId || appt.status === "IN_PROGRESS" || appt.status === "COMPLETED");
  const recordQ = useRecordByAppointment(appointmentId, { enabled: hasRecord });
  const record = recordQ.data;

  const statusMut = useUpdateAppointmentStatus();
  const finalise = useFinaliseRecord(record?.id ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const onDirtyChange = useCallback((d: boolean) => setNotesDirty(d), []);

  const isTreating = !!user?.doctorId && user.doctorId === appt?.doctorId;
  const editable = isTreating && !!record && !record.isFinalised;

  const allergies = useMemo<Allergy[]>(() => {
    const all = [...(patientQ.data?.allergies ?? []), ...(record?.allergiesNoted ?? [])];
    return all.filter((a, i) => all.findIndex((b) => b.substance.toLowerCase() === a.substance.toLowerCase()) === i);
  }, [patientQ.data?.allergies, record?.allergiesNoted]);

  if (apptQ.isLoading || (appt && patientQ.isLoading)) return <DetailSkeleton />;
  if (apptQ.error || !appt) return <ErrorState error={apptQ.error ?? new Error("Appointment not found")} onRetry={() => apptQ.refetch()} />;
  if (patientQ.error || !patientQ.data)
    return <ErrorState error={patientQ.error ?? new Error("Patient not found")} onRetry={() => patientQ.refetch()} />;
  const patient = patientQ.data;

  const start = async () => {
    try {
      await statusMut.mutateAsync({ id: appt.id, status: "IN_PROGRESS", version: appt.version });
      toast.success("Encounter started");
      void recordQ.refetch();
    } catch (err) {
      if (isVersionConflict(err)) void apptQ.refetch();
    }
  };

  const complete = async () => {
    try {
      if (record && !record.isFinalised) await finalise.mutateAsync(undefined);
      await statusMut.mutateAsync({ id: appt.id, status: "COMPLETED", version: appt.version });
      toast.success("Visit completed", { description: "The record is finalised and the consultation has been billed." });
    } catch (err) {
      if (isVersionConflict(err)) void apptQ.refetch();
      throw err;
    }
  };

  const diagnosisCount = record?.diagnoses.length ?? 0;
  const completeBlocked =
    diagnosisCount === 0 ? "Add and save at least one diagnosis first." : notesDirty ? "Save your clinical notes first." : undefined;

  const actions = isTreating && (
    <>
      {appt.status === "CONFIRMED" && (
        <Button onClick={start} disabled={statusMut.isPending}>
          {statusMut.isPending ? <Loader2 className="animate-spin" /> : <PlayCircle />}
          Start encounter
        </Button>
      )}
      {appt.status === "IN_PROGRESS" && record && (
        <div className="flex flex-col items-start gap-1 xl:items-end">
          <ConfirmDialog
            trigger={
              <Button disabled={!!completeBlocked} aria-describedby={completeBlocked ? "complete-hint" : undefined}>
                <CheckCircle2 /> Complete visit
              </Button>
            }
            title="Complete this visit?"
            description="The clinical record will be finalised and become read-only. Later changes can only be added as addendum notes. The consultation fee is added to the patient's bill."
            confirmLabel="Finalise & complete"
            onConfirm={complete}
          />
          {completeBlocked && (
            <p id="complete-hint" className="text-muted-foreground text-xs">
              {completeBlocked}
            </p>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="no-print text-muted-foreground text-xs">
        <Link href={ROUTES.appointments} className="hover:text-foreground">
          Appointments
        </Link>
        <span aria-hidden> / </span>
        <Link href={ROUTES.appointment(appt.id)} className="hover:text-foreground">
          {appt.patientName}
        </Link>
        <span aria-hidden> / </span>
        <span aria-current="page">Encounter</span>
      </nav>

      <EncounterBanner patient={patient} appointment={appt} allergies={allergies} actions={actions} showNav={!!record} />

      {!isTreating && (
        <Alert>
          <Eye aria-hidden />
          <AlertTitle>Read-only</AlertTitle>
          <AlertDescription>This is {appt.doctorName}&apos;s encounter. Only the treating doctor can make changes.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          {!hasRecord ? (
            <NotStarted status={appt.status} isTreating={isTreating} onStart={start} pending={statusMut.isPending} />
          ) : recordQ.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : recordQ.error && !(recordQ.error instanceof ApiError && recordQ.error.status === 404) ? (
            <ErrorState error={recordQ.error} onRetry={() => recordQ.refetch()} />
          ) : !record ? (
            <NotStarted status={appt.status} isTreating={isTreating} onStart={start} pending={statusMut.isPending} />
          ) : (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div id="vitals" className="scroll-mt-64">
                <VitalsSection record={record} editable={editable} />
              </div>
              <div id="clinical-notes" className="scroll-mt-64">
                <ClinicalNotesSection record={record} editable={editable} onDirtyChange={onDirtyChange} />
              </div>
              <div id="notes" className="scroll-mt-64">
                <NotesSection record={record} canAdd={isTreating} />
              </div>
              <div id="attachments" className="scroll-mt-64">
                <AttachmentsSection record={record} canUpload={isTreating} />
              </div>
              <div id="prescription" className="scroll-mt-64">
                <PrescriptionBuilder record={record} allergies={allergies} canPrescribe={editable} />
              </div>
              <div id="lab-orders" className="scroll-mt-64">
                <LabOrdersSection record={record} canOrder={editable} />
              </div>
            </motion.div>
          )}
        </div>
        <aside className="min-w-0 space-y-4" aria-label="Patient history">
          <PatientHistory patientId={patient.id} excludeRecordId={record?.id} />
        </aside>
      </div>
    </div>
  );
}

function NotStarted({
  status,
  isTreating,
  onStart,
  pending,
}: {
  status: string;
  isTreating: boolean;
  onStart: () => void;
  pending: boolean;
}) {
  if (status === "CONFIRMED") {
    return (
      <SectionCard title="Encounter not started">
        <EmptyState
          icon={Stethoscope}
          title="Ready when you are"
          description={
            isTreating
              ? "Starting the encounter opens the patient's record for this visit so you can capture vitals, notes and orders."
              : "The treating doctor hasn't started this encounter yet."
          }
          action={
            isTreating ? (
              <Button onClick={onStart} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <PlayCircle />}
                Start encounter
              </Button>
            ) : undefined
          }
        />
      </SectionCard>
    );
  }
  const copy: Record<string, string> = {
    PENDING: "This appointment hasn't been confirmed by the front desk yet.",
    CANCELLED: "This appointment was cancelled.",
    NO_SHOW: "The patient didn't attend this appointment.",
  };
  return (
    <SectionCard title="No encounter">
      <EmptyState
        icon={Stethoscope}
        title={`Appointment ${humanize(status).toLowerCase()}`}
        description={copy[status] ?? "There is no clinical record for this appointment."}
      />
    </SectionCard>
  );
}

function VitalsSection({ record, editable }: { record: MedicalRecord; editable: boolean }) {
  const recordVitals = useRecordVitals(record.id);
  const latest = record.vitals[0];
  return (
    <SectionCard title="Vitals" description={record.vitals.length > 1 ? `${record.vitals.length} readings this visit` : undefined}>
      <div className="space-y-4">
        <VitalsPanel vitals={latest} />
        {editable && (
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">Record vitals</h3>
            <VitalsForm
              idPrefix="enc-vitals"
              defaultHeightCm={latest?.heightCm}
              onSubmit={async (body) => {
                await recordVitals.mutateAsync(body);
                toast.success("Vitals recorded");
              }}
            />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function NotesSection({ record, canAdd }: { record: MedicalRecord; canAdd: boolean }) {
  const addNote = useAddRecordNote(record.id);
  const label = record.isFinalised ? "Add addendum" : "Add note";
  return (
    <SectionCard title="Notes" description="Append-only. Notes can't be edited or deleted once added.">
      <div className="space-y-4">
        <NotesTimeline notes={record.notes} emptyLabel="No notes for this visit yet." />
        {canAdd && (
          <div className="border-t pt-4">
            <AddNoteForm
              id="enc-note"
              label={label}
              description={record.isFinalised ? "The record is finalised. Addenda are time-stamped and attributed to you." : undefined}
              placeholder={record.isFinalised ? "Addendum…" : "Progress note, counselling given, discussion with family…"}
              onSubmit={async (text) => {
                await addNote.mutateAsync({ text });
                toast.success(record.isFinalised ? "Addendum added" : "Note added");
              }}
            />
          </div>
        )}
      </div>
    </SectionCard>
  );
}
