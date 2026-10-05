"use client";

import { ClipboardList, LogOut, Pill } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AddNoteForm, NotesTimeline } from "@/components/modules/emr/notes-timeline";
import { VitalsForm } from "@/components/modules/emr/vitals-form";
import { AdministerMedicationDialog } from "@/components/modules/wards/administer-medication-dialog";
import { VitalsTrend } from "@/components/modules/wards/vitals-trend";
import { AllergyBadges, VitalsPanel } from "@/components/shared/clinical";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { KeyValueGrid, SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ageGender, formatDateTime, formatRelative } from "@/lib/format";
import { useAddAdmissionNote, useAdmission, useDischargePatient, useRecordAdmissionVitals } from "@/services/misc";
import { usePatient } from "@/services/patients";

export default function AdmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role, can } = useAuth();
  const { data: adm, isLoading, error, refetch } = useAdmission(id);
  const patient = usePatient(adm?.patientId);
  const recordVitals = useRecordAdmissionVitals(id);
  const addNote = useAddAdmissionNote(id);
  const discharge = useDischargePatient();

  if (isLoading) return <DetailSkeleton />;
  if (error || !adm) return <ErrorState error={error ?? new Error("Admission not found")} onRetry={() => refetch()} />;

  const active = adm.status === "ADMITTED";
  const clinician = role === "DOCTOR" || role === "NURSE";
  const latest = adm.vitals[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title={adm.patientName}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-foreground font-mono">{adm.patientMrn}</span>
            {patient.data && <span className="tabular-nums">{ageGender(patient.data.dob, patient.data.gender)}</span>}
            <span>
              {adm.wardName} · bed <span className="font-mono">{adm.bedNumber}</span>
            </span>
            <StatusBadge status={adm.status} />
          </span>
        }
        breadcrumbs={[{ label: "Wards", href: ROUTES.wards }, { label: `${adm.wardName} · ${adm.bedNumber}` }]}
        actions={
          <>
            {can("patients:read") && (
              <Button variant="outline" size="sm" asChild>
                <Link href={ROUTES.patient(adm.patientId)}>Patient chart</Link>
              </Button>
            )}
            {active && clinician && (
              <ConfirmDialog
                trigger={
                  <Button variant="destructive" size="sm">
                    <LogOut /> Discharge
                  </Button>
                }
                title={`Discharge ${adm.patientName}?`}
                description={`Bed ${adm.bedNumber} in ${adm.wardName} will be freed. Vitals, medications and notes can't be added after discharge.`}
                confirmLabel="Discharge patient"
                destructive
                onConfirm={async () => {
                  await discharge.mutateAsync(adm.id);
                  toast.success(`${adm.patientName} discharged`);
                }}
              />
            )}
          </>
        }
      />

      <Card className="gap-0 p-0">
        <div className="p-4 sm:p-5">
          <KeyValueGrid
            columns={4}
            items={[
              { label: "Admitting diagnosis", value: adm.diagnosis },
              { label: "Attending doctor", value: adm.attendingDoctorName },
              { label: "Admitted", value: `${formatDateTime(adm.admittedAt)} (${formatRelative(adm.admittedAt)})` },
              { label: adm.dischargedAt ? "Discharged" : "Status", value: adm.dischargedAt ? formatDateTime(adm.dischargedAt) : "In ward" },
            ]}
          />
        </div>
        <div className="bg-muted/30 flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Allergies</span>
          {patient.data ? (
            <AllergyBadges allergies={patient.data.allergies} />
          ) : (
            <span className="text-muted-foreground text-sm">Loading…</span>
          )}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard
            title="Vitals"
            description={latest ? `Last recorded ${formatRelative(latest.recordedAt)}` : "No vitals recorded yet"}
          >
            <div className="space-y-5">
              <VitalsPanel vitals={latest} />
              <VitalsTrend vitals={adm.vitals} />
              {active && can("vitals:write") && (
                <Collapsible defaultOpen={!latest} className="border-t pt-4">
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      Record vitals
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <VitalsForm
                      idPrefix="adm-vitals"
                      defaultHeightCm={adm.vitals.find((v) => v.heightCm)?.heightCm}
                      onSubmit={async (body) => {
                        await recordVitals.mutateAsync(body);
                        toast.success("Vitals recorded");
                      }}
                    />
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Medication administration record"
            description="Doses given on the ward, newest first."
            action={
              active && can("wards:manage") ? (
                <AdministerMedicationDialog admissionId={adm.id} patientName={adm.patientName} allergies={patient.data?.allergies} />
              ) : undefined
            }
            contentClassName="p-0"
          >
            {adm.medicationLog.length === 0 ? (
              <EmptyState compact icon={Pill} title="No doses recorded" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Medication administration record</caption>
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left font-semibold">
                        Time
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-semibold">
                        Medicine
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-semibold">
                        Dose
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-semibold">
                        Route
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-semibold">
                        Given by
                      </th>
                      <th scope="col" className="px-4 py-2 text-left font-semibold">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...adm.medicationLog]
                      .sort((a, b) => b.administeredAt.localeCompare(a.administeredAt))
                      .map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="px-4 py-2 whitespace-nowrap tabular-nums">{formatDateTime(m.administeredAt)}</td>
                          <td className="px-4 py-2 font-medium">{m.medicine}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{m.dose}</td>
                          <td className="px-4 py-2">{m.route}</td>
                          <td className="text-muted-foreground px-4 py-2 whitespace-nowrap">{m.nurseName}</td>
                          <td className="text-muted-foreground px-4 py-2">{m.notes ?? "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Nursing notes" description="Append-only progress and handover notes.">
          <div className="space-y-4">
            {active && clinician && (
              <div className="border-b pb-4">
                <AddNoteForm
                  id="adm-note"
                  label="Add note"
                  placeholder="Observation, handover, family communication…"
                  onSubmit={async (text) => {
                    await addNote.mutateAsync({ text });
                    toast.success("Note added");
                  }}
                />
              </div>
            )}
            {adm.nursingNotes.length === 0 ? (
              <EmptyState compact icon={ClipboardList} title="No notes yet" />
            ) : (
              <NotesTimeline notes={adm.nursingNotes} newestFirst />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
