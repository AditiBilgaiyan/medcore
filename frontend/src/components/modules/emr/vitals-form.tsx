"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { bmiCategory, calculateBmi, isVitalAbnormal, VITAL_RANGES } from "@/lib/clinical";
import { cn } from "@/lib/utils";
import type { RecordVitalsRequest } from "@/types";

const num = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine(
      (v) => v === "" || Number.isNaN(Number(v)) || (Number(v) >= min && Number(v) <= max),
      `${label} must be between ${min} and ${max}`,
    );

const schema = z
  .object({
    bpSystolic: num(50, 260, "Systolic"),
    bpDiastolic: num(30, 160, "Diastolic"),
    pulse: num(20, 250, "Pulse"),
    temperatureC: num(30, 45, "Temperature"),
    spo2: num(50, 100, "SpO₂"),
    respiratoryRate: num(4, 60, "Respiratory rate"),
    heightCm: num(30, 250, "Height"),
    weightKg: num(1, 400, "Weight"),
  })
  .superRefine((v, ctx) => {
    if (Object.values(v).every((x) => x === ""))
      ctx.addIssue({ code: "custom", path: ["root"], message: "Enter at least one vital sign." });
    if ((v.bpSystolic === "") !== (v.bpDiastolic === "")) {
      ctx.addIssue({
        code: "custom",
        path: [v.bpSystolic === "" ? "bpSystolic" : "bpDiastolic"],
        message: "Enter both systolic and diastolic",
      });
    }
    if (v.bpSystolic && v.bpDiastolic && Number(v.bpDiastolic) >= Number(v.bpSystolic)) {
      ctx.addIssue({ code: "custom", path: ["bpDiastolic"], message: "Diastolic must be lower than systolic" });
    }
  });

type Values = z.infer<typeof schema>;
type Key = keyof Values;
const EMPTY: Values = {
  bpSystolic: "",
  bpDiastolic: "",
  pulse: "",
  temperatureC: "",
  spo2: "",
  respiratoryRate: "",
  heightCm: "",
  weightKg: "",
};

const FIELDS: { key: Key; label: string; unit: string; step?: string; range?: keyof typeof VITAL_RANGES }[] = [
  { key: "bpSystolic", label: "BP systolic", unit: "mmHg", range: "bpSystolic" },
  { key: "bpDiastolic", label: "BP diastolic", unit: "mmHg", range: "bpDiastolic" },
  { key: "pulse", label: "Pulse", unit: "bpm", range: "pulse" },
  { key: "temperatureC", label: "Temperature", unit: "°C", step: "0.1", range: "temperatureC" },
  { key: "spo2", label: "SpO₂", unit: "%", range: "spo2" },
  { key: "respiratoryRate", label: "Resp. rate", unit: "/min", range: "respiratoryRate" },
  { key: "heightCm", label: "Height", unit: "cm", step: "0.1" },
  { key: "weightKg", label: "Weight", unit: "kg", step: "0.1" },
];

const toNum = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

/** Vitals entry with live BMI and out-of-range warnings (warnings never block saving). */
export function VitalsForm({
  idPrefix,
  onSubmit,
  submitLabel = "Save vitals",
  disabled,
  defaultHeightCm,
}: {
  idPrefix: string;
  onSubmit: (body: RecordVitalsRequest) => Promise<unknown>;
  submitLabel?: string;
  disabled?: boolean;
  /** Carry the last known height forward so BMI only needs a weight. */
  defaultHeightCm?: number;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { ...EMPTY, heightCm: defaultHeightCm ? String(defaultHeightCm) : "" },
  });
  const values = form.watch();
  const bmi = calculateBmi(toNum(values.heightCm), toNum(values.weightKg));
  const errors = form.formState.errors;
  const rootError = (errors as { root?: { message?: string } }).root?.message;

  const submit = form.handleSubmit(async (v) => {
    const body: RecordVitalsRequest = {};
    (Object.keys(v) as Key[]).forEach((k) => {
      const n = toNum(v[k]);
      if (n !== undefined) body[k] = n;
    });
    try {
      await onSubmit(body);
      form.reset({ ...EMPTY, heightCm: v.heightCm });
    } catch {
      // toast from the mutation cache
    }
  });

  const abnormal = FIELDS.filter((f) => f.range && isVitalAbnormal(f.range, toNum(values[f.key])));

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <fieldset disabled={disabled || form.formState.isSubmitting} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <legend className="sr-only">Vital signs</legend>
        {FIELDS.map((f) => {
          const id = `${idPrefix}-${f.key}`;
          const err = errors[f.key];
          const out = f.range ? isVitalAbnormal(f.range, toNum(values[f.key])) : false;
          return (
            <Field key={f.key} data-invalid={!!err} className="gap-1.5">
              <FieldLabel htmlFor={id} className="text-xs">
                {f.label}
              </FieldLabel>
              <InputGroup className={cn(out && !err && "border-amber-400 dark:border-amber-500/60")}>
                <InputGroupInput
                  id={id}
                  type="number"
                  inputMode="decimal"
                  step={f.step ?? "1"}
                  className="tabular-nums"
                  aria-invalid={!!err}
                  aria-describedby={out ? `${id}-warn` : undefined}
                  {...form.register(f.key)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText className="text-xs">{f.unit}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              {out && !err && f.range && (
                <p id={`${id}-warn`} className="flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-3" aria-hidden />
                  Outside {VITAL_RANGES[f.range][0]}–{VITAL_RANGES[f.range][1]}
                </p>
              )}
              <FieldError errors={[err]} className="text-xs" />
            </Field>
          );
        })}
      </fieldset>

      <div className="bg-muted/50 flex flex-col gap-3 rounded-lg px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" aria-live="polite">
          <span className="text-muted-foreground">BMI </span>
          <span className="font-semibold tabular-nums">{bmi ?? "—"}</span>
          {bmi != null && <span className="text-muted-foreground"> · {bmiCategory(bmi)}</span>}
          {abnormal.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-3.5" aria-hidden />
              {abnormal.length} reading{abnormal.length > 1 ? "s" : ""} outside normal range
            </span>
          )}
        </p>
        <Button type="submit" size="sm" disabled={disabled || form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
          {submitLabel}
        </Button>
      </div>
      {rootError && (
        <p role="alert" className="text-destructive text-sm">
          {rootError}
        </p>
      )}
    </form>
  );
}
