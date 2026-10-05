import type { HospitalStatus, HospitalType, SubscriptionPlan } from "@/types";

export const PLANS: {
  value: SubscriptionPlan;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  popular?: boolean;
}[] = [
  {
    value: "STARTER",
    name: "Starter",
    price: 14_999,
    tagline: "Clinics and single-speciality practices",
    features: ["Up to 25 staff accounts", "OPD, appointments & billing", "Patient portal & online payments", "Email support"],
  },
  {
    value: "GROWTH",
    name: "Growth",
    price: 39_999,
    tagline: "Multi-speciality hospitals",
    features: ["Up to 150 staff accounts", "Lab, pharmacy & ward management", "Insurance claims & analytics", "Priority support"],
    popular: true,
  },
  {
    value: "ENTERPRISE",
    name: "Enterprise",
    price: 99_999,
    tagline: "Hospital chains and large networks",
    features: ["Unlimited staff accounts", "All modules + audit exports", "Dedicated success manager", "99.9% uptime SLA"],
  },
];

export const PLAN_BY_VALUE = Object.fromEntries(PLANS.map((p) => [p.value, p])) as Record<SubscriptionPlan, (typeof PLANS)[number]>;

export const HOSPITAL_TYPES: { value: HospitalType; label: string; hint: string }[] = [
  { value: "CLINIC", label: "Clinic", hint: "OPD-focused, few or no beds" },
  { value: "MULTI_SPECIALITY", label: "Multi-speciality hospital", hint: "Several departments with IPD" },
  { value: "DIAGNOSTIC_CENTRE", label: "Diagnostic centre", hint: "Lab and imaging" },
  { value: "TELEHEALTH", label: "Telehealth", hint: "Virtual consultations" },
];

export const HOSPITAL_TYPE_LABEL = Object.fromEntries(HOSPITAL_TYPES.map((t) => [t.value, t.label])) as Record<HospitalType, string>;

export const HOSPITAL_STATUS_TABS: { value: "ALL" | HospitalStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING_VERIFICATION", label: "Pending verification" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
];

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];
