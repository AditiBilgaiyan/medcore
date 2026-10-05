import { CalendarClock, FileText, Paperclip } from "lucide-react";
import { VitalsPanel } from "@/components/shared/clinical";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatBytes, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Diagnosis, MedicalRecord } from "@/types";
import { NotesTimeline } from "./notes-timeline";

export function DiagnosisList({ diagnoses, className }: { diagnoses: Diagnosis[]; className?: string }) {
  if (!diagnoses.length) return <p className="text-muted-foreground text-sm">No diagnosis recorded.</p>;
  return (
    <ul className={cn("space-y-1", className)}>
      {diagnoses.map((d) => (
        <li key={d.code} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{d.code}</span>
          <span>{d.description}</span>
          <StatusBadge status={d.type} tone={d.type === "CONFIRMED" ? "success" : "neutral"} dot={false} className="px-1.5 text-[11px]" />
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h4>
      {children}
    </section>
  );
}

/** Full read-only view of a visit record (used in the patient's Visits tab and encounter history). */
export function RecordDetails({ record, compact }: { record: MedicalRecord; compact?: boolean }) {
  return (
    <div className="space-y-4">
      {record.vitals[0] && (
        <Block title="Vitals">
          <VitalsPanel vitals={record.vitals[0]} />
        </Block>
      )}
      <div className={cn("grid gap-4", !compact && "md:grid-cols-2")}>
        <Block title="Chief complaint">
          <p className="text-sm whitespace-pre-line">{record.chiefComplaint || "—"}</p>
          {record.symptoms.length > 0 && (
            <ul className="flex flex-wrap gap-1 pt-1" aria-label="Symptoms">
              {record.symptoms.map((s) => (
                <li key={s} className="bg-secondary text-secondary-foreground rounded-md px-1.5 py-0.5 text-xs">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </Block>
        <Block title="Diagnoses (ICD-10)">
          <DiagnosisList diagnoses={record.diagnoses} />
        </Block>
        <Block title="Treatment plan">
          <p className="text-sm whitespace-pre-line">{record.treatmentPlan || "—"}</p>
          {record.followUpDate && (
            <p className="text-muted-foreground flex items-center gap-1.5 pt-1 text-xs">
              <CalendarClock className="size-3.5" aria-hidden /> Follow-up {formatDate(record.followUpDate)}
            </p>
          )}
        </Block>
        {record.attachments.length > 0 && (
          <Block title="Attachments">
            <ul className="space-y-1">
              {record.attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <Paperclip className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                  <a href={a.url} download={a.name} className="text-primary truncate font-medium underline-offset-4 hover:underline">
                    {a.name}
                  </a>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{formatBytes(a.sizeBytes)}</span>
                </li>
              ))}
            </ul>
          </Block>
        )}
      </div>
      {record.notes.length > 0 && (
        <Block title="Notes">
          <NotesTimeline notes={record.notes} />
        </Block>
      )}
      {!record.isFinalised && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <FileText className="size-3.5" aria-hidden /> Visit in progress — this record may still change.
        </p>
      )}
    </div>
  );
}
