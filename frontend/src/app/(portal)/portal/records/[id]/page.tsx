"use client";

import { CalendarClock, ChevronRight, Download, FileText, FlaskConical, Hourglass, Paperclip, Pill, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { FadeIn, InfoNote } from "@/components/modules/portal/portal-ui";
import { abnormalCount, countdownLabel, daysUntil, longDay, PRESCRIPTION_STATUS_COPY } from "@/components/modules/portal/portal-utils";
import { PrescriptionSheet } from "@/components/modules/portal/prescription-sheet";
import { VitalsPanel } from "@/components/shared/clinical";
import { PageHeader } from "@/components/shared/page-header";
import { KeyValueGrid, SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { ApiError } from "@/lib/api/client";
import { formatBytes, formatDate, formatDateTime, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMedicalRecord } from "@/services/emr";
import { useLabOrder } from "@/services/lab";
import { usePrescription } from "@/services/prescriptions";

const rowCls =
  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring";

function LinkedPrescription({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const rx = usePrescription(id);
  if (rx.isLoading) return <Skeleton className="h-12 w-full" />;
  if (!rx.data) return <p className="text-muted-foreground p-2 text-sm">This prescription isn&apos;t available.</p>;
  const copy = PRESCRIPTION_STATUS_COPY[rx.data.status];
  return (
    <button type="button" className={rowCls} onClick={() => onOpen(id)} aria-label={`View prescription ${rx.data.number}`}>
      <span className="flex min-w-0 items-start gap-3">
        <Pill className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-base font-medium md:text-sm">{rx.data.items.map((i) => i.medicineName).join(", ")}</span>
          <span className="text-muted-foreground block text-sm">{rx.data.number}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <StatusBadge status={rx.data.status} label={copy.label} tone={copy.tone} />
        <ChevronRight className="text-muted-foreground size-4" aria-hidden />
      </span>
    </button>
  );
}

function LinkedLabReport({ id }: { id: string }) {
  const order = useLabOrder(id);
  if (order.isLoading) return <Skeleton className="h-12 w-full" />;
  if (!order.data) {
    const pending = order.error instanceof ApiError && order.error.status === 404;
    return (
      <div className="text-muted-foreground flex items-center gap-3 p-2 text-sm">
        <Hourglass className="size-4 shrink-0" aria-hidden />
        {pending ? "Test ordered — results will appear here once the lab has checked them." : "This report couldn't be loaded."}
      </div>
    );
  }
  const { abnormal, critical } = abnormalCount(order.data.results);
  return (
    <Link href={ROUTES.portalReport(id)} className={rowCls}>
      <span className="flex min-w-0 items-start gap-3">
        <FlaskConical className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-base font-medium md:text-sm">{order.data.tests.map((t) => t.testName).join(", ")}</span>
          <span className="text-muted-foreground block text-sm">
            {order.data.number} · {formatDate(order.data.approvedAt ?? order.data.createdAt)}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {abnormal > 0 ? (
          <StatusBadge status={critical ? "CRITICAL" : "HIGH"} label={`${abnormal} to review`} />
        ) : (
          <StatusBadge status="NORMAL" label="All normal" />
        )}
        <ChevronRight className="text-muted-foreground size-4" aria-hidden />
      </span>
    </Link>
  );
}

export default function PortalRecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const record = useMedicalRecord(id);
  const [rxOpen, setRxOpen] = useState<string | null>(null);
  const r = record.data;

  if (record.isLoading) return <DetailSkeleton />;
  if (record.error || !r) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Visit record"
          breadcrumbs={[
            { label: "Home", href: ROUTES.portal },
            { label: "Medical records", href: ROUTES.portalRecords },
            { label: "Visit" },
          ]}
        />
        <ErrorState error={record.error} onRetry={() => record.refetch()} />
      </div>
    );
  }

  const latestVitals = r.vitals[0];
  const followUpDays = r.followUpDate ? daysUntil(r.followUpDate) : null;

  return (
    <div className={cn("mx-auto max-w-4xl space-y-4", rxOpen && "print:hidden")}>
      <PageHeader
        title={`Visit on ${formatDate(r.createdAt, "d MMMM yyyy")}`}
        description={`${r.doctorName} · ${r.departmentName}`}
        breadcrumbs={[
          { label: "Home", href: ROUTES.portal },
          { label: "Medical records", href: ROUTES.portalRecords },
          { label: formatDate(r.createdAt) },
        ]}
        actions={
          <Button variant="outline" size="lg" onClick={() => window.print()}>
            <Printer /> Print
          </Button>
        }
      />

      {r.followUpDate && (
        <FadeIn>
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4",
              followUpDays != null && followUpDays >= 0 ? "border-primary/30 bg-primary/5" : "bg-muted/40",
            )}
          >
            <CalendarClock className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="flex-1 space-y-1">
              <p className="text-base font-medium">
                Follow-up recommended: {longDay(r.followUpDate)}
                {followUpDays != null && followUpDays >= 0 && (
                  <span className="text-muted-foreground"> ({countdownLabel(r.followUpDate).toLowerCase()})</span>
                )}
              </p>
              <p className="text-muted-foreground text-sm">Your doctor would like to see you again around this date.</p>
            </div>
            {followUpDays != null && followUpDays >= 0 && (
              <Button size="lg" className="no-print hidden sm:inline-flex" asChild>
                <Link href={ROUTES.portalBook}>Book follow-up</Link>
              </Button>
            )}
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.03}>
        <SectionCard title="Summary of your visit">
          <div className="space-y-4 text-base md:text-sm">
            <div>
              <h3 className="text-muted-foreground text-xs font-medium uppercase">What you came in for</h3>
              <p className="mt-1">{r.chiefComplaint || "—"}</p>
              {r.symptoms.length > 0 && <p className="text-muted-foreground mt-1">Symptoms: {r.symptoms.join(", ")}</p>}
            </div>
            <div>
              <h3 className="text-muted-foreground text-xs font-medium uppercase">Diagnosis</h3>
              {r.diagnoses.length ? (
                <ul className="mt-1 space-y-1.5">
                  {r.diagnoses.map((d) => (
                    <li key={d.code} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{d.description}</span>
                      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs" title="ICD-10 code">
                        <span className="sr-only">ICD-10 code </span>
                        {d.code}
                      </span>
                      {d.type === "DIFFERENTIAL" && <span className="text-muted-foreground text-sm">(possible — being checked)</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground mt-1">No diagnosis recorded.</p>
              )}
            </div>
            <div>
              <h3 className="text-muted-foreground text-xs font-medium uppercase">Treatment plan</h3>
              <p className="mt-1 whitespace-pre-line">{r.treatmentPlan || "—"}</p>
            </div>
            <KeyValueGrid
              items={[
                { label: "Doctor", value: r.doctorName },
                { label: "Department", value: r.departmentName },
                { label: "Visit date", value: formatDateTime(r.createdAt) },
                { label: "Follow-up", value: r.followUpDate ? formatDate(r.followUpDate) : "Not needed" },
              ]}
            />
          </div>
        </SectionCard>
      </FadeIn>

      <FadeIn delay={0.06}>
        <SectionCard
          title="Vital signs"
          description="Measurements taken during your visit. Highlighted values were outside the usual range."
        >
          <VitalsPanel vitals={latestVitals} />
        </SectionCard>
      </FadeIn>

      <div className="grid gap-4 md:grid-cols-2">
        <FadeIn delay={0.09}>
          <SectionCard title="Prescriptions from this visit" contentClassName="p-2" className="h-full">
            {r.prescriptionIds.length ? (
              <div className="space-y-1">
                {r.prescriptionIds.map((pid) => (
                  <LinkedPrescription key={pid} id={pid} onOpen={setRxOpen} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground p-2 text-sm">No medicines were prescribed.</p>
            )}
          </SectionCard>
        </FadeIn>
        <FadeIn delay={0.12}>
          <SectionCard title="Lab tests from this visit" contentClassName="p-2" className="h-full">
            {r.labOrderIds.length ? (
              <div className="space-y-1">
                {r.labOrderIds.map((lid) => (
                  <LinkedLabReport key={lid} id={lid} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground p-2 text-sm">No lab tests were ordered.</p>
            )}
          </SectionCard>
        </FadeIn>
      </div>

      {r.notes.length > 0 && (
        <FadeIn delay={0.15}>
          <SectionCard title="Doctor's notes">
            <ul className="space-y-4">
              {r.notes.map((n) => (
                <li key={n.id} className="border-primary/40 space-y-1 border-l-2 pl-3">
                  <p className="text-base whitespace-pre-line md:text-sm">{n.text}</p>
                  <p className="text-muted-foreground text-xs">
                    {n.authorName} · {humanize(n.authorRole)} · {formatDateTime(n.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </FadeIn>
      )}

      {r.attachments.length > 0 && (
        <FadeIn delay={0.18}>
          <SectionCard title="Documents" contentClassName="p-2">
            <ul className="space-y-1">
              {r.attachments.map((a) => (
                <li key={a.id}>
                  <a href={a.url} download={a.name} target="_blank" rel="noopener noreferrer" className={rowCls}>
                    <span className="flex min-w-0 items-center gap-3">
                      {a.mimeType === "application/pdf" ? (
                        <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      ) : (
                        <Paperclip className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-base font-medium md:text-sm">{a.name}</span>
                        <span className="text-muted-foreground block text-xs">
                          {formatBytes(a.sizeBytes)} · {formatDate(a.uploadedAt)}
                        </span>
                      </span>
                    </span>
                    <span className="no-print text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium">
                      <Download className="size-4" aria-hidden /> Download
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </SectionCard>
        </FadeIn>
      )}

      <InfoNote className="no-print" title="Questions about this visit?">
        Bring them to your next appointment, or call the hospital. Please don&apos;t stop or change any medicine without talking to your
        doctor.
      </InfoNote>

      <PrescriptionSheet id={rxOpen} onOpenChange={(open) => !open && setRxOpen(null)} />
    </div>
  );
}
