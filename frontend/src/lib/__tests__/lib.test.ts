import { describe, expect, it } from "vitest";
import { canAccessPath } from "@/components/shared/guards";
import { hasPermission } from "@/constants/permissions";
import { calculateBmi, flagResult, referenceRange, suggestedQuantity } from "@/lib/clinical";
import { formatTime, humanize, initials } from "@/lib/format";
import { passwordSchema, phoneSchema } from "@/lib/validation";
import type { LabParameter } from "@/types";

describe("clinical helpers", () => {
  it("calculates BMI to one decimal", () => {
    expect(calculateBmi(175, 70)).toBe(22.9);
    expect(calculateBmi(undefined, 70)).toBeUndefined();
  });

  const hb: LabParameter = {
    name: "Haemoglobin",
    unit: "g/dL",
    maleRange: [13, 17.5],
    femaleRange: [12, 15.5],
    refLow: 12,
    refHigh: 17.5,
    criticalLow: 7,
  };

  it("uses gender-specific reference ranges", () => {
    expect(referenceRange(hb, "MALE")).toEqual([13, 17.5]);
    expect(referenceRange(hb, "FEMALE")).toEqual([12, 15.5]);
    expect(flagResult(hb, 12.5, "MALE")).toBe("LOW");
    expect(flagResult(hb, 12.5, "FEMALE")).toBe("NORMAL");
  });

  it("flags critical values ahead of low/high", () => {
    expect(flagResult(hb, 6.1, "FEMALE")).toBe("CRITICAL");
    expect(flagResult(hb, 16.5, "FEMALE")).toBe("HIGH");
  });

  it("suggests dispense quantities from frequency × duration", () => {
    expect(suggestedQuantity("TDS", 5)).toBe(15);
    expect(suggestedQuantity("OD", 30)).toBe(30);
  });
});

describe("formatters", () => {
  it("formats 24h times for display", () => {
    expect(formatTime("09:30")).toBe("9:30 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("17:20")).toBe("5:20 PM");
  });
  it("humanizes enum values", () => {
    expect(humanize("PENDING_APPROVAL")).toBe("Pending approval");
  });
  it("builds initials without the Dr. prefix", () => {
    expect(initials("Dr. Rohan Mehta")).toBe("RM");
  });
});

describe("validation", () => {
  it("enforces a strong password", () => {
    expect(passwordSchema.safeParse("weak").success).toBe(false);
    expect(passwordSchema.safeParse("Str0ng!pass").success).toBe(true);
  });
  it("accepts Indian mobile formats", () => {
    expect(phoneSchema.safeParse("+91 98220 11223").success).toBe(true);
    expect(phoneSchema.safeParse("12ab").success).toBe(false);
  });
});

describe("permissions", () => {
  it("matches the PRD permission matrix", () => {
    expect(hasPermission("DOCTOR", "prescriptions:write")).toBe(true);
    expect(hasPermission("NURSE", "prescriptions:write")).toBe(false);
    expect(hasPermission("RECEPTIONIST", "appointments:create")).toBe(true);
    expect(hasPermission("PATIENT", "patients:read")).toBe(false);
    expect(hasPermission("LAB_TECHNICIAN", "lab:approve")).toBe(true);
  });

  it("guards routes by the most specific rule", () => {
    expect(canAccessPath("PHARMACIST", "/pharmacy/dispense")).toBe(true);
    expect(canAccessPath("DOCTOR", "/pharmacy")).toBe(true);
    expect(canAccessPath("DOCTOR", "/pharmacy/dispense/rx-1")).toBe(false);
    expect(canAccessPath("RECEPTIONIST", "/billing/claims")).toBe(false);
    expect(canAccessPath("PATIENT", "/dashboard")).toBe(false);
    expect(canAccessPath("PATIENT", "/portal/invoices")).toBe(true);
    expect(canAccessPath("DOCTOR", "/portal")).toBe(false);
  });
});
