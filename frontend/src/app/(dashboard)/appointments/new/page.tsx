"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BookingFlow } from "@/components/modules/appointments/booking-flow";
import { PageHeader } from "@/components/shared/page-header";
import { DetailSkeleton } from "@/components/shared/states";
import { ROUTES } from "@/constants/routes";

function NewAppointment() {
  const params = useSearchParams();
  return (
    <BookingFlow
      mode="staff"
      initialPatientId={params.get("patientId") ?? undefined}
      initialDoctorId={params.get("doctorId") ?? undefined}
    />
  );
}

export default function NewAppointmentPage() {
  return (
    <>
      <PageHeader
        title="Book appointment"
        description="Find an open slot and book it for a patient. Emergencies skip slot selection."
        breadcrumbs={[{ label: "Appointments", href: ROUTES.appointments }, { label: "New" }]}
      />
      <Suspense fallback={<DetailSkeleton />}>
        <NewAppointment />
      </Suspense>
    </>
  );
}
