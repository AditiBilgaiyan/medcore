"use client";

import { useQueries } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ClipboardCheck, History, Loader2, PackageCheck, ReceiptText, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";
import { AllergyBadges } from "@/components/shared/clinical";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api/client";
import { FREQUENCY_LABELS } from "@/lib/clinical";
import { ageGender, formatDate, formatDateTime, formatNumber, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePrescription, useDispense } from "@/services/prescriptions";
import { qk } from "@/services/query-keys";
import type { Allergy, Medicine, PrescriptionDetail, PrescriptionItem } from "@/types";
import { ExpiryBadge, expiredUnquarantinedQty, planFifo } from "./pharmacy-utils";

const CHECKS = [
  { key: "identity", label: "Patient identity confirmed", hint: "Two identifiers — name and MRN or date of birth." },
  { key: "allergies", label: "Allergies reviewed against every item", hint: "Check the recorded allergies above." },
  { key: "dosage", label: "Dosage, frequency and duration checked", hint: "Quantities match the prescribed course." },
] as const;
type CheckKey = (typeof CHECKS)[number]["key"];

const ERROR_TITLES: Record<string, string> = {
  EXPIRED_STOCK: "Remaining stock is expired",
  INSUFFICIENT_STOCK: "Not enough stock",
  QUANTITY_EXCEEDS_PRESCRIBED: "More than prescribed",
};

function allergyMatches(allergies: Allergy[], item: PrescriptionItem, med?: Medicine): Allergy[] {
  const haystack = `${item.medicineName} ${med?.genericName ?? ""} ${med?.category ?? ""}`.toLowerCase();
  return allergies.filter((a) => {
    const needle = a.substance.trim().toLowerCase();
    return needle.length > 2 && haystack.includes(needle);
  });
}

/** Medicine details per prescription item — same cache entries as useMedicine(). */
function useItemMedicines(items: PrescriptionItem[]) {
  const ids = [...new Set(items.map((i) => i.medicineId))];
  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: qk.pharmacy.detail(id), queryFn: () => api.get<Medicine>(`/medicines/${id}`) })),
  });
  const byId = new Map<string, Medicine>();
  results.forEach((r, i) => r.data && byId.set(ids[i], r.data));
  return { byId, loading: results.some((r) => r.isLoading), error: results.find((r) => r.error)?.error };
}

interface ItemRowProps {
  item: PrescriptionItem;
  medicine?: Medicine;
  loading: boolean;
  allergies: Allergy[];
  value: string;
  onChange?: (v: string) => void;
  readOnly: boolean;
  error?: string;
}

function ItemRow({ item, medicine, loading, allergies, value, onChange, readOnly, error }: ItemRowProps) {
  const inputId = useId();
  const remaining = Math.max(0, item.quantity - item.dispensedQty);
  const qty = Number(value) || 0;
  const plan = medicine ? planFifo(medicine, qty) : undefined;
  const expiredQty = medicine ? expiredUnquarantinedQty(medicine) : 0;
  const matches = allergyMatches(allergies, item, medicine);
  const done = remaining === 0;

  return (
    <li className={cn("space-y-3 p-4", matches.length > 0 && "bg-destructive/5")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {medicine ? (
              <Link
                href={ROUTES.medicine(item.medicineId)}
                className="focus-visible:outline-ring rounded hover:underline focus-visible:outline-2"
              >
                {item.medicineName}
              </Link>
            ) : (
              item.medicineName
            )}
            <span className="text-muted-foreground text-xs font-normal">
              {medicine ? `${medicine.strength} · ` : ""}
              {humanize(item.form)}
            </span>
            {done && <StatusBadge status="DISPENSED" label="Fully dispensed" />}
            {matches.map((a) => (
              <StatusBadge key={a.substance} status="ALLERGY" tone="danger" label={`Allergy: ${a.substance}`} />
            ))}
          </p>
          {medicine?.genericName && <p className="text-muted-foreground text-xs">{medicine.genericName}</p>}
          <p className="text-sm">
            {item.dosage} · {FREQUENCY_LABELS[item.frequency]} ({item.frequency}) · {item.durationDays} day
            {item.durationDays === 1 ? "" : "s"}
          </p>
          {item.instructions && <p className="text-muted-foreground text-xs italic">{item.instructions}</p>}
        </div>
        <dl className="grid shrink-0 grid-cols-4 gap-3 text-center sm:gap-4">
          {[
            { label: "Prescribed", value: item.quantity },
            { label: "Dispensed", value: item.dispensedQty },
            { label: "Remaining", value: remaining, strong: true },
            { label: "In stock", value: medicine?.totalStock, danger: medicine ? medicine.totalStock < remaining : false },
          ].map((s) => (
            <div key={s.label}>
              <dt className="text-muted-foreground text-[11px] uppercase">{s.label}</dt>
              <dd
                className={cn(
                  "font-heading text-base tabular-nums",
                  s.strong && "font-semibold",
                  s.danger && "text-destructive font-semibold",
                )}
              >
                {s.value === undefined ? loading ? <Skeleton className="mx-auto h-5 w-8" /> : "—" : formatNumber(s.value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {!readOnly && !done && (
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start">
          <div className="space-y-1">
            <Label htmlFor={inputId}>
              Quantity to dispense
              <span className="sr-only">
                {" "}
                of {item.medicineName}, maximum {remaining}
              </span>
            </Label>
            <Input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={0}
              max={remaining}
              step={1}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              aria-invalid={!!error || undefined}
              aria-describedby={`${inputId}-plan`}
              className="w-full tabular-nums"
            />
            <p className="text-muted-foreground text-xs tabular-nums">0 – {remaining}</p>
          </div>
          <div id={`${inputId}-plan`} className="min-w-0 space-y-1.5" aria-live="polite">
            {error ? (
              <p role="alert" className="text-destructive flex items-start gap-1.5 text-sm font-medium">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs font-medium uppercase">FIFO batches</p>
            {loading && !medicine ? (
              <Skeleton className="h-6 w-full" />
            ) : !medicine ? (
              <p className="text-muted-foreground text-sm">Stock details unavailable.</p>
            ) : qty === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing will be dispensed for this item.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {plan!.picks.map((p) => (
                  <li key={p.batch.id} className="bg-muted/30 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                    <span className="font-mono">{p.batch.batchNumber}</span>
                    <span className="text-muted-foreground tabular-nums">exp {formatDate(p.batch.expiryDate)}</span>
                    <ExpiryBadge date={p.batch.expiryDate} className="px-1.5 py-0 text-[11px]" />
                    <span className="font-semibold tabular-nums">× {formatNumber(p.qty)}</span>
                  </li>
                ))}
                {plan!.shortfall > 0 && (
                  <li className="border-destructive/40 bg-destructive/5 text-destructive inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium tabular-nums">
                    Short by {formatNumber(plan!.shortfall)}
                  </li>
                )}
              </ul>
            )}
            {expiredQty > 0 && (
              <p className="text-destructive text-xs">
                {formatNumber(expiredQty)} expired unit{expiredQty === 1 ? "" : "s"} on the shelf can&apos;t be dispensed — quarantine them.
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function DispensationHistory({ rx }: { rx: PrescriptionDetail }) {
  const nameOf = (itemId: string) => rx.items.find((i) => i.id === itemId)?.medicineName ?? "—";
  const rows = [...rx.dispensations].sort((a, b) => b.dispensedAt.localeCompare(a.dispensedAt));
  return (
    <SectionCard
      title="Dispensation history"
      description="Batch-level record of everything dispensed against this prescription."
      contentClassName="p-0"
    >
      {rows.length === 0 ? (
        <EmptyState icon={History} title="Nothing dispensed yet" compact />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <caption className="sr-only">Dispensation history</caption>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                {["When", "Medicine", "Batch", "Qty", "Dispensed by"].map((h) => (
                  <TableHead
                    key={h}
                    className={cn("text-muted-foreground h-9 text-xs font-semibold uppercase", h === "Qty" && "text-right")}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="py-2 whitespace-nowrap tabular-nums">{formatDateTime(d.dispensedAt)}</TableCell>
                  <TableCell className="py-2">{nameOf(d.itemId)}</TableCell>
                  <TableCell className="py-2 font-mono text-xs">{d.batchNumber}</TableCell>
                  <TableCell className="py-2 text-right font-medium tabular-nums">{formatNumber(d.quantity)}</TableCell>
                  <TableCell className="py-2 whitespace-nowrap">{d.dispensedByName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}

function InvoiceLink({ patientId }: { patientId: string }) {
  const { can } = useAuth();
  if (can("billing:read")) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href={`${ROUTES.billing}?patientId=${encodeURIComponent(patientId)}`}>
          <ReceiptText /> Patient invoices
        </Link>
      </Button>
    );
  }
  if (can("patients:read")) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href={ROUTES.patient(patientId)}>
          <ReceiptText /> Patient record
        </Link>
      </Button>
    );
  }
  return null;
}

export function DispenseWorkbench({ id }: { id: string }) {
  const { data: rx, isLoading, error, refetch } = usePrescription(id);
  const meds = useItemMedicines(rx?.items ?? []);
  const dispense = useDispense(id);

  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<CheckKey, boolean>>({ identity: false, allergies: false, dosage: false });
  const [success, setSuccess] = useState<{ units: number; status: string } | null>(null);

  if (isLoading) return <DetailSkeleton />;
  if (error || !rx) return <ErrorState error={error ?? new Error("Prescription not found")} onRetry={() => refetch()} />;

  const allergies = rx.patient?.allergies ?? [];
  const readOnly = rx.status === "DISPENSED" || rx.status === "CANCELLED";
  const pendingItems = rx.items.filter((i) => i.quantity > i.dispensedQty);

  const defaultQty = (item: PrescriptionItem) => {
    const remaining = Math.max(0, item.quantity - item.dispensedQty);
    const stock = meds.byId.get(item.medicineId)?.totalStock ?? 0;
    return Math.min(remaining, stock);
  };
  const valueFor = (item: PrescriptionItem) => overrides[item.id] ?? String(defaultQty(item));

  const lineErrors = new Map<string, string>();
  for (const item of pendingItems) {
    const raw = valueFor(item).trim();
    const remaining = item.quantity - item.dispensedQty;
    const n = Number(raw);
    const med = meds.byId.get(item.medicineId);
    if (raw === "" || !Number.isInteger(n) || n < 0) lineErrors.set(item.id, "Enter a whole number (0 or more).");
    else if (n > remaining) lineErrors.set(item.id, `Only ${remaining} left to dispense on this prescription.`);
    else if (med && n > med.totalStock) {
      const expired = expiredUnquarantinedQty(med);
      lineErrors.set(
        item.id,
        expired > 0 && med.totalStock + expired >= n
          ? `Only ${med.totalStock} usable — the rest of the stock is expired.`
          : `Only ${med.totalStock} in stock.`,
      );
    }
  }
  const lines = pendingItems.map((i) => ({ itemId: i.id, quantity: Number(valueFor(i)) || 0 }));
  const totalUnits = lines.reduce((s, l) => s + l.quantity, 0);
  const allChecked = CHECKS.every((c) => checks[c.key]);
  const blockers = [
    !allChecked && "complete the verification checklist",
    lineErrors.size > 0 && "fix the highlighted quantities",
    totalUnits === 0 && "enter a quantity for at least one item",
    meds.loading && "wait for stock to load",
  ].filter(Boolean) as string[];

  const apiError = dispense.error instanceof ApiError ? dispense.error : null;

  const onQtyChange = (itemId: string, v: string) => {
    setOverrides((o) => ({ ...o, [itemId]: v }));
    if (dispense.error) dispense.reset();
  };

  const submit = async () => {
    try {
      const res = await dispense.mutateAsync({ items: lines.filter((l) => l.quantity > 0) });
      setSuccess({ units: totalUnits, status: res.status });
      setOverrides({});
      setChecks({ identity: false, allergies: false, dosage: false });
      toast.success(res.status === "DISPENSED" ? "Prescription fully dispensed" : "Partially dispensed", {
        description: `${totalUnits} unit${totalUnits === 1 ? "" : "s"} dispensed. Charges added to the patient's invoice.`,
      });
    } catch {
      // Shown inline below (and toasted globally).
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Dispensing", href: ROUTES.dispense }, { label: rx.number }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{rx.number}</span>
            <StatusBadge status={rx.status} />
          </span>
        }
        description={`Prescribed by ${rx.doctorName}${rx.doctor?.registrationNumber ? ` (Reg. ${rx.doctor.registrationNumber})` : ""} · signed ${formatDateTime(rx.signedAt)}`}
        actions={<InvoiceLink patientId={rx.patientId} />}
      />

      {success && (
        <Alert className="border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <CheckCircle2 className="text-emerald-700 dark:text-emerald-400" />
          <AlertTitle>
            {success.status === "DISPENSED" ? "Prescription fully dispensed" : "Partially dispensed"} — {formatNumber(success.units)} unit
            {success.units === 1 ? "" : "s"}
          </AlertTitle>
          <AlertDescription>
            <p>
              Pharmacy charges were added to the patient&apos;s visit invoice and the patient was notified that their medicines are ready.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <InvoiceLink patientId={rx.patientId} />
              <Button variant="ghost" size="sm" asChild>
                <Link href={ROUTES.dispense}>Back to queue</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <SectionCard title="Patient" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-base font-semibold">{rx.patientName}</p>
              <p className="text-muted-foreground text-sm tabular-nums">
                {rx.patient ? (
                  <>
                    MRN <span className="font-mono">{rx.patient.mrn}</span> · {ageGender(rx.patient.dob, rx.patient.gender)} · DOB{" "}
                    {formatDate(rx.patient.dob)}
                  </>
                ) : (
                  "—"
                )}
              </p>
              {rx.patient?.phone && <p className="text-muted-foreground text-sm tabular-nums">{rx.patient.phone}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium uppercase">Diagnoses</p>
              {rx.diagnoses.length ? (
                <ul className="space-y-0.5 text-sm">
                  {rx.diagnoses.map((d) => (
                    <li key={`${d.code}-${d.description}`}>
                      <span className="text-muted-foreground font-mono text-xs">{d.code}</span> {d.description}
                      {d.type === "DIFFERENTIAL" && <span className="text-muted-foreground text-xs"> (differential)</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">None recorded</p>
              )}
            </div>
          </div>
          <div className={cn("mt-4 rounded-lg border p-3", allergies.length ? "border-destructive/40 bg-destructive/5" : "bg-muted/30")}>
            <p className={cn("mb-1.5 flex items-center gap-1.5 text-sm font-semibold", allergies.length && "text-destructive")}>
              <ShieldAlert className="size-4" aria-hidden /> Allergies
            </p>
            <AllergyBadges allergies={allergies} emptyLabel="No known drug allergies (NKDA)" />
            {allergies.length > 0 && (
              <ul className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                {allergies.map((a) => (
                  <li key={a.substance}>
                    <span className="text-foreground font-medium">{a.substance}</span> — {a.reaction} ({a.severity.toLowerCase()})
                  </li>
                ))}
              </ul>
            )}
          </div>
          {rx.notes && (
            <div className="mt-4 space-y-0.5">
              <p className="text-muted-foreground text-xs font-medium uppercase">Prescriber notes</p>
              <p className="text-sm whitespace-pre-wrap">{rx.notes}</p>
            </div>
          )}
        </SectionCard>

        {readOnly ? (
          <SectionCard title="Status">
            <EmptyState
              icon={rx.status === "DISPENSED" ? PackageCheck : AlertTriangle}
              title={rx.status === "DISPENSED" ? "Fully dispensed" : "Prescription cancelled"}
              description={
                rx.status === "DISPENSED"
                  ? "Every item has been dispensed. This prescription is read-only."
                  : "Cancelled by the prescriber — nothing can be dispensed."
              }
              compact
            />
          </SectionCard>
        ) : (
          <SectionCard title="Verification" description="All checks are required before dispensing.">
            <fieldset className="space-y-3">
              <legend className="sr-only">Verification checklist</legend>
              {CHECKS.map((c) => (
                <div key={c.key} className="flex items-start gap-2.5">
                  <Checkbox
                    id={`check-${c.key}`}
                    checked={checks[c.key]}
                    onCheckedChange={(v) => setChecks((s) => ({ ...s, [c.key]: v === true }))}
                    aria-describedby={`check-${c.key}-hint`}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor={`check-${c.key}`} className="leading-snug">
                      {c.label}
                    </Label>
                    <p id={`check-${c.key}-hint`} className="text-muted-foreground text-xs">
                      {c.hint}
                    </p>
                  </div>
                </div>
              ))}
            </fieldset>
            <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs tabular-nums" aria-live="polite">
              <ClipboardCheck className="size-3.5" aria-hidden />
              {CHECKS.filter((c) => checks[c.key]).length} of {CHECKS.length} complete
            </p>
          </SectionCard>
        )}
      </div>

      <SectionCard
        title="Items"
        description={
          readOnly ? undefined : "Quantities default to what's remaining (capped by stock). Batches are picked first-expiry-first-out."
        }
        contentClassName="p-0"
      >
        {meds.error && !meds.loading ? (
          <Alert variant="destructive" className="m-4 w-auto">
            <AlertTriangle />
            <AlertTitle>Couldn&apos;t load stock for some items</AlertTitle>
            <AlertDescription>Reload the page before dispensing.</AlertDescription>
          </Alert>
        ) : null}
        <ul className="divide-y">
          {rx.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              medicine={meds.byId.get(item.medicineId)}
              loading={meds.loading}
              allergies={allergies}
              value={valueFor(item)}
              onChange={(v) => onQtyChange(item.id, v)}
              readOnly={readOnly}
              error={lineErrors.get(item.id)}
            />
          ))}
        </ul>

        {!readOnly && pendingItems.length > 0 && (
          <div className="space-y-3 border-t p-4">
            {apiError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>{ERROR_TITLES[apiError.code] ?? "Couldn't dispense"}</AlertTitle>
                <AlertDescription>{apiError.message} Nothing was dispensed — stock is unchanged.</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm" aria-live="polite">
                {blockers.length ? (
                  <>To dispense, {blockers.join(", ")}.</>
                ) : (
                  <>
                    Dispensing <span className="text-foreground font-semibold tabular-nums">{formatNumber(totalUnits)}</span> unit
                    {totalUnits === 1 ? "" : "s"} across{" "}
                    <span className="text-foreground font-semibold tabular-nums">{lines.filter((l) => l.quantity > 0).length}</span> item
                    {lines.filter((l) => l.quantity > 0).length === 1 ? "" : "s"}.
                  </>
                )}
              </p>
              <Button onClick={submit} disabled={blockers.length > 0 || dispense.isPending} className="sm:min-w-40">
                {dispense.isPending ? <Loader2 className="animate-spin" /> : <PackageCheck />}
                Dispense
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      <DispensationHistory rx={rx} />
    </div>
  );
}
