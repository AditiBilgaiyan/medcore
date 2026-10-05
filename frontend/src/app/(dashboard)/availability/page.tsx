"use client";

import { ArrowUpRight, CalendarCog } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AvailabilityEditor } from "@/components/modules/doctors/availability-editor";
import { AvailabilityExceptions, AvailabilityPreview } from "@/components/modules/doctors/availability-exceptions";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { doctorName } from "@/lib/format";
import { useDepartments } from "@/services/admin";
import { useAvailability, useDoctor, useDoctors } from "@/services/doctors";

function AvailabilityView() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const isDoctor = user?.role === "DOCTOR";
  const doctorId = isDoctor ? user?.doctorId : (params.get("doctorId") ?? undefined);

  const doctors = useDoctors({}, { enabled: !isDoctor });
  const doctor = useDoctor(doctorId);
  const availability = useAvailability(doctorId);
  const departments = useDepartments();

  const pickDoctor = (id: string) => router.replace(`${pathname}?doctorId=${id}`, { scroll: false });

  return (
    <>
      <PageHeader
        title={isDoctor ? "My availability" : "Doctor availability"}
        description="Weekly schedule, leave and a live preview of bookable slots."
        actions={
          doctorId && (
            <Button variant="outline" asChild>
              <Link href={ROUTES.doctor(doctorId)}>
                {isDoctor ? "My profile" : "Doctor profile"} <ArrowUpRight />
              </Link>
            </Button>
          )
        }
      />

      {!isDoctor && (
        <div className="mb-4 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <Label htmlFor="avail-doctor">Doctor</Label>
          <Select value={doctorId ?? ""} onValueChange={pickDoctor}>
            <SelectTrigger id="avail-doctor" className="w-full sm:w-80">
              <SelectValue placeholder={doctors.isLoading ? "Loading doctors…" : "Choose a doctor"} />
            </SelectTrigger>
            <SelectContent>
              {doctors.data?.data.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {doctorName(d)} · {d.specialisation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!doctorId ? (
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={CalendarCog}
            title={isDoctor ? "No doctor profile linked" : "Choose a doctor"}
            description={
              isDoctor
                ? "Your account isn't linked to a doctor profile. Ask your hospital admin."
                : "Pick a doctor above to edit their weekly schedule and leave."
            }
          />
        </div>
      ) : doctor.isLoading || availability.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-[32rem] xl:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      ) : doctor.error || availability.error || !doctor.data || !availability.data ? (
        <ErrorState
          error={doctor.error ?? availability.error}
          onRetry={() => {
            void doctor.refetch();
            void availability.refetch();
          }}
        />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <SectionCard
            className="xl:col-span-2"
            title={`Weekly schedule · ${doctorName(doctor.data)}`}
            description="Blocks repeat every week. Patients can book slots inside them."
          >
            <AvailabilityEditor key={doctor.data.id} doctor={doctor.data} rules={availability.data.rules} departments={departments.data} />
          </SectionCard>
          <div className="space-y-4">
            <SectionCard title="Leave & blocked days" description="No slots are offered on these dates.">
              <AvailabilityExceptions doctorId={doctor.data.id} exceptions={availability.data.exceptions} />
            </SectionCard>
            <SectionCard title="Slot preview">
              <AvailabilityPreview doctorId={doctor.data.id} />
            </SectionCard>
          </div>
        </div>
      )}
    </>
  );
}

export default function AvailabilityPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <AvailabilityView />
    </Suspense>
  );
}
