import { AlertTriangle, Droplets, HeartPulse, Ruler, Thermometer, Weight, Wind, Activity } from "lucide-react";
import { bmiCategory, formatRange, isVitalAbnormal } from "@/lib/clinical";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Allergy, LabResult, LabTest, Vitals } from "@/types";
import { StatusBadge } from "./status-badge";

/** Allergy chips — always visible near clinical actions. */
export function AllergyBadges({ allergies, emptyLabel = "No known allergies" }: { allergies: Allergy[]; emptyLabel?: string }) {
  if (!allergies.length) return <span className="text-muted-foreground text-sm">{emptyLabel}</span>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Allergies">
      {allergies.map((a) => (
        <li
          key={a.substance}
          title={`${a.reaction} (${a.severity.toLowerCase()})`}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
            a.severity === "SEVERE"
              ? "bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30"
              : "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
          )}
        >
          <AlertTriangle className="size-3" aria-hidden />
          {a.substance}
          <span className="sr-only">
            : {a.reaction}, {a.severity.toLowerCase()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function VitalTile({
  icon: Icon,
  label,
  value,
  unit,
  abnormal,
}: {
  icon: typeof HeartPulse;
  label: string;
  value?: string | number;
  unit?: string;
  abnormal?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border p-2.5", abnormal && "border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/10")}>
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </div>
      <p className={cn("font-heading mt-1 text-base font-semibold tabular-nums", abnormal && "text-red-700 dark:text-red-300")}>
        {value ?? "—"}
        {value != null && unit && <span className="text-muted-foreground ml-0.5 text-xs font-normal">{unit}</span>}
        {abnormal && <span className="sr-only"> (outside normal range)</span>}
      </p>
    </div>
  );
}

/** Compact vitals grid; out-of-range values are highlighted (and announced). */
export function VitalsPanel({ vitals, className }: { vitals?: Vitals; className?: string }) {
  if (!vitals) return <p className="text-muted-foreground text-sm">No vitals recorded yet.</p>;
  const bp = vitals.bpSystolic != null ? `${vitals.bpSystolic}/${vitals.bpDiastolic ?? "—"}` : undefined;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <VitalTile
          icon={HeartPulse}
          label="Blood pressure"
          value={bp}
          unit="mmHg"
          abnormal={isVitalAbnormal("bpSystolic", vitals.bpSystolic) || isVitalAbnormal("bpDiastolic", vitals.bpDiastolic)}
        />
        <VitalTile icon={Activity} label="Pulse" value={vitals.pulse} unit="bpm" abnormal={isVitalAbnormal("pulse", vitals.pulse)} />
        <VitalTile
          icon={Thermometer}
          label="Temperature"
          value={vitals.temperatureC}
          unit="°C"
          abnormal={isVitalAbnormal("temperatureC", vitals.temperatureC)}
        />
        <VitalTile icon={Droplets} label="SpO₂" value={vitals.spo2} unit="%" abnormal={isVitalAbnormal("spo2", vitals.spo2)} />
        <VitalTile
          icon={Wind}
          label="Resp. rate"
          value={vitals.respiratoryRate}
          unit="/min"
          abnormal={isVitalAbnormal("respiratoryRate", vitals.respiratoryRate)}
        />
        <VitalTile icon={Ruler} label="Height" value={vitals.heightCm} unit="cm" />
        <VitalTile icon={Weight} label="Weight" value={vitals.weightKg} unit="kg" />
        <VitalTile icon={Activity} label={`BMI${vitals.bmi ? ` · ${bmiCategory(vitals.bmi)}` : ""}`} value={vitals.bmi} />
      </div>
      <p className="text-muted-foreground text-xs">
        Recorded {formatDateTime(vitals.recordedAt)} by {vitals.recordedByName}
      </p>
    </div>
  );
}

/** Lab results table with out-of-range values flagged in red (PRD §7.5). */
export function LabResultsTable({ results, tests }: { results: LabResult[]; tests?: { testId: string; testName: string }[] | LabTest[] }) {
  const groups = new Map<string, LabResult[]>();
  results.forEach((r) => groups.set(r.testId, [...(groups.get(r.testId) ?? []), r]));
  const nameOf = (id: string) => {
    const t = tests?.find((x) => ("testId" in x ? x.testId : x.id) === id);
    return t ? ("testName" in t ? t.testName : t.name) : id;
  };
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Parameter
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Result
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Unit
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Reference range
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Flag
            </th>
          </tr>
        </thead>
        {[...groups].map(([testId, rows]) => (
          <tbody key={testId} className="border-t">
            <tr className="bg-muted/20">
              <th scope="rowgroup" colSpan={5} className="px-3 py-1.5 text-left text-xs font-semibold">
                {nameOf(testId)}
              </th>
            </tr>
            {rows.map((r) => {
              const abnormal = r.flag !== "NORMAL";
              return (
                <tr key={`${testId}-${r.parameter}`} className="border-t">
                  <td className="px-3 py-2">{r.parameter}</td>
                  <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", abnormal && "text-red-700 dark:text-red-400")}>
                    {r.value}
                  </td>
                  <td className="text-muted-foreground px-3 py-2">{r.unit}</td>
                  <td className="text-muted-foreground px-3 py-2 tabular-nums">{formatRange(r.refLow, r.refHigh)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.flag} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
