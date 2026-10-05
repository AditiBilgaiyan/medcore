"use client";

import { ChevronDown, History } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePatientRecords } from "@/services/emr";
import type { MedicalRecord } from "@/types";
import { RecordDetails } from "./record-details";

/** Previous visit records for the encounter sidebar. */
export function PatientHistory({ patientId, excludeRecordId }: { patientId: string; excludeRecordId?: string }) {
  const { data, isLoading, error, refetch } = usePatientRecords(patientId, { limit: 15 });
  const records = data?.data.filter((r) => r.id !== excludeRecordId) ?? [];

  return (
    <SectionCard
      title="Patient history"
      description={data ? `${records.length} previous visit${records.length === 1 ? "" : "s"}` : undefined}
      action={
        <Link href={ROUTES.patient(patientId)} className="text-primary text-xs font-medium underline-offset-4 hover:underline">
          Full chart
        </Link>
      }
      contentClassName="p-0"
    >
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} className="py-6" />
      ) : records.length === 0 ? (
        <EmptyState compact icon={History} title="First visit" description="No previous records for this patient." />
      ) : (
        <ul className="divide-y">
          {records.map((r) => (
            <HistoryItem key={r.id} record={r} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function HistoryItem({ record }: { record: MedicalRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="hover:bg-muted/40 focus-visible:outline-ring flex w-full items-start gap-2 px-4 py-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <time dateTime={record.createdAt} className="font-medium tabular-nums">
                  {formatDate(record.createdAt)}
                </time>
                <span className="text-muted-foreground"> · {record.departmentName}</span>
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {record.diagnoses.length
                  ? record.diagnoses.map((d) => `${d.code} ${d.description}`).join("; ")
                  : record.chiefComplaint || "No diagnosis"}
              </p>
            </div>
            <ChevronDown
              className={cn("text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform", open && "rotate-180")}
              aria-hidden
            />
            <span className="sr-only">{open ? "Hide" : "Show"} details</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-muted/20 border-t px-4 py-3">
            <p className="text-muted-foreground mb-3 text-xs">{record.doctorName}</p>
            <RecordDetails record={record} compact />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}
