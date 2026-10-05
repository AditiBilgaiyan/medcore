import type { Frequency, Gender, LabParameter, ResultFlag } from "@/types";

export function calculateBmi(heightCm?: number, weightKg?: number): number | undefined {
  if (!heightCm || !weightKg) return undefined;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi?: number): string {
  if (bmi == null) return "—";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function referenceRange(param: LabParameter, gender?: Gender): [number | undefined, number | undefined] {
  if (gender === "MALE" && param.maleRange) return param.maleRange;
  if (gender === "FEMALE" && param.femaleRange) return param.femaleRange;
  return [param.refLow, param.refHigh];
}

export function flagResult(param: LabParameter, value: number, gender?: Gender): ResultFlag {
  if (param.criticalLow != null && value < param.criticalLow) return "CRITICAL";
  if (param.criticalHigh != null && value > param.criticalHigh) return "CRITICAL";
  const [low, high] = referenceRange(param, gender);
  if (low != null && value < low) return "LOW";
  if (high != null && value > high) return "HIGH";
  return "NORMAL";
}

export function formatRange(low?: number, high?: number): string {
  if (low != null && high != null) return `${low} – ${high}`;
  if (low != null) return `> ${low}`;
  if (high != null) return `< ${high}`;
  return "—";
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  OD: "Once daily",
  BD: "Twice daily",
  TDS: "Three times daily",
  QID: "Four times daily",
  SOS: "As needed",
};

export const FREQUENCY_PER_DAY: Record<Frequency, number> = { OD: 1, BD: 2, TDS: 3, QID: 4, SOS: 1 };

/** Suggested dispense quantity for a tablet/capsule course. */
export function suggestedQuantity(frequency: Frequency, durationDays: number): number {
  return FREQUENCY_PER_DAY[frequency] * durationDays;
}

/** Vital sign plausibility ranges used for warnings (not validation). */
export const VITAL_RANGES = {
  bpSystolic: [90, 140],
  bpDiastolic: [60, 90],
  pulse: [60, 100],
  temperatureC: [36.1, 37.5],
  spo2: [95, 100],
  respiratoryRate: [12, 20],
} as const;

export function isVitalAbnormal(key: keyof typeof VITAL_RANGES, value?: number): boolean {
  if (value == null) return false;
  const [lo, hi] = VITAL_RANGES[key];
  return value < lo || value > hi;
}
