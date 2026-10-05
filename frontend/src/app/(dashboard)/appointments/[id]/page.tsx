"use client";

import { ArrowUpRight, CalendarClock, ClipboardList, FileText, Receipt, Siren, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AllergyBadges } from "@/components/shared/clinical";
import { AppointmentActions, getAppointmentActions } from "@/components/modules/appointments/appointment-actions";
import { RescheduleDialog } from "@/components/modules/appointments/reschedule-dialog";
import { StatusStepper } from "@/components/modules/appointments/status-stepper";
import { friendlyDate } from "@/components/modules/appointments/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KeyValueGrid, SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ageGender, doctorName, formatCurrency, formatDate, formatDateTime, formatTime, fullName } from "@/lib/format";
import { useAppointment } from "@/services/appointments";
import { useDoctor } from "@/services/doctors";
import { usePatient } from "@/services/patients";
import type { Appointment } from "@/types";

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: appt, isLoading, error, refetch } = useAppointment(id);

  if (isLoading) return <DetailSkeleton />;
  if (error || !appt) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const actions = getAppointmentActions(appt, user);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Appointments", href: ROUTES.appointments }, { label: `${appt.patientName}` }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {appt.patientName}
            <StatusBadge status={appt.status} className="text-sm" />
            {appt.isEmergency && <StatusBadge status="EMERGENCY" label="Emergency" className="text-sm" />}
          </span>
        }
        description={
          <span className="tabular-nums">
            {friendlyDate(appt.date)} · {formatDate(appt.date, "EEEE, dd MMM yyyy")} · {formatTime(appt.startTime)} –{" "}
            {formatTime(appt.endTime)} with {appt.doctorName}
          </span>
        }
        actions={
          <>
            {actions.reschedule && <RescheduleDialog appt={appt} />}
            <AppointmentActions appt={appt} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Status" description={`Last updated ${formatDateTime(appt.updatedAt)}`}>
            <StatusStepper appt={appt} />
          </SectionCard>

          <SectionCard title="Appointment details">
            <KeyValueGrid
              columns={3}
              items={[
                { label: "Date", value: <span className="tabular-nums">{formatDate(appt.date, "EEE, dd MMM yyyy")}</span> },
                {
                  label: "Time",
                  value: <span className="tabular-nums">{`${formatTime(appt.startTime)} – ${formatTime(appt.endTime)}`}</span>,
                },
                {
                  label: "Type",
                  value: appt.isEmergency ? (
                    <span className="text-destructive inline-flex items-center gap-1">
                      <Siren className="size-3.5" aria-hidden /> Emergency
                    </span>
                  ) : appt.type === "FOLLOW_UP" ? (
                    "Follow-up"
                  ) : (
                    "Consultation"
                  ),
                },
                { label: "Department", value: appt.departmentName },
                { label: "Booked", value: <span className="tabular-nums">{formatDateTime(appt.createdAt)}</span> },
                { label: "Reference", value: <span className="font-mono text-xs">{appt.id}</span> },
              ]}
            />
            <div className="mt-4 space-y-3 border-t pt-4">
              <div>
                <p className="text-muted-foreground text-xs">Reason for visit</p>
                <p className="mt-0.5 text-sm break-words whitespace-pre-line">{appt.reason || "—"}</p>
              </div>
              {appt.notes && (
                <div>
                  <p className="text-muted-foreground text-xs">Notes</p>
                  <p className="mt-0.5 text-sm break-words whitespace-pre-line">{appt.notes}</p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <PatientCard patientId={appt.patientId} fallbackName={appt.patientName} mrn={appt.patientMrn} />
          <DoctorCard doctorId={appt.doctorId} fallbackName={appt.doctorName} department={appt.departmentName} />
          <RelatedLinks appt={appt} encounterLabel={actions.encounter} />
        </div>
      </div>
    </>
  );
}

function PatientCard({ patientId, fallbackName, mrn }: { patientId: string; fallbackName: string; mrn: string }) {
  const { can } = useAuth();
  const allowed = can("patients:read");
  const { data: p, isLoading } = usePatient(allowed ? patientId : undefined);
  return (
    <SectionCard
      title="Patient"
      action={
        allowed && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={ROUTES.patient(patientId)}>
              Chart <ArrowUpRight />
            </Link>
          </Button>
        )
      }
    >
      <div className="flex items-start gap-3">
        <UserAvatar name={p ? fullName(p) : fallbackName} className="size-10" />
        <div className="min-w-0 text-sm">
          <p className="font-medium">{p ? fullName(p) : fallbackName}</p>
          <p className="text-muted-foreground tabular-nums">{mrn}</p>
          {isLoading && <Skeleton className="mt-1 h-4 w-32" />}
          {p && (
            <p className="text-muted-foreground tabular-nums">
              {ageGender(p.dob, p.gender)} · {p.phone}
            </p>
          )}
        </div>
      </div>
      {p && (
        <div className="mt-3 space-y-1 border-t pt-3">
          <p className="text-muted-foreground text-xs">Allergies</p>
          <AllergyBadges allergies={p.allergies} />
        </div>
      )}
    </SectionCard>
  );
}

function DoctorCard({ doctorId, fallbackName, department }: { doctorId: string; fallbackName: string; department: string }) {
  const { data: d } = useDoctor(doctorId);
  return (
    <SectionCard
      title="Doctor"
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link href={ROUTES.doctor(doctorId)}>
            Profile <ArrowUpRight />
          </Link>
        </Button>
      }
    >
      <div className="flex items-start gap-3">
        <UserAvatar name={d ? doctorName(d) : fallbackName} className="size-10" />
        <div className="min-w-0 text-sm">
          <p className="font-medium">{d ? doctorName(d) : fallbackName}</p>
          <p className="text-muted-foreground">{d?.specialisation ?? department}</p>
          {d && <p className="text-muted-foreground tabular-nums">Fee {formatCurrency(d.consultationFee)}</p>}
        </div>
      </div>
    </SectionCard>
  );
}

function RelatedLinks({ appt, encounterLabel }: { appt: Appointment; encounterLabel: string | null }) {
  const { can } = useAuth();
  const links: { href: string; label: string; icon: typeof FileText; hint?: string }[] = [];
  if (encounterLabel) links.push({ href: ROUTES.encounter(appt.id), label: encounterLabel, icon: Stethoscope });
  if (appt.medicalRecordId && !encounterLabel && can("patients:read"))
    links.push({ href: ROUTES.patient(appt.patientId), label: "Medical record", icon: ClipboardList, hint: "In the patient chart" });
  if (appt.invoiceId && can("billing:read")) links.push({ href: ROUTES.invoice(appt.invoiceId), label: "Invoice", icon: Receipt });
  links.push({
    href: `${ROUTES.appointments}?date=${appt.date}&doctorId=${appt.doctorId}&view=board`,
    label: "Doctor's day",
    icon: CalendarClock,
    hint: friendlyDate(appt.date),
  });

  return (
    <SectionCard title="Related">
      <ul className="-mx-2 space-y-0.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="hover:bg-muted focus-visible:ring-ring/50 flex min-h-9 items-center gap-2.5 rounded-md px-2 py-1.5 text-sm focus-visible:ring-3 focus-visible:outline-none"
            >
              <l.icon className="text-muted-foreground size-4" aria-hidden />
              <span className="flex-1 font-medium">{l.label}</span>
              {l.hint && <span className="text-muted-foreground text-xs">{l.hint}</span>}
              <ArrowUpRight className="text-muted-foreground size-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
