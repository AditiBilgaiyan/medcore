"use client";

import { DispenseQueue } from "@/components/modules/pharmacy/dispense-queue";
import { PageHeader } from "@/components/shared/page-header";

export default function DispensePage() {
  return (
    <>
      <PageHeader title="Dispensing" description="Verify and dispense signed prescriptions. Oldest prescriptions are listed first." />
      <DispenseQueue />
    </>
  );
}
