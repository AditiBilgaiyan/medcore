"use client";

import { FlaskConical, Loader2, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LabResultsTable } from "@/components/shared/clinical";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { toPlainText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { useCancelLabOrder, useCreateLabOrder, useLabOrders, useLabTests } from "@/services/lab";
import type { LabPriority, LabTest, MedicalRecord } from "@/types";

const PRIORITIES: { value: LabPriority; label: string; hint: string }[] = [
  { value: "ROUTINE", label: "Routine", hint: "Standard turnaround" },
  { value: "URGENT", label: "Urgent", hint: "Lab notified" },
  { value: "STAT", label: "STAT", hint: "Process immediately" },
];

export function LabOrdersSection({ record, canOrder }: { record: MedicalRecord; canOrder: boolean }) {
  const { user } = useAuth();
  const orders = useLabOrders({ patientId: record.patientId, limit: 50 });
  const cancel = useCancelLabOrder();
  const mine = orders.data?.data.filter((o) => o.medicalRecordId === record.id) ?? [];

  return (
    <SectionCard title="Lab orders" description="Order investigations for this visit. Results appear here once the lab releases them.">
      <div className="space-y-5">
        {canOrder && <LabOrderForm record={record} />}

        <div className="space-y-3">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Ordered this visit</h3>
          {orders.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : orders.error ? (
            <ErrorState error={orders.error} onRetry={() => orders.refetch()} className="py-6" />
          ) : mine.length === 0 ? (
            <EmptyState compact icon={FlaskConical} title="No tests ordered yet" />
          ) : (
            <ul className="space-y-3">
              {mine.map((o) => {
                const cancellable = (o.status === "ORDERED" || o.status === "SAMPLE_COLLECTED") && user?.doctorId === o.doctorId;
                return (
                  <li key={o.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <Link href={ROUTES.labOrder(o.id)} className="font-mono font-medium hover:underline">
                            {o.number}
                          </Link>
                          <StatusBadge status={o.status} />
                          <StatusBadge status={o.priority} />
                        </p>
                        <p className="text-sm">{o.tests.map((t) => t.testName).join(", ")}</p>
                        <p className="text-muted-foreground text-xs">
                          Ordered {formatDateTime(o.createdAt)}
                          {o.clinicalNotes && ` · ${o.clinicalNotes}`}
                        </p>
                        {o.status === "REJECTED" && o.rejectionReason && (
                          <p className="text-destructive text-xs">Rejected: {o.rejectionReason}</p>
                        )}
                      </div>
                      {cancellable && (
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="sm">
                              <XCircle /> Cancel
                            </Button>
                          }
                          title={`Cancel ${o.number}?`}
                          description="The lab will stop work on this order. This can't be undone."
                          confirmLabel="Cancel order"
                          destructive
                          onConfirm={async () => {
                            await cancel.mutateAsync(o.id);
                            toast.success(`${o.number} cancelled`);
                          }}
                        />
                      )}
                    </div>
                    {o.results.length > 0 && <LabResultsTable results={o.results} tests={o.tests} />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function LabOrderForm({ record }: { record: MedicalRecord }) {
  const tests = useLabTests();
  const create = useCreateLabOrder();
  const [selected, setSelected] = useState<string[]>([]);
  const [priority, setPriority] = useState<LabPriority>("ROUTINE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();

  const grouped = useMemo(() => {
    const map = new Map<string, LabTest[]>();
    (tests.data ?? []).forEach((t) => map.set(t.category, [...(map.get(t.category) ?? []), t]));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tests.data]);

  const total = (tests.data ?? []).filter((t) => selected.includes(t.id)).reduce((s, t) => s + t.price, 0);

  const toggle = (id: string, on: boolean) => {
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
    setError(undefined);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected.length) {
      setError("Select at least one test");
      return;
    }
    try {
      const order = await create.mutateAsync({
        medicalRecordId: record.id,
        testIds: selected,
        priority,
        clinicalNotes: toPlainText(notes).trim() || undefined,
      });
      toast.success(`Lab order ${order.number} placed`);
      setSelected([]);
      setPriority("ROUTINE");
      setNotes("");
    } catch {
      // toast from the mutation cache
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tests</legend>
        {tests.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : tests.error ? (
          <ErrorState error={tests.error} onRetry={() => tests.refetch()} className="py-6" />
        ) : (
          <div
            className="max-h-72 space-y-3 overflow-y-auto rounded-lg border p-3"
            aria-describedby={error ? "lab-tests-error" : undefined}
          >
            {grouped.map(([category, list]) => (
              <div key={category} role="group" aria-labelledby={`labcat-${category}`}>
                <p id={`labcat-${category}`} className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                  {category}
                </p>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {list.map((t) => {
                    const checked = selected.includes(t.id);
                    return (
                      <li key={t.id}>
                        <Label
                          htmlFor={`labtest-${t.id}`}
                          className={cn(
                            "hover:bg-muted/60 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-normal",
                            checked && "bg-secondary/60",
                          )}
                        >
                          <Checkbox id={`labtest-${t.id}`} checked={checked} onCheckedChange={(c) => toggle(t.id, c === true)} />
                          <span className="min-w-0 flex-1 truncate">
                            {t.name} <span className="text-muted-foreground font-mono text-xs">{t.code}</span>
                          </span>
                          <span className="text-muted-foreground text-xs tabular-nums">{formatCurrency(t.price)}</span>
                        </Label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        <FieldError id="lab-tests-error" errors={error ? [{ message: error }] : undefined} />
      </fieldset>

      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Priority</legend>
          <RadioGroup value={priority} onValueChange={(v) => setPriority(v as LabPriority)} className="flex gap-2">
            {PRIORITIES.map((p) => (
              <Label
                key={p.value}
                htmlFor={`prio-${p.value}`}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 font-normal",
                  priority === p.value && "border-primary bg-accent/40",
                )}
              >
                <RadioGroupItem id={`prio-${p.value}`} value={p.value} />
                <span>
                  <span className="block text-sm font-medium">{p.label}</span>
                  <span className="text-muted-foreground block text-xs">{p.hint}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
        <Field>
          <FieldLabel htmlFor="lab-notes">Clinical notes for the lab</FieldLabel>
          <Textarea
            id="lab-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Fasting sample, suspected anaemia"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {selected.length} test{selected.length === 1 ? "" : "s"} selected ·{" "}
          <span className="text-foreground font-medium tabular-nums">{formatCurrency(total)}</span>
        </p>
        <Button type="submit" size="sm" disabled={create.isPending}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          Place lab order
        </Button>
      </div>
    </form>
  );
}
