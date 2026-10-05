"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, FileText, Loader2, Paperclip, Send, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { MAX_UPLOAD_BYTES } from "@/constants/config";
import { flagResult, formatRange, referenceRange } from "@/lib/clinical";
import { formatBytes, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSubmitResults } from "@/services/lab";
import type { LabOrderDetail, LabParameter, LabTest, ResultFlag, UploadAttachmentRequest } from "@/types";

const schema = z.object({
  values: z.array(
    z
      .string()
      .trim()
      .min(1, "Enter a value")
      .refine((v) => Number.isFinite(Number(v)), "Enter a number"),
  ),
  technicianRemarks: z.string().trim().max(1000, "Keep remarks under 1000 characters"),
});
type FormValues = z.infer<typeof schema>;

interface Row {
  test: LabTest;
  param: LabParameter;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file"));
    reader.readAsDataURL(file);
  });
}

const FLAG_INPUT: Record<ResultFlag, string | undefined> = {
  NORMAL: undefined,
  LOW: "border-amber-500 has-[[data-slot=input-group-control]:focus-visible]:border-amber-500",
  HIGH: "border-amber-500 has-[[data-slot=input-group-control]:focus-visible]:border-amber-500",
  CRITICAL:
    "border-destructive bg-destructive/5 ring-2 ring-destructive/20 has-[[data-slot=input-group-control]:focus-visible]:border-destructive",
};

export function ResultEntryForm({ order }: { order: LabOrderDetail }) {
  const gender = order.patientGender;
  const rows = useMemo<Row[]>(
    () => order.testDefinitions.flatMap((test) => test.parameters.map((param) => ({ test, param }))),
    [order.testDefinitions],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      // After a rejection, start from the previously entered values so the tech only fixes what's wrong.
      values: rows.map(({ test, param }) => {
        const prev = order.results.find((r) => r.testId === test.id && r.parameter === param.name);
        return prev ? String(prev.value) : "";
      }),
      technicianRemarks: order.technicianRemarks ?? "",
    },
  });
  const values = useWatch({ control: form.control, name: "values" });

  const flags = rows.map(({ param }, i) => {
    const raw = values?.[i]?.trim();
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? flagResult(param, n, gender) : undefined;
  });
  const critical = rows.map((r, i) => ({ ...r, value: values?.[i], flag: flags[i] })).filter((r) => r.flag === "CRITICAL");
  const abnormalCount = flags.filter((f) => f && f !== "NORMAL").length;
  const enteredCount = flags.filter(Boolean).length;

  const [attachment, setAttachment] = useState<UploadAttachmentRequest | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (file.type !== "application/pdf") {
      setFileError("Only PDF files can be attached to a lab report.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFileError(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }
    setReading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      setAttachment({ name: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl });
    } catch {
      setFileError("Couldn't read that file. Try again.");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = useSubmitResults(order.id);
  const onSubmit = form.handleSubmit(async (v) => {
    await submit.mutateAsync({
      results: rows.map(({ test, param }, i) => ({ testId: test.id, parameter: param.name, value: Number(v.values[i]) })),
      technicianRemarks: v.technicianRemarks || undefined,
      reportAttachment: attachment ?? undefined,
    });
    toast.success("Results submitted for approval", {
      description: critical.length ? "The ordering doctor has been alerted to the critical values." : undefined,
    });
  });

  const errors = form.formState.errors;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {order.status === "REJECTED" && order.rejectionReason && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Sent back by the reviewer</AlertTitle>
          <AlertDescription>{order.rejectionReason}</AlertDescription>
        </Alert>
      )}

      {critical.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertTriangle />
          <AlertTitle>Critical value{critical.length > 1 ? "s" : ""} — verify before submitting</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {critical.map((c) => (
                <li key={`${c.test.id}-${c.param.name}`}>
                  {c.test.name} → {c.param.name}: <span className="font-semibold tabular-nums">{c.value}</span> {c.param.unit}
                </li>
              ))}
            </ul>
            <p className="mt-1">
              Re-run the sample if in doubt. On submission the ordering doctor is notified immediately by SMS and in-app.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <p className="sr-only" aria-live="polite">
        {enteredCount} of {rows.length} values entered. {abnormalCount} outside the reference range. {critical.length} critical.
      </p>

      {order.testDefinitions.map((test) => (
        <fieldset key={test.id} className="rounded-lg border">
          <legend className="sr-only">{test.name}</legend>
          <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
            <p className="text-sm font-semibold" aria-hidden>
              {test.name} <span className="text-muted-foreground font-mono text-xs font-normal">{test.code}</span>
            </p>
            <p className="text-muted-foreground text-xs">
              {test.sampleType} · ranges for {humanize(gender).toLowerCase()} patient
            </p>
          </div>
          <div className="text-muted-foreground hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem] gap-3 px-3 pt-2 text-xs font-medium uppercase sm:grid">
            <span>Parameter · reference</span>
            <span>Result</span>
            <span>Flag</span>
          </div>
          <div className="divide-y">
            {test.parameters.map((param) => {
              const i = rows.findIndex((r) => r.test.id === test.id && r.param.name === param.name);
              const [lo, hi] = referenceRange(param, gender);
              const flag = flags[i];
              const id = `result-${i}`;
              const err = errors.values?.[i];
              const hasCritical = param.criticalLow != null || param.criticalHigh != null;
              return (
                <Field
                  key={param.name}
                  data-invalid={!!err || undefined}
                  className="grid gap-x-3 gap-y-1.5 px-3 py-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7rem] sm:items-center"
                >
                  <div className="min-w-0">
                    <FieldLabel htmlFor={id} className="text-foreground font-medium">
                      {param.name}
                      <span className="sr-only"> ({param.unit})</span>
                    </FieldLabel>
                    <FieldDescription id={`${id}-ref`} className="text-xs tabular-nums">
                      Ref {formatRange(lo, hi)} {param.unit}
                      {hasCritical && (
                        <span className="text-destructive/80">
                          {" "}
                          · critical {param.criticalLow != null ? `< ${param.criticalLow}` : ""}
                          {param.criticalLow != null && param.criticalHigh != null ? " or " : ""}
                          {param.criticalHigh != null ? `> ${param.criticalHigh}` : ""}
                        </span>
                      )}
                    </FieldDescription>
                  </div>
                  <div className="min-w-0">
                    <InputGroup className={cn("w-full", flag && FLAG_INPUT[flag])}>
                      <InputGroupInput
                        id={id}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        autoComplete="off"
                        aria-invalid={!!err || undefined}
                        aria-describedby={`${id}-ref ${id}-flag`}
                        className={cn("tabular-nums", flag && flag !== "NORMAL" && "text-destructive font-semibold")}
                        {...form.register(`values.${i}`)}
                      />
                      <InputGroupAddon align="inline-end" aria-hidden>
                        <InputGroupText className="text-xs">{param.unit}</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    {err && <FieldError errors={[err]} className="mt-1 text-xs" />}
                  </div>
                  <div id={`${id}-flag`} className="flex items-center gap-1.5">
                    {flag ? (
                      <>
                        <StatusBadge status={flag} className={cn(flag === "CRITICAL" && "font-semibold")} />
                        <span className="sr-only">flag</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                </Field>
              );
            })}
          </div>
        </fieldset>
      ))}

      <Field data-invalid={!!errors.technicianRemarks || undefined}>
        <FieldLabel htmlFor="tech-remarks">Technician remarks</FieldLabel>
        <Textarea
          id="tech-remarks"
          rows={3}
          placeholder="Sample quality, repeat runs, method notes…"
          aria-invalid={!!errors.technicianRemarks || undefined}
          {...form.register("technicianRemarks")}
        />
        <FieldError errors={[errors.technicianRemarks]} />
      </Field>

      <div className="space-y-2">
        <p className="text-sm font-medium" id="report-upload-label">
          Report PDF <span className="text-muted-foreground font-normal">(optional · PDF only · max {formatBytes(MAX_UPLOAD_BYTES)})</span>
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="sr-only"
          id="report-upload"
          aria-labelledby="report-upload-label"
          onChange={(e) => void onFile(e.target.files?.[0])}
          tabIndex={-1}
        />
        {attachment ? (
          <div className="bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{formatBytes(attachment.sizeBytes)}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${attachment.name}`}
              onClick={() => setAttachment(null)}
            >
              <X />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={reading}
            aria-describedby="report-upload-label"
          >
            {reading ? <Loader2 className="animate-spin" /> : <Paperclip />} Attach PDF
          </Button>
        )}
        {fileError && (
          <p role="alert" className="text-destructive text-sm">
            {fileError}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs tabular-nums">
          {enteredCount}/{rows.length} entered
          {abnormalCount > 0 && <span className="text-destructive"> · {abnormalCount} abnormal</span>}
          {critical.length > 0 && <span className="text-destructive font-semibold"> · {critical.length} critical</span>}
          {" · "}A second technician must approve before release.
        </p>
        <Button type="submit" disabled={submit.isPending || reading}>
          {submit.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          Submit for approval
        </Button>
      </div>
    </form>
  );
}
