"use client";

import { LabTestCatalogue } from "@/components/modules/lab/lab-test-catalogue";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/constants/routes";

export default function LabTestsPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Lab", href: ROUTES.lab }, { label: "Test catalogue" }]}
        title="Test catalogue"
        description="Tests offered by the laboratory with sample requirements, pricing and reference ranges."
      />
      <LabTestCatalogue />
    </>
  );
}
