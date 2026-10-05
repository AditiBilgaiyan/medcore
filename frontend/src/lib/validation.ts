import { z } from "zod";

export const emailSchema = z.string().trim().min(1, "Enter your email").email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a symbol");

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Enter a phone number")
  .regex(/^\+?[0-9\s-]{10,16}$/, "Enter a valid phone number");

export const requiredString = (label: string) => z.string().trim().min(1, `${label} is required`);

export const pastDateSchema = (label = "Date") =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine((v) => v <= new Date().toISOString().slice(0, 10), `${label} can't be in the future`);

export const optionalNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)),
    z
      .number({ invalid_type_error: `${label} must be a number` })
      .min(min, `${label} must be ≥ ${min}`)
      .max(max, `${label} must be ≤ ${max}`)
      .optional(),
  );

/** Map API 422 field details onto react-hook-form errors. */
export function applyServerErrors<T extends Record<string, unknown>>(
  details: Record<string, string[]> | undefined,
  setError: (name: keyof T & string, error: { type: string; message: string }) => void,
) {
  if (!details) return false;
  let applied = false;
  for (const [field, messages] of Object.entries(details)) {
    if (messages?.[0]) {
      setError(field as keyof T & string, { type: "server", message: messages[0] });
      applied = true;
    }
  }
  return applied;
}
