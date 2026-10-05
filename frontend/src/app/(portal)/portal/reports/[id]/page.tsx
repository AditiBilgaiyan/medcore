"use client";

import { AlertTriangle, CheckCircle2, Info, Siren } from "lucide-react";
import { useParams } from "next/navigation";
import { FadeIn } from "@/components/modules/portal/portal-ui";
import { abnormalCount } from "@/components/modules/portal/portal-utils";
import { LabReportDocument, PrintActions } from "@/components/shared/documents";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLabOrder } from "@/services/lab";

const FLAG_HELP = [
  { flag: "NORMAL", text: "Within the usual range for people like you." },
  { flag: "LOW", text: "Below the usual range. Often minor, and can depend on diet, hydration, medicines or the time of day." },
  { flag: "HIGH", text: "Above the usual range. Often minor, and can depend on diet, hydration, medicines or the time of day." },
  { flag: "CRITICAL", text: "Far outside the usual range. The lab flags these so your doctor reviews them quickly." },
] as const;

export default function PortalReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const order = useLabOrder(id);
  const crumbs = [
    { label: "Home", href: ROUTES.portal },
    { label: "Lab reports", href: ROUTES.portalReports },
  ];

  if (order.isLoading) return <DetailSkeleton />;
  if (order.error || !order.data) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Lab report" breadcrumbs={[...crumbs, { label: "Report" }]} />
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      </div>
    );
  }

  const o = order.data;
  const { abnormal, critical } = abnormalCount(o.results);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title={o.tests.map((t) => t.testName).join(", ")}
        description={`Report ${o.number} · ${formatDate(o.approvedAt ?? o.createdAt)} · Requested by ${o.doctorName}`}
        breadcrumbs={[...crumbs, { label: o.number }]}
        actions={<PrintActions pdfPath={`/lab-orders/${o.id}/pdf`} />}
      />

      <FadeIn className="no-print">
        <div
          role="status"
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4",
            critical > 0
              ? "border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10"
              : abnormal > 0
                ? "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10"
                : "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10",
          )}
        >
          {critical > 0 ? (
            <Siren className="mt-0.5 size-5 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
          ) : abnormal > 0 ? (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-800 dark:text-amber-300" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
          )}
          <div className="space-y-1 text-base md:text-sm">
            <p className="font-semibold">
              {critical > 0
                ? `${critical} ${critical === 1 ? "result needs" : "results need"} prompt attention`
                : abnormal > 0
                  ? `${abnormal} ${abnormal === 1 ? "value is" : "values are"} outside the usual range`
                  : "All values are within the usual range"}
            </p>
            <p className="text-muted-foreground">
              {critical > 0
                ? `Your doctor has been informed. If you haven't heard from the hospital, please contact ${o.doctorName} or the hospital today. If you feel unwell, seek medical help straight away.`
                : abnormal > 0
                  ? `Results slightly outside the range are common and don't always mean something is wrong. Please discuss them with ${o.doctorName} at your next visit.`
                  : `Your doctor will still go through the report with you if anything needs follow-up.`}
            </p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.04}>
        <LabReportDocument order={o} hospitalName={user?.hospitalName ?? undefined} />
      </FadeIn>

      <FadeIn delay={0.08} className="no-print">
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              <Info className="text-muted-foreground size-4" aria-hidden /> Understanding your results
            </span>
          }
          description="Each value is compared with a reference range — the range seen in most healthy people."
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            {FLAG_HELP.map((f) => (
              <div key={f.flag} className="flex items-start gap-3">
                <dt className="w-20 shrink-0">
                  <StatusBadge status={f.flag} />
                </dt>
                <dd className="text-muted-foreground text-base md:text-sm">{f.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t pt-3 text-base md:text-sm">
            Results are just one part of the picture. Only your doctor can tell you what they mean for your health — please don&apos;t
            change any treatment based on this report alone.
          </p>
        </SectionCard>
      </FadeIn>
    </div>
  );
}
