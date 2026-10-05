"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BookingFlow } from "@/components/modules/appointments/booking-flow";
import { PageHeader } from "@/components/shared/page-header";
import { DetailSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

function PortalBooking() {
  const params = useSearchParams();
  return <BookingFlow mode="patient" initialDoctorId={params.get("doctorId") ?? undefined} />;
}

export default function PortalBookPage() {
  return (
    <>
      <PageHeader
        title="Book an appointment"
        description="Choose a doctor and a time that suits you. The hospital confirms every online request."
        breadcrumbs={[{ label: "My health", href: ROUTES.portal }, { label: "Book appointment" }]}
        actions={
          <Button variant="outline" asChild>
            <Link href={ROUTES.portalAppointments}>
              <CalendarDays /> My appointments
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<DetailSkeleton />}>
        <PortalBooking />
      </Suspense>
    </>
  );
}
