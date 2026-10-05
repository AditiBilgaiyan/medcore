"use client";

import { PageHeader } from "@/components/shared/page-header";
import { HospitalOnboardingWizard } from "@/components/modules/admin/hospital-wizard";
import { ROUTES } from "@/constants/routes";

export default function NewHospitalPage() {
  return (
    <div className="space-y-2">
      <PageHeader
        title="Onboard a hospital"
        description="Create a new tenant with its first Hospital Admin."
        breadcrumbs={[{ label: "Hospitals", href: ROUTES.hospitals }, { label: "Onboard" }]}
      />
      <HospitalOnboardingWizard />
    </div>
  );
}
