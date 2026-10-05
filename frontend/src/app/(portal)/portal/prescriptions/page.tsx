"use client";

import { ChevronRight, Pill } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FadeIn, InfoNote, ListSkeleton, Pager } from "@/components/modules/portal/portal-ui";
import { PRESCRIPTION_STATUS_COPY } from "@/components/modules/portal/portal-utils";
import { PrescriptionSheet } from "@/components/modules/portal/prescription-sheet";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { FREQUENCY_LABELS } from "@/lib/clinical";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePrescriptions } from "@/services/prescriptions";

function PrescriptionsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openId = params.get("open");
  const [page, setPage] = useState(1);
  const rx = usePrescriptions({ page, limit: 10 });
  const list = rx.data?.data ?? [];

  const setOpen = (id: string | null) => {
    router.replace(id ? `${pathname}?open=${id}` : pathname, { scroll: false });
  };

  return (
    <>
      <div className={cn("mx-auto max-w-4xl space-y-4", openId && "print:hidden")}>
        <PageHeader
          title="Prescriptions"
          description="Medicines your doctors have prescribed. Tap one to see the full prescription."
          breadcrumbs={[{ label: "Home", href: ROUTES.portal }, { label: "Prescriptions" }]}
        />

        {rx.isLoading ? (
          <ListSkeleton />
        ) : rx.error && !rx.data ? (
          <Card className="p-0">
            <ErrorState error={rx.error} onRetry={() => rx.refetch()} />
          </Card>
        ) : !list.length ? (
          <Card className="p-0">
            <EmptyState
              icon={Pill}
              title="No prescriptions yet"
              description="When a doctor prescribes medicine for you, it will appear here."
            />
          </Card>
        ) : (
          <>
            <ul className="space-y-3">
              {list.map((p, i) => {
                const copy = PRESCRIPTION_STATUS_COPY[p.status];
                return (
                  <FadeIn as="li" key={p.id} delay={Math.min(i, 5) * 0.03}>
                    <button
                      type="button"
                      onClick={() => setOpen(p.id)}
                      aria-haspopup="dialog"
                      className="group bg-card hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-ring flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-base font-semibold">
                              {formatDate(p.signedAt, "d MMM yyyy")} · {p.doctorName}
                            </p>
                            <p className="text-muted-foreground font-mono text-sm">{p.number}</p>
                          </div>
                          <StatusBadge status={p.status} label={copy.label} tone={copy.tone} />
                        </div>
                        <ul className="space-y-1" aria-label="Medicines">
                          {p.items.map((it) => (
                            <li key={it.id} className="flex flex-wrap gap-x-2 text-base md:text-sm">
                              <span className="font-medium">{it.medicineName}</span>
                              <span className="text-muted-foreground">
                                {it.dosage} · {FREQUENCY_LABELS[it.frequency].toLowerCase()} · {it.durationDays} days
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-muted-foreground text-sm">{copy.help}</p>
                      </div>
                      <ChevronRight
                        className="text-muted-foreground mt-1 size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </button>
                  </FadeIn>
                );
              })}
            </ul>
            <Pager meta={rx.data?.meta} onPageChange={setPage} label="prescriptions" />
          </>
        )}

        <InfoNote title="Collecting your medicines">
          Show the prescription number at the hospital pharmacy. Always take medicines exactly as prescribed and finish the full course
          unless your doctor tells you otherwise.
        </InfoNote>
      </div>

      <PrescriptionSheet id={openId} onOpenChange={(open) => !open && setOpen(null)} />
    </>
  );
}

export default function PortalPrescriptionsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <PrescriptionsContent />
    </Suspense>
  );
}
