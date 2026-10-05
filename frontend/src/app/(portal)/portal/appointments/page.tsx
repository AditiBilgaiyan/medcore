"use client";

import { CalendarPlus, CalendarRange, History } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AppointmentCard } from "@/components/modules/portal/appointment-card";
import { FadeIn, InfoNote, ListSkeleton, Pager } from "@/components/modules/portal/portal-ui";
import { addDaysIso, todayIso } from "@/components/modules/portal/portal-utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/constants/routes";
import { useAppointments } from "@/services/appointments";

const PAGE_SIZE = 10;

function BookButton() {
  return (
    <Button size="lg" asChild>
      <Link href={ROUTES.portalBook}>
        <CalendarPlus /> Book appointment
      </Link>
    </Button>
  );
}

function UpcomingList() {
  const [page, setPage] = useState(1);
  const q = useAppointments({
    from: todayIso(),
    status: ["PENDING", "CONFIRMED", "IN_PROGRESS"],
    sortOrder: "asc",
    page,
    limit: PAGE_SIZE,
  });

  if (q.isLoading) return <ListSkeleton />;
  if (q.error && !q.data)
    return (
      <Card className="p-0">
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Card>
    );
  const list = q.data?.data ?? [];
  if (!list.length) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={CalendarRange}
          title="No upcoming appointments"
          description="When you book a visit it will show here, along with options to change or cancel it."
          action={<BookButton />}
        />
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {list.map((a, i) => (
        <FadeIn key={a.id} delay={Math.min(i, 5) * 0.03}>
          <AppointmentCard appointment={a} />
        </FadeIn>
      ))}
      <Pager meta={q.data?.meta} onPageChange={setPage} label="appointments" />
    </div>
  );
}

function PastList() {
  const [page, setPage] = useState(1);
  // Everything before today, plus today's visits that are already finished.
  const q = useAppointments({ to: addDaysIso(-1), sortOrder: "desc", page, limit: PAGE_SIZE });
  const today = useAppointments({ date: todayIso(), status: ["COMPLETED", "CANCELLED", "NO_SHOW"], sortOrder: "desc" });

  if (q.isLoading) return <ListSkeleton />;
  if (q.error && !q.data)
    return (
      <Card className="p-0">
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Card>
    );
  const list = [...(page === 1 ? (today.data?.data ?? []) : []), ...(q.data?.data ?? [])];
  if (!list.length) {
    return (
      <Card className="p-0">
        <EmptyState icon={History} title="No past appointments" description="Your completed and cancelled visits will be listed here." />
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {list.map((a, i) => (
        <FadeIn key={a.id} delay={Math.min(i, 5) * 0.03}>
          <AppointmentCard appointment={a} showActions={false} />
        </FadeIn>
      ))}
      <Pager meta={q.data?.meta} onPageChange={setPage} label="appointments" />
    </div>
  );
}

export default function PortalAppointmentsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="My appointments"
        description="See your visits, change a time or cancel if your plans change."
        breadcrumbs={[{ label: "Home", href: ROUTES.portal }, { label: "Appointments" }]}
        actions={<BookButton />}
      />
      <Tabs defaultValue="upcoming" className="gap-4">
        <TabsList className="w-full group-data-horizontal/tabs:h-10 sm:w-fit">
          <TabsTrigger value="upcoming" className="px-4 text-base md:text-sm">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="past" className="px-4 text-base md:text-sm">
            Past
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="space-y-4">
          <UpcomingList />
          <InfoNote title="Changing your plans?">
            You can reschedule or cancel any upcoming appointment here. A new time is sent to the hospital for confirmation, so it will show
            as &ldquo;Awaiting confirmation&rdquo; until they approve it.
          </InfoNote>
        </TabsContent>
        <TabsContent value="past">
          <PastList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
