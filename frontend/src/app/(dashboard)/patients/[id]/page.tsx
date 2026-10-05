"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PatientHeader } from "@/components/modules/patients/patient-header";
import { PatientOverview } from "@/components/modules/patients/patient-overview";
import { AppointmentsTab, InvoicesTab, LabResultsTab, PrescriptionsTab, VisitsTab } from "@/components/modules/patients/patient-tabs";
import { DetailSkeleton, ErrorState } from "@/components/shared/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Permission } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { fullName } from "@/lib/format";
import { usePatient } from "@/services/patients";

const TABS: { value: string; label: string; permission?: Permission }[] = [
  { value: "overview", label: "Overview" },
  { value: "visits", label: "Visits", permission: "emr:read" },
  { value: "appointments", label: "Appointments", permission: "appointments:read" },
  { value: "labs", label: "Lab results", permission: "lab:read" },
  { value: "prescriptions", label: "Prescriptions", permission: "prescriptions:read" },
  { value: "invoices", label: "Invoices", permission: "billing:read" },
];

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { data: patient, isLoading, error, refetch } = usePatient(id);

  if (isLoading) return <DetailSkeleton />;
  if (error || !patient) return <ErrorState error={error ?? new Error("Patient not found")} onRetry={() => refetch()} />;

  const tabs = TABS.filter((t) => !t.permission || can(t.permission));

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="no-print">
        <ol className="text-muted-foreground flex items-center gap-1 text-xs">
          <li>
            <Link href={ROUTES.patients} className="hover:text-foreground focus-visible:outline-ring rounded focus-visible:outline-2">
              Patients
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-3" />
          </li>
          <li aria-current="page">{fullName(patient)}</li>
        </ol>
      </nav>

      <PatientHeader patient={patient} />

      <Tabs defaultValue="overview" className="gap-4">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList aria-label="Patient sections">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="px-3">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview">
          <PatientOverview patient={patient} />
        </TabsContent>
        {can("emr:read") && (
          <TabsContent value="visits">
            <VisitsTab patientId={patient.id} />
          </TabsContent>
        )}
        {can("appointments:read") && (
          <TabsContent value="appointments">
            <AppointmentsTab patientId={patient.id} />
          </TabsContent>
        )}
        {can("lab:read") && (
          <TabsContent value="labs">
            <LabResultsTab patientId={patient.id} />
          </TabsContent>
        )}
        {can("prescriptions:read") && (
          <TabsContent value="prescriptions">
            <PrescriptionsTab patientId={patient.id} />
          </TabsContent>
        )}
        {can("billing:read") && (
          <TabsContent value="invoices">
            <InvoicesTab patientId={patient.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
