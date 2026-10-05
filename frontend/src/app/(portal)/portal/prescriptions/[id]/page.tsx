"use client";

import { useParams } from "next/navigation";
import { InfoNote } from "@/components/modules/portal/portal-ui";
import { PRESCRIPTION_STATUS_COPY } from "@/components/modules/portal/portal-utils";
import { PrescriptionDocument, PrintActions } from "@/components/shared/documents";
import { PageHeader } from "@/components/shared/page-header";
import { DetailSkeleton, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { ROUTES } from "@/constants/routes";
import { usePrescription } from "@/services/prescriptions";

/** Full-page, print-friendly prescription view. */
export default function PortalPrescriptionPage() {
  const { id } = useParams<{ id: string }>();
  const rx = usePrescription(id);
  const crumbs = [
    { label: "Home", href: ROUTES.portal },
    { label: "Prescriptions", href: ROUTES.portalPrescriptions },
  ];

  if (rx.isLoading) return <DetailSkeleton />;
  if (rx.error || !rx.data) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Prescription" breadcrumbs={[...crumbs, { label: "Prescription" }]} />
        <ErrorState error={rx.error} onRetry={() => rx.refetch()} />
      </div>
    );
  }

  const copy = PRESCRIPTION_STATUS_COPY[rx.data.status];
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title={`Prescription ${rx.data.number}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={rx.data.status} label={copy.label} tone={copy.tone} />
            {copy.help}
          </span>
        }
        breadcrumbs={[...crumbs, { label: rx.data.number }]}
        actions={<PrintActions pdfPath={`/prescriptions/${rx.data.id}/pdf`} />}
      />
      <PrescriptionDocument prescription={rx.data} />
      <InfoNote className="no-print">
        Take your medicines exactly as prescribed. If you have side effects or questions, contact {rx.data.doctorName} or the hospital.
      </InfoNote>
    </div>
  );
}
