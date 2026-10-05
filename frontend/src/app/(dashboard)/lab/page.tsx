"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { LabWorklist } from "@/components/modules/lab/lab-worklist";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";

export default function LabWorklistPage() {
  const { user } = useAuth();
  const isDoctor = user?.role === "DOCTOR";
  const readOnly = user?.role === "NURSE" || user?.role === "HOSPITAL_ADMIN";
  return (
    <>
      <PageHeader
        title={isDoctor ? "My lab orders" : "Lab worklist"}
        description={
          isDoctor
            ? "Track the investigations you've ordered and review approved reports."
            : readOnly
              ? "Read-only view of laboratory orders across the hospital."
              : "Collect samples, enter results and approve reports. STAT and urgent orders are listed first."
        }
        actions={
          <Button variant="outline" asChild>
            <Link href={ROUTES.labTests}>
              <BookOpen /> Test catalogue
            </Link>
          </Button>
        }
      />
      <LabWorklist />
    </>
  );
}
