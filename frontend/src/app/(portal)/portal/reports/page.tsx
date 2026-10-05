"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FadeIn, InfoNote, ListSkeleton, Pager } from "@/components/modules/portal/portal-ui";
import { abnormalCount } from "@/components/modules/portal/portal-utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLabOrders } from "@/services/lab";

export default function PortalReportsPage() {
  const [page, setPage] = useState(1);
  const labs = useLabOrders({ page, limit: 10 });
  const list = labs.data?.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Lab reports"
        description="Your test results, once the lab has checked and approved them."
        breadcrumbs={[{ label: "Home", href: ROUTES.portal }, { label: "Lab reports" }]}
      />

      {labs.isLoading ? (
        <ListSkeleton />
      ) : labs.error && !labs.data ? (
        <Card className="p-0">
          <ErrorState error={labs.error} onRetry={() => labs.refetch()} />
        </Card>
      ) : !list.length ? (
        <Card className="p-0">
          <EmptyState
            icon={FlaskConical}
            title="No lab reports yet"
            description="If your doctor ordered tests, the report will appear here as soon as it has been approved. We'll also send you a notification."
          />
        </Card>
      ) : (
        <>
          <ul className="space-y-3">
            {list.map((o, i) => {
              const { abnormal, critical } = abnormalCount(o.results);
              return (
                <FadeIn as="li" key={o.id} delay={Math.min(i, 5) * 0.03}>
                  <Link
                    href={ROUTES.portalReport(o.id)}
                    className="group bg-card hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-ring flex items-start justify-between gap-3 rounded-xl border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <div className="flex min-w-0 gap-3">
                      <span
                        className="bg-secondary text-secondary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg"
                        aria-hidden
                      >
                        <FlaskConical className="size-5" />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <p className="text-base font-semibold">{o.tests.map((t) => t.testName).join(", ")}</p>
                        <p className="text-muted-foreground text-base md:text-sm">
                          {formatDate(o.approvedAt ?? o.createdAt)} · Requested by {o.doctorName}
                        </p>
                        <p
                          className={cn(
                            "inline-flex items-center gap-1.5 text-sm font-medium",
                            critical > 0
                              ? "text-red-700 dark:text-red-400"
                              : abnormal > 0
                                ? "text-amber-800 dark:text-amber-300"
                                : "text-emerald-700 dark:text-emerald-400",
                          )}
                        >
                          {abnormal > 0 ? (
                            <AlertTriangle className="size-4" aria-hidden />
                          ) : (
                            <CheckCircle2 className="size-4" aria-hidden />
                          )}
                          {abnormal > 0
                            ? `${abnormal} ${abnormal === 1 ? "value" : "values"} outside the usual range${critical ? ` (${critical} needs prompt attention)` : ""}`
                            : "All values within the usual range"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className="text-muted-foreground mt-2 size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </FadeIn>
              );
            })}
          </ul>
          <Pager meta={labs.data?.meta} onPageChange={setPage} label="reports" />
        </>
      )}

      <InfoNote title="Waiting for a result?">
        Tests that are still being processed won&apos;t show here yet. A result outside the usual range isn&apos;t always a problem — your
        doctor will explain what it means for you.
      </InfoNote>
    </div>
  );
}
