"use client";

import { AlertTriangle, FileSignature, Loader2, Pill, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AllergyBadges } from "@/components/shared/clinical";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/constants/routes";
import { ApiError, errorMessage } from "@/lib/api/client";
import { FREQUENCY_LABELS, suggestedQuantity } from "@/lib/clinical";
import { formatDateTime, humanize } from "@/lib/format";
import { toPlainText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { useCreatePrescription, usePrescriptions } from "@/services/prescriptions";
import { FREQUENCIES, type Allergy, type CreatePrescriptionRequest, type Frequency, type Medicine, type MedicalRecord } from "@/types";
import { MedicineCombobox } from "./medicine-combobox";

const QUICK_INSTRUCTIONS = ["After food", "Before food", "At bedtime", "Avoid sunlight"];

interface Line {
  key: string;
  medicine: Medicine;
  dosage: string;
  frequency: Frequency;
  durationDays: string;
  quantity: string;
  quantityEdited: boolean;
  instructions: string;
}
type LineErrors = Partial<Record<"dosage" | "durationDays" | "quantity", string>>;

const countable = (m: Medicine) => m.form === "TABLET" || m.form === "CAPSULE";
const autoQty = (m: Medicine, f: Frequency, days: string) =>
  countable(m) ? String(suggestedQuantity(f, Math.max(0, Number(days) || 0))) : "1";

let seq = 0;

export function PrescriptionBuilder({
  record,
  allergies,
  canPrescribe,
}: {
  record: MedicalRecord;
  allergies: Allergy[];
  canPrescribe: boolean;
}) {
  const create = useCreatePrescription();
  const existing = usePrescriptions({ patientId: record.patientId, limit: 50 });
  const issued = existing.data?.data.filter((rx) => rx.medicalRecordId === record.id) ?? [];

  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, LineErrors>>({});
  const [conflict, setConflict] = useState<string | null>(null);

  const addMedicine = (m: Medicine) => {
    const frequency: Frequency = "BD";
    const durationDays = "5";
    setLines((ls) => [
      ...ls,
      {
        key: `l${++seq}`,
        medicine: m,
        dosage: m.strength,
        frequency,
        durationDays,
        quantity: autoQty(m, frequency, durationDays),
        quantityEdited: false,
        instructions: "",
      },
    ]);
  };

  const patch = (key: string, p: Partial<Line>) => {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...p };
        if (!next.quantityEdited && ("frequency" in p || "durationDays" in p))
          next.quantity = autoQty(next.medicine, next.frequency, next.durationDays);
        return next;
      }),
    );
    if (errors[key]) setErrors((e) => ({ ...e, [key]: {} }));
  };

  const toggleChip = (line: Line, chip: string) => {
    const parts = line.instructions
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const has = parts.some((p) => p.toLowerCase() === chip.toLowerCase());
    patch(line.key, { instructions: (has ? parts.filter((p) => p.toLowerCase() !== chip.toLowerCase()) : [...parts, chip]).join("; ") });
  };

  const validate = () => {
    const next: Record<string, LineErrors> = {};
    lines.forEach((l) => {
      const e: LineErrors = {};
      if (!l.dosage.trim()) e.dosage = "Enter a dose";
      const d = Number(l.durationDays);
      if (!Number.isInteger(d) || d < 1 || d > 365) e.durationDays = "1–365 days";
      const q = Number(l.quantity);
      if (!Number.isInteger(q) || q < 1 || q > 1000) e.quantity = "1–1000";
      if (Object.keys(e).length) next[l.key] = e;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (overrideAllergyWarning = false) => {
    if (!lines.length || !validate()) return;
    const body: CreatePrescriptionRequest = {
      medicalRecordId: record.id,
      notes: toPlainText(notes).trim() || undefined,
      overrideAllergyWarning: overrideAllergyWarning || undefined,
      items: lines.map((l) => ({
        medicineId: l.medicine.id,
        dosage: toPlainText(l.dosage).trim(),
        frequency: l.frequency,
        durationDays: Number(l.durationDays),
        quantity: Number(l.quantity),
        instructions: toPlainText(l.instructions).trim() || undefined,
      })),
    };
    try {
      const rx = await create.mutateAsync(body);
      setConflict(null);
      setLines([]);
      setNotes("");
      toast.success(`Prescription ${rx.number} issued`, { description: "Sent to pharmacy." });
    } catch (err) {
      if (err instanceof ApiError && err.code === "ALLERGY_CONFLICT") setConflict(err.message);
      else {
        setConflict(null);
        toast.error(errorMessage(err));
      }
    }
  };

  return (
    <SectionCard title="Prescription" description="Build and sign an e-prescription. It's sent to the pharmacy on issue.">
      <div className="space-y-5">
        <div className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 dark:border-amber-500/30 dark:bg-amber-500/5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-900 uppercase dark:text-amber-300">
            <ShieldAlert className="size-3.5" aria-hidden /> Allergies
          </span>
          <AllergyBadges allergies={allergies} emptyLabel="No known allergies" />
        </div>

        {canPrescribe && (
          <div className="space-y-4">
            <MedicineCombobox id="rx-medicine" onSelect={addMedicine} />

            {lines.length > 0 && (
              <ol className="space-y-3">
                {lines.map((l, i) => {
                  const e = errors[l.key] ?? {};
                  const pid = `rx-${l.key}`;
                  return (
                    <li key={l.key} className="space-y-3 rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">
                            <span className="text-muted-foreground mr-1 tabular-nums">{i + 1}.</span>
                            {l.medicine.name} <span className="text-muted-foreground text-sm font-normal">{l.medicine.strength}</span>
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {l.medicine.genericName} · {humanize(l.medicine.form)} ·{" "}
                            <span className={cn("tabular-nums", l.medicine.totalStock === 0 && "text-destructive font-medium")}>
                              {l.medicine.totalStock === 0 ? "out of stock" : `${l.medicine.totalStock} in stock`}
                            </span>
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${l.medicine.name}`}
                          onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_12rem_7rem_7rem]">
                        <Field data-invalid={!!e.dosage} className="gap-1">
                          <FieldLabel htmlFor={`${pid}-dosage`} className="text-xs">
                            Dose
                          </FieldLabel>
                          <Input
                            id={`${pid}-dosage`}
                            value={l.dosage}
                            onChange={(ev) => patch(l.key, { dosage: ev.target.value })}
                            aria-invalid={!!e.dosage}
                          />
                          <FieldError errors={e.dosage ? [{ message: e.dosage }] : undefined} className="text-xs" />
                        </Field>
                        <Field className="gap-1">
                          <FieldLabel htmlFor={`${pid}-freq`} className="text-xs">
                            Frequency
                          </FieldLabel>
                          <Select value={l.frequency} onValueChange={(v) => patch(l.key, { frequency: v as Frequency })}>
                            <SelectTrigger id={`${pid}-freq`} className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FREQUENCIES.map((f) => (
                                <SelectItem key={f} value={f}>
                                  {f} — {FREQUENCY_LABELS[f]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field data-invalid={!!e.durationDays} className="gap-1">
                          <FieldLabel htmlFor={`${pid}-days`} className="text-xs">
                            Days
                          </FieldLabel>
                          <Input
                            id={`${pid}-days`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={365}
                            className="tabular-nums"
                            value={l.durationDays}
                            onChange={(ev) => patch(l.key, { durationDays: ev.target.value })}
                            aria-invalid={!!e.durationDays}
                          />
                          <FieldError errors={e.durationDays ? [{ message: e.durationDays }] : undefined} className="text-xs" />
                        </Field>
                        <Field data-invalid={!!e.quantity} className="gap-1">
                          <FieldLabel htmlFor={`${pid}-qty`} className="text-xs">
                            Quantity
                          </FieldLabel>
                          <Input
                            id={`${pid}-qty`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            className="tabular-nums"
                            value={l.quantity}
                            onChange={(ev) => patch(l.key, { quantity: ev.target.value, quantityEdited: true })}
                            aria-invalid={!!e.quantity}
                            aria-describedby={`${pid}-qty-hint`}
                          />
                          <span id={`${pid}-qty-hint`} className="sr-only">
                            {countable(l.medicine) ? "Calculated from frequency and days unless edited" : "Units such as bottles or tubes"}
                          </span>
                          <FieldError errors={e.quantity ? [{ message: e.quantity }] : undefined} className="text-xs" />
                        </Field>
                      </div>
                      <Field className="gap-1">
                        <FieldLabel htmlFor={`${pid}-instr`} className="text-xs">
                          Instructions
                        </FieldLabel>
                        <Input
                          id={`${pid}-instr`}
                          value={l.instructions}
                          onChange={(ev) => patch(l.key, { instructions: ev.target.value })}
                          placeholder="e.g. After food"
                        />
                        <div className="flex flex-wrap gap-1" role="group" aria-label="Quick instructions">
                          {QUICK_INSTRUCTIONS.map((chip) => {
                            const on = l.instructions.toLowerCase().includes(chip.toLowerCase());
                            return (
                              <Button
                                key={chip}
                                type="button"
                                size="xs"
                                variant={on ? "secondary" : "outline"}
                                aria-pressed={on}
                                onClick={() => toggleChip(l, chip)}
                              >
                                {chip}
                              </Button>
                            );
                          })}
                        </div>
                      </Field>
                    </li>
                  );
                })}
              </ol>
            )}

            <Field>
              <FieldLabel htmlFor="rx-notes">Advice / notes</FieldLabel>
              <Textarea
                id="rx-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Plenty of fluids, review if fever persists beyond 3 days"
              />
            </Field>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                {lines.length
                  ? `${lines.length} medicine${lines.length > 1 ? "s" : ""}`
                  : "Add at least one medicine to issue a prescription."}
              </p>
              <Button type="button" onClick={() => submit(false)} disabled={!lines.length || create.isPending}>
                {create.isPending ? <Loader2 className="animate-spin" /> : <FileSignature />}
                Sign &amp; issue
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Issued this visit</h3>
          {issued.length === 0 ? (
            <EmptyState compact icon={Pill} title="No prescriptions issued yet" />
          ) : (
            <ul className="divide-y rounded-lg border">
              {issued.map((rx) => (
                <li key={rx.id}>
                  <Link
                    href={ROUTES.prescription(rx.id)}
                    className="hover:bg-muted/50 focus-visible:outline-ring flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 focus-visible:outline-2"
                  >
                    <span className="font-mono text-sm font-medium">{rx.number}</span>
                    <StatusBadge status={rx.status} />
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                      {rx.items.map((it) => it.medicineName).join(", ")}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">{formatDateTime(rx.signedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={conflict !== null} onOpenChange={(o) => !o && setConflict(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive size-5" aria-hidden />
              Allergy warning
            </DialogTitle>
            <DialogDescription>{conflict}</DialogDescription>
          </DialogHeader>
          <div className="bg-muted/40 space-y-1.5 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-semibold uppercase">Recorded allergies</p>
            <AllergyBadges allergies={allergies} />
          </div>
          <p className="text-muted-foreground text-sm">Overriding is recorded in the audit log against your name.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflict(null)} disabled={create.isPending} autoFocus>
              Review prescription
            </Button>
            <Button className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => submit(true)} disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              Prescribe anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
