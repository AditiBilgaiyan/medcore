"use client";

import { CalendarPlus, ChevronRight, ClipboardList, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FadeIn, InfoNote, ListSkeleton, Pager } from "@/components/modules/portal/portal-ui";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import { usePatientRecords } from "@/services/emr";
import type { MedicalRecord } from "@/types";

function primaryDiagnosis(r: MedicalRecord) {
  return r.diagnoses.find((d) => d.type === "CONFIRMED") ?? r.diagnoses[0];
}

export default function PortalRecordsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const records = usePatientRecords(user?.patientId, { page, limit: 10 });
  const list = records.data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Medical records"
        description="A summary of each visit, written up by your doctor."
        breadcrumbs={[{ label: "Home", href: ROUTES.portal }, { label: "Medical records" }]}
      />

      {records.isLoading || !user?.patientId ? (
        <ListSkeleton />
      ) : records.error && !records.data ? (
        <Card className="p-0">
          <ErrorState error={records.error} onRetry={() => records.refetch()} />
        </Card>
      ) : !list.length ? (
        <Card className="p-0">
          <EmptyState
            icon={ClipboardList}
            title="No visit records yet"
            description="After a consultation, your doctor's notes appear here once they've been finalised."
            action={
              <Button size="lg" asChild>
                <Link href={ROUTES.portalBook}>
                  <CalendarPlus /> Book appointment
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <ol
            className="before:bg-border relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px sm:before:left-[15px]"
            aria-label="Visit history"
          >
            {list.map((r, i) => {
              const dx = primaryDiagnosis(r);
              return (
                <FadeIn as="li" key={r.id} delay={Math.min(i, 5) * 0.03} className="relative flex gap-3 sm:gap-4">
                  <span
                    className="border-primary bg-background relative z-10 mt-4 flex size-6 shrink-0 items-center justify-center rounded-full border-2 sm:size-8"
                    aria-hidden
                  >
                    <Stethoscope className="text-primary size-3 sm:size-4" />
                  </span>
                  <Link
                    href={ROUTES.portalRecord(r.id)}
                    className="group bg-card hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-ring min-w-0 flex-1 rounded-xl border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-muted-foreground text-sm font-medium">
                          <time dateTime={r.createdAt}>{formatDate(r.createdAt, "EEEE, d MMM yyyy")}</time>
                        </p>
                        <p className="text-base font-semibold">{dx ? dx.description : r.chiefComplaint || "Consultation"}</p>
                        <p className="text-muted-foreground text-base md:text-sm">
                          {r.doctorName} · {r.departmentName}
                        </p>
                        {dx && r.chiefComplaint && (
                          <p className="text-muted-foreground line-clamp-2 text-sm">You mentioned: {r.chiefComplaint}</p>
                        )}
                      </div>
                      <ChevronRight
                        className="text-muted-foreground mt-1 size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                  </Link>
                </FadeIn>
              );
            })}
          </ol>
          <Pager meta={records.data?.meta} onPageChange={setPage} label="visits" />
        </>
      )}

      <InfoNote title="About your records">
        These are the notes your doctor finalised after each visit. If something looks wrong or is missing, please mention it at your next
        appointment.
      </InfoNote>
    </div>
  );
}
