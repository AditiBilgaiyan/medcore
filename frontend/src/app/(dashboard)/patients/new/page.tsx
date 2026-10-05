"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PatientForm } from "@/components/modules/patients/patient-form";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/constants/routes";
import { useCreatePatient } from "@/services/patients";

export default function NewPatientPage() {
  const router = useRouter();
  const create = useCreatePatient();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Register patient"
        description="Fields marked * are required. A medical record number (MRN) is assigned on save."
        breadcrumbs={[{ label: "Patients", href: ROUTES.patients }, { label: "Register" }]}
      />
      <PatientForm
        idPrefix="new-patient"
        submitLabel="Register patient"
        onCancel={() => router.push(ROUTES.patients)}
        onSubmit={async (body) => {
          const patient = await create.mutateAsync(body);
          toast.success(`${patient.firstName} ${patient.lastName} registered`, { description: `MRN ${patient.mrn}` });
          router.push(ROUTES.patient(patient.id));
        }}
      />
    </div>
  );
}
