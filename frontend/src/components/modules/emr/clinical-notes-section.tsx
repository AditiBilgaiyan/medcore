"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CircleDot, Loader2, Lock, Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AllergyBadges } from "@/components/shared/clinical";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import { toPlainText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { useUpdateRecord } from "@/services/emr";
import { qk } from "@/services/query-keys";
import type { Allergy, AllergySeverity, Diagnosis, DiagnosisType, MedicalRecord } from "@/types";
import { TagInput } from "../patients/tag-input";
import { DiagnosisList } from "./record-details";
import { Icd10Combobox } from "./icd10-combobox";

interface Draft {
  chiefComplaint: string;
  symptoms: string[];
  diagnoses: Diagnosis[];
  treatmentPlan: string;
  followUpDate: string;
  allergiesNoted: Allergy[];
}

const fromRecord = (r: MedicalRecord): Draft => ({
  chiefComplaint: r.chiefComplaint ?? "",
  symptoms: r.symptoms ?? [],
  diagnoses: r.diagnoses ?? [],
  treatmentPlan: r.treatmentPlan ?? "",
  followUpDate: r.followUpDate ?? "",
  allergiesNoted: r.allergiesNoted ?? [],
});

const SYMPTOM_SUGGESTIONS = ["Fever", "Cough", "Headache", "Fatigue", "Nausea", "Body ache"];

export function ClinicalNotesSection({
  record,
  editable,
  onDirtyChange,
}: {
  record: MedicalRecord;
  editable: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const qc = useQueryClient();
  const update = useUpdateRecord(record.id);
  const baseline = fromRecord(record);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const value = draft ?? baseline;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(baseline);
  const readOnly = !editable || record.isFinalised;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // Warn before leaving with unsaved clinical notes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, v: Draft[K]) => {
    setDraft({ ...value, [key]: v });
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async () => {
    const next: typeof errors = {};
    if (value.chiefComplaint.length > 1000) next.chiefComplaint = "Keep the chief complaint under 1,000 characters";
    if (value.treatmentPlan.length > 4000) next.treatmentPlan = "Keep the plan under 4,000 characters";
    if (value.followUpDate && value.followUpDate < new Date().toISOString().slice(0, 10))
      next.followUpDate = "Follow-up can't be in the past";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await update.mutateAsync({
        chiefComplaint: toPlainText(value.chiefComplaint).trim(),
        symptoms: value.symptoms.map((s) => toPlainText(s).trim()).filter(Boolean),
        diagnoses: value.diagnoses,
        treatmentPlan: toPlainText(value.treatmentPlan).trim(),
        followUpDate: value.followUpDate,
        allergiesNoted: value.allergiesNoted.map((a) => ({
          ...a,
          substance: toPlainText(a.substance).trim(),
          reaction: toPlainText(a.reaction).trim(),
        })),
      });
      setDraft(null);
      toast.success("Clinical notes saved");
    } catch (err) {
      if (err instanceof ApiError && err.code === "RECORD_FINALISED") {
        setDraft(null);
        await qc.invalidateQueries({ queryKey: qk.records.all });
      }
    }
  };

  const toggleType = (code: string) =>
    set(
      "diagnoses",
      value.diagnoses.map((d) =>
        d.code === code ? { ...d, type: (d.type === "CONFIRMED" ? "DIFFERENTIAL" : "CONFIRMED") as DiagnosisType } : d,
      ),
    );

  return (
    <SectionCard
      title="Clinical notes"
      description={
        record.isFinalised ? "Finalised — read-only. Add an addendum in Notes." : "Complaint, diagnosis and plan for this visit."
      }
      action={
        readOnly ? (
          record.isFinalised ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <Lock className="size-3.5" aria-hidden /> Finalised
            </span>
          ) : null
        ) : (
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300" role="status">
                <CircleDot className="size-3" aria-hidden /> Unsaved changes
              </span>
            )}
            {dirty && (
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={update.isPending}>
                Discard
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={!dirty || update.isPending}>
              {update.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Save
            </Button>
          </div>
        )
      }
    >
      {readOnly ? (
        <ReadOnlyNotes record={record} />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field data-invalid={!!errors.chiefComplaint}>
              <FieldLabel htmlFor="cn-complaint">Chief complaint</FieldLabel>
              <Textarea
                id="cn-complaint"
                rows={3}
                value={value.chiefComplaint}
                onChange={(e) => set("chiefComplaint", e.target.value)}
                aria-invalid={!!errors.chiefComplaint}
              />
              <FieldError errors={errors.chiefComplaint ? [{ message: errors.chiefComplaint }] : undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cn-symptoms">Symptoms</FieldLabel>
              <TagInput
                id="cn-symptoms"
                value={value.symptoms}
                onChange={(v) => set("symptoms", v)}
                placeholder="Add a symptom and press Enter"
                suggestions={SYMPTOM_SUGGESTIONS}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="cn-icd">Diagnoses</FieldLabel>
            <Icd10Combobox
              id="cn-icd"
              exclude={value.diagnoses.map((d) => d.code)}
              onSelect={(c) => set("diagnoses", [...value.diagnoses, { code: c.code, description: c.description, type: "DIFFERENTIAL" }])}
            />
            {value.diagnoses.length === 0 ? (
              <FieldDescription>At least one diagnosis is required to complete the visit.</FieldDescription>
            ) : (
              <ul className="divide-y rounded-lg border" aria-label="Diagnoses">
                {value.diagnoses.map((d) => (
                  <li key={d.code} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                      <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{d.code}</span>
                      <span className="min-w-0">{d.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label={`Diagnosis type for ${d.code}`}>
                        {(["DIFFERENTIAL", "CONFIRMED"] as const).map((t) => (
                          <Button
                            key={t}
                            type="button"
                            size="xs"
                            variant={d.type === t ? "secondary" : "ghost"}
                            aria-pressed={d.type === t}
                            onClick={() => d.type !== t && toggleType(d.code)}
                          >
                            {t === "CONFIRMED" ? "Confirmed" : "Differential"}
                          </Button>
                        ))}
                      </div>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remove diagnosis ${d.code} ${d.description}`}
                        onClick={() =>
                          set(
                            "diagnoses",
                            value.diagnoses.filter((x) => x.code !== d.code),
                          )
                        }
                      >
                        <X />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          <div className="grid gap-4 md:grid-cols-[1fr_14rem]">
            <Field data-invalid={!!errors.treatmentPlan}>
              <FieldLabel htmlFor="cn-plan">Treatment plan</FieldLabel>
              <Textarea
                id="cn-plan"
                rows={4}
                value={value.treatmentPlan}
                onChange={(e) => set("treatmentPlan", e.target.value)}
                placeholder="Investigations, medication rationale, lifestyle advice…"
                aria-invalid={!!errors.treatmentPlan}
              />
              <FieldError errors={errors.treatmentPlan ? [{ message: errors.treatmentPlan }] : undefined} />
            </Field>
            <Field data-invalid={!!errors.followUpDate}>
              <FieldLabel htmlFor="cn-followup">Follow-up date</FieldLabel>
              <Input
                id="cn-followup"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={value.followUpDate}
                onChange={(e) => set("followUpDate", e.target.value)}
                aria-invalid={!!errors.followUpDate}
              />
              <FieldError errors={errors.followUpDate ? [{ message: errors.followUpDate }] : undefined} />
            </Field>
          </div>

          <AllergiesNoted value={value.allergiesNoted} baseline={baseline.allergiesNoted} onChange={(v) => set("allergiesNoted", v)} />
        </div>
      )}
    </SectionCard>
  );
}

function ReadOnlyNotes({ record }: { record: MedicalRecord }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1">
        <h3 className="text-muted-foreground text-xs font-semibold uppercase">Chief complaint</h3>
        <p className="text-sm whitespace-pre-line">{record.chiefComplaint || "—"}</p>
        {record.symptoms.length > 0 && <p className="text-muted-foreground text-sm">Symptoms: {record.symptoms.join(", ")}</p>}
      </div>
      <div className="space-y-1">
        <h3 className="text-muted-foreground text-xs font-semibold uppercase">Diagnoses</h3>
        <DiagnosisList diagnoses={record.diagnoses} />
      </div>
      <div className="space-y-1">
        <h3 className="text-muted-foreground text-xs font-semibold uppercase">Treatment plan</h3>
        <p className="text-sm whitespace-pre-line">{record.treatmentPlan || "—"}</p>
        {record.followUpDate && <p className="text-muted-foreground text-sm">Follow-up {formatDate(record.followUpDate)}</p>}
      </div>
      <div className="space-y-1">
        <h3 className="text-muted-foreground text-xs font-semibold uppercase">Allergies noted</h3>
        <AllergyBadges allergies={record.allergiesNoted} />
      </div>
    </div>
  );
}

function AllergiesNoted({ value, baseline, onChange }: { value: Allergy[]; baseline: Allergy[]; onChange: (v: Allergy[]) => void }) {
  const [substance, setSubstance] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<AllergySeverity>("MODERATE");
  const [error, setError] = useState<string>();
  const isNew = (a: Allergy) => !baseline.some((b) => b.substance.toLowerCase() === a.substance.toLowerCase());

  const add = () => {
    const s = substance.trim();
    if (!s) return setError("Enter the substance");
    if (value.some((a) => a.substance.toLowerCase() === s.toLowerCase())) return setError(`${s} is already recorded`);
    onChange([...value, { substance: s, reaction: reaction.trim(), severity }]);
    setSubstance("");
    setReaction("");
    setSeverity("MODERATE");
    setError(undefined);
  };

  return (
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Allergies noted</legend>
      <p className="text-muted-foreground text-xs">
        New allergies are added to the patient&apos;s master record when you save. Existing allergies can&apos;t be removed here.
      </p>
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Allergies noted">
          {value.map((a) => (
            <li
              key={a.substance}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                a.severity === "SEVERE"
                  ? "bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30"
                  : "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
              )}
            >
              <AlertTriangle className="size-3" aria-hidden />
              {a.substance}
              <span className="font-normal opacity-80">· {a.severity.toLowerCase()}</span>
              {isNew(a) && (
                <button
                  type="button"
                  className="hover:bg-foreground/10 focus-visible:outline-ring ml-0.5 rounded p-0.5 focus-visible:outline-2"
                  aria-label={`Remove ${a.substance}`}
                  onClick={() => onChange(value.filter((x) => x !== a))}
                >
                  <X className="size-3" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No known allergies.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-end">
        <Field data-invalid={!!error} className="gap-1">
          <FieldLabel htmlFor="an-substance" className="text-xs">
            Substance
          </FieldLabel>
          <Input
            id="an-substance"
            value={substance}
            onChange={(e) => {
              setSubstance(e.target.value);
              setError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            aria-invalid={!!error}
            placeholder="e.g. Sulfonamides"
          />
        </Field>
        <Field className="gap-1">
          <FieldLabel htmlFor="an-reaction" className="text-xs">
            Reaction
          </FieldLabel>
          <Input id="an-reaction" value={reaction} onChange={(e) => setReaction(e.target.value)} placeholder="e.g. Rash" />
        </Field>
        <Field className="gap-1">
          <FieldLabel htmlFor="an-severity" className="text-xs">
            Severity
          </FieldLabel>
          <Select value={severity} onValueChange={(v) => setSeverity(v as AllergySeverity)}>
            <SelectTrigger id="an-severity" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MILD">Mild</SelectItem>
              <SelectItem value="MODERATE">Moderate</SelectItem>
              <SelectItem value="SEVERE">Severe</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Button type="button" variant="outline" onClick={add}>
          <Plus /> Add
        </Button>
      </div>
      <FieldError errors={error ? [{ message: error }] : undefined} />
    </fieldset>
  );
}
