"use client";

import { ArrowUpRight, CalendarCog, CalendarPlus, CalendarX2, Siren } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { friendlyDate, isDeskRole, shiftISODate, todayISO } from "@/components/modules/appointments/utils";
import { AcceptingBadge, DoctorLanguages, DoctorRating } from "@/components/modules/doctors/doctor-bits";
import { DoctorEditDialog } from "@/components/modules/doctors/doctor-edit-dialog";
import { WeeklyScheduleSummary } from "@/components/modules/doctors/weekly-schedule-summary";
import { PageHeader } from "@/components/shared/page-header";
import { KeyValueGrid, SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { doctorName, formatCurrency, formatTime } from "@/lib/format";
import { useDepartments } from "@/services/admin";
import { useAppointments } from "@/services/appointments";
import { useAvailability, useDoctor } from "@/services/doctors";

export default function DoctorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user, can } = useAuth();
  const { data: doctor, isLoading, error, refetch } = useDoctor(id);
  const availability = useAvailability(id);
  const departments = useDepartments();

  if (isLoading) return <DetailSkeleton />;
  if (error || !doctor) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const name = doctorName(doctor);
  const isSelf = user?.role === "DOCTOR" && user.doctorId === doctor.id;
  const canEdit = user?.role === "HOSPITAL_ADMIN" || isSelf;
  const canManageAvailability = user?.role === "HOSPITAL_ADMIN" || isSelf;
  const bookHref = isDeskRole(user?.role)
    ? `${ROUTES.appointmentNew}?doctorId=${doctor.id}`
    : user?.role === "PATIENT"
      ? `${ROUTES.portalBook}?doctorId=${doctor.id}`
      : null;
  const deptNames = doctor.departmentIds.map((d) => departments.data?.find((x) => x.id === d)?.name ?? d);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Doctors", href: ROUTES.doctors }, { label: name }]}
        title={name}
        description={`${doctor.specialisation} · ${doctor.qualification}`}
        actions={
          <>
            {canEdit && <DoctorEditDialog doctor={doctor} />}
            {canManageAvailability && (
              <Button variant="outline" asChild>
                <Link href={isSelf ? ROUTES.availability : `${ROUTES.availability}?doctorId=${doctor.id}`}>
                  <CalendarCog /> Availability
                </Link>
              </Button>
            )}
            {bookHref && doctor.isAcceptingPatients && (
              <Button asChild>
                <Link href={bookHref}>
                  <CalendarPlus /> Book with this doctor
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Profile">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <UserAvatar name={name} className="size-16 text-base" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <DoctorRating rating={doctor.rating} />
                  <span className="text-muted-foreground tabular-nums">{doctor.experienceYears} years experience</span>
                  <AcceptingBadge doctor={doctor} />
                </div>
                <p className="text-muted-foreground text-sm whitespace-pre-line">{doctor.bio || "No bio added yet."}</p>
                <div className="flex flex-wrap gap-1.5">
                  {deptNames.map((d) => (
                    <Badge key={d} variant="secondary">
                      {d}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <KeyValueGrid
              columns={3}
              className="mt-4 border-t pt-4"
              items={[
                { label: "Consultation fee", value: <span className="tabular-nums">{formatCurrency(doctor.consultationFee)}</span> },
                {
                  label: "Follow-up fee",
                  value: <span className="tabular-nums">{formatCurrency(Math.round(doctor.consultationFee * 0.5))}</span>,
                },
                { label: "Languages", value: <DoctorLanguages languages={doctor.languages} className="text-foreground" /> },
                { label: "Qualification", value: doctor.qualification },
                { label: "Registration no.", value: <span className="tabular-nums">{doctor.registrationNumber}</span> },
                ...(user?.role !== "PATIENT"
                  ? [
                      {
                        label: "Email",
                        value: (
                          <a className="text-primary hover:underline" href={`mailto:${doctor.email}`}>
                            {doctor.email}
                          </a>
                        ),
                      },
                      { label: "Phone", value: <span className="tabular-nums">{doctor.phone}</span> },
                    ]
                  : []),
              ]}
            />
            {canEdit && (
              <div className="mt-4 border-t pt-4">
                <p className="text-muted-foreground text-xs">Signature (on prescriptions)</p>
                {doctor.signatureDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL
                  <img
                    src={doctor.signatureDataUrl}
                    alt={`Signature of ${name}`}
                    className="bg-background mt-1 h-12 max-w-48 rounded border object-contain p-1"
                  />
                ) : (
                  <p className="mt-0.5 text-sm">Not uploaded</p>
                )}
              </div>
            )}
          </SectionCard>

          {can("appointments:read") && user?.role !== "PATIENT" && <UpcomingAppointments doctorId={doctor.id} />}
        </div>

        <SectionCard
          title="Weekly availability"
          action={
            canManageAvailability && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={isSelf ? ROUTES.availability : `${ROUTES.availability}?doctorId=${doctor.id}`}>
                  Edit <ArrowUpRight />
                </Link>
              </Button>
            )
          }
        >
          {availability.isLoading ? (
            <Skeleton className="h-64" />
          ) : availability.error || !availability.data ? (
            <ErrorState error={availability.error} onRetry={() => void availability.refetch()} className="py-6" />
          ) : availability.data.rules.length === 0 ? (
            <EmptyState icon={CalendarX2} title="No weekly schedule" description="This doctor has no bookable hours yet." compact />
          ) : (
            <WeeklyScheduleSummary
              rules={availability.data.rules}
              exceptions={availability.data.exceptions}
              departments={departments.data}
            />
          )}
        </SectionCard>
      </div>
    </>
  );
}

function UpcomingAppointments({ doctorId }: { doctorId: string }) {
  const today = todayISO();
  const { data, isLoading, error, refetch } = useAppointments({
    doctorId,
    from: today,
    to: shiftISODate(today, 7),
    status: ["PENDING", "CONFIRMED", "IN_PROGRESS"],
    limit: 12,
  });
  return (
    <SectionCard
      title="Upcoming appointments"
      description="Today and the next 7 days"
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${ROUTES.appointments}?doctorId=${doctorId}`}>
            All <ArrowUpRight />
          </Link>
        </Button>
      }
      contentClassName="p-0"
    >
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} className="py-6" />
      ) : !data?.data.length ? (
        <EmptyState icon={CalendarX2} title="Nothing booked" description="No upcoming appointments this week." compact />
      ) : (
        <ul className="divide-y">
          {data.data.map((a) => (
            <li key={a.id}>
              <Link
                href={ROUTES.appointment(a.id)}
                className="hover:bg-muted/50 focus-visible:bg-muted/50 flex items-center gap-3 px-4 py-2.5 text-sm focus-visible:outline-none"
              >
                <div className="w-24 shrink-0 tabular-nums">
                  <p className="font-medium">{formatTime(a.startTime)}</p>
                  <p className="text-muted-foreground text-xs">{friendlyDate(a.date)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.patientName}</p>
                  <p className="text-muted-foreground truncate text-xs">{a.reason}</p>
                </div>
                {a.isEmergency && <Siren className="text-destructive size-4" aria-label="Emergency" />}
                <StatusBadge status={a.status} />
              </Link>
            </li>
          ))}
          {data.meta.total > data.data.length && (
            <li className="text-muted-foreground px-4 py-2 text-xs tabular-nums">+{data.meta.total - data.data.length} more this week</li>
          )}
        </ul>
      )}
    </SectionCard>
  );
}
