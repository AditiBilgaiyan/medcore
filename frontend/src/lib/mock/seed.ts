import { addDays, addMinutes, format, startOfDay, subDays } from "date-fns";
import { DEMO_PASSWORD } from "@/constants/roles";
import { calculateBmi, flagResult, referenceRange, suggestedQuantity } from "@/lib/clinical";
import type {
  Admission,
  Allergy,
  Appointment,
  AppointmentStatus,
  AuditLog,
  BloodGroup,
  Doctor,
  Frequency,
  Gender,
  Hospital,
  InsuranceClaim,
  Invoice,
  InvoiceItem,
  LabOrder,
  LabOrderStatus,
  LabResult,
  MedicalRecord,
  MedicineBatch,
  Notification,
  Patient,
  Payment,
  PaymentMethod,
  Prescription,
  PrescriptionItem,
  Role,
  Vaccination,
  Vitals,
  Ward,
} from "@/types";
import { CONDITION_TEMPLATES, LAB_TESTS, MEDICINE_CATALOG, VACCINES } from "./data/catalog";
import { SCHEMA_VERSION, type MockDb, type StoredMedicine, type StoredUser } from "./db";

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = { next: mulberry32(1) };
const rand = () => rng.next();
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const pad = (n: number, w = 3) => String(n).padStart(w, "0");

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const NOW = new Date();
const TODAY = startOfDay(NOW);
const dayStr = (offset: number) => format(addDays(TODAY, offset), "yyyy-MM-dd");
const isoAt = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();
const daysAgoIso = (days: number, hour = 10) => addMinutes(subDays(TODAY, days), hour * 60 + int(0, 59)).toISOString();
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (m: number) => `${pad(Math.floor(m / 60), 2)}:${pad(m % 60, 2)}`;

/* ------------------------------------------------------------------ */
/* Name pools                                                          */
/* ------------------------------------------------------------------ */

const MALE_NAMES = [
  "Aarav",
  "Vihaan",
  "Aditya",
  "Arnav",
  "Kabir",
  "Reyansh",
  "Ishaan",
  "Rohit",
  "Karan",
  "Manish",
  "Rajesh",
  "Siddharth",
  "Varun",
  "Harsh",
  "Yash",
  "Akash",
  "Nitin",
  "Gaurav",
  "Pranav",
  "Dev",
  "Omkar",
  "Tushar",
  "Abhishek",
  "Mohit",
  "Sunil",
  "Ramesh",
  "Anil",
  "Prakash",
  "Joseph",
  "Faisal",
];
const FEMALE_NAMES = [
  "Diya",
  "Ananya",
  "Saanvi",
  "Aadhya",
  "Isha",
  "Kiara",
  "Myra",
  "Riya",
  "Sneha",
  "Pooja",
  "Neha",
  "Kavya",
  "Meera",
  "Tanvi",
  "Shruti",
  "Divya",
  "Nisha",
  "Priyanka",
  "Swati",
  "Lakshmi",
  "Anjali",
  "Sunita",
  "Rekha",
  "Fatima",
  "Aisha",
  "Gauri",
  "Bhavna",
  "Sana",
  "Mary",
  "Zoya",
];
const LAST_NAMES = [
  "Sharma",
  "Patel",
  "Iyer",
  "Nair",
  "Reddy",
  "Kulkarni",
  "Deshmukh",
  "Joshi",
  "Gupta",
  "Singh",
  "Khan",
  "Fernandes",
  "Menon",
  "Rao",
  "Pillai",
  "Chopra",
  "Banerjee",
  "Mukherjee",
  "Das",
  "Bhat",
  "Shetty",
  "Pawar",
  "Jain",
  "Agarwal",
  "Malhotra",
  "Kapoor",
  "Verma",
  "Mishra",
  "D'Souza",
  "Thomas",
];
const PUNE_AREAS = [
  "Baner",
  "Aundh",
  "Kothrud",
  "Wakad",
  "Hinjewadi",
  "Viman Nagar",
  "Kharadi",
  "Hadapsar",
  "Shivajinagar",
  "Koregaon Park",
];
const BLR_AREAS = ["Indiranagar", "Koramangala", "HSR Layout", "Jayanagar", "Whitefield", "Malleshwaram"];
const BLOOD_GROUPS: BloodGroup[] = ["O+", "B+", "A+", "AB+", "O-", "B-", "A-", "AB-"];
const ALLERGY_POOL: Allergy[] = [
  { substance: "Penicillin", reaction: "Hives, facial swelling", severity: "SEVERE" },
  { substance: "Sulfonamides", reaction: "Skin rash", severity: "MODERATE" },
  { substance: "NSAIDs", reaction: "Gastric irritation", severity: "MILD" },
  { substance: "Peanuts", reaction: "Anaphylaxis", severity: "SEVERE" },
  { substance: "Dust mites", reaction: "Sneezing, wheeze", severity: "MILD" },
  { substance: "Shellfish", reaction: "Urticaria", severity: "MODERATE" },
  { substance: "Latex", reaction: "Contact dermatitis", severity: "MILD" },
];
const INSURERS = ["Star Health", "HDFC ERGO", "ICICI Lombard", "Niva Bupa", "Care Health"];
const TPAS = ["Medi Assist TPA", "Paramount Health TPA", "Vidal Health TPA", "MD India TPA"];

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

export function seedDatabase(): MockDb {
  rng.next = mulberry32(20261004);

  const db: MockDb = {
    schemaVersion: SCHEMA_VERSION,
    seededAt: NOW.toISOString(),
    hospitals: [],
    departments: [],
    users: [],
    doctors: [],
    availability: [],
    availabilityExceptions: [],
    patients: [],
    appointments: [],
    medicalRecords: [],
    vaccinations: [],
    prescriptions: [],
    labTests: LAB_TESTS,
    labOrders: [],
    medicines: [],
    dispensations: [],
    invoices: [],
    claims: [],
    notifications: [],
    auditLogs: [],
    wards: [],
    admissions: [],
    refreshTokens: [],
    otps: [],
    counters: {},
  };

  const counter = (key: string) => (db.counters[key] = (db.counters[key] ?? 0) + 1);
  const year = NOW.getFullYear();

  /* ---------------- Hospitals ---------------- */

  const hospital = (h: Partial<Hospital> & Pick<Hospital, "id" | "name" | "code">): Hospital => ({
    type: "MULTI_SPECIALITY",
    status: "ACTIVE",
    plan: "GROWTH",
    email: `contact@${h.code.toLowerCase()}.dev`,
    phone: "+91 20 4000 0000",
    address: { line1: "1 Main Road", city: "Pune", state: "Maharashtra", postalCode: "411001", country: "India" },
    bedCount: 50,
    registrationNumber: `REG-${h.code}-${int(1000, 9999)}`,
    createdAt: daysAgoIso(300),
    verifiedAt: daysAgoIso(295),
    ...h,
  });

  const CITY = "hosp-citycare";
  const SUN = "hosp-sunrise";
  db.hospitals.push(
    hospital({
      id: CITY,
      name: "CityCare Multi-Speciality Hospital",
      code: "CCH",
      plan: "ENTERPRISE",
      email: "contact@citycare.dev",
      phone: "+91 20 4567 8900",
      address: {
        line1: "14 Baner Road",
        line2: "Near Balewadi Phata",
        city: "Pune",
        state: "Maharashtra",
        postalCode: "411045",
        country: "India",
      },
      bedCount: 106,
      registrationNumber: "MH-PUN-2011-0457",
      createdAt: daysAgoIso(420),
      verifiedAt: daysAgoIso(418),
    }),
    hospital({
      id: SUN,
      name: "Sunrise Clinic & Diagnostics",
      code: "SRC",
      plan: "GROWTH",
      email: "hello@sunriseclinic.dev",
      phone: "+91 80 2345 6789",
      address: { line1: "221 100 Feet Road", city: "Bengaluru", state: "Karnataka", postalCode: "560038", country: "India" },
      bedCount: 30,
      registrationNumber: "KA-BLR-2016-1182",
      createdAt: daysAgoIso(260),
      verifiedAt: daysAgoIso(255),
    }),
    hospital({
      id: "hosp-lotus",
      name: "Lotus Health Centre",
      code: "LHC",
      type: "CLINIC",
      plan: "STARTER",
      status: "PENDING_VERIFICATION",
      email: "admin@lotushealth.dev",
      phone: "+91 484 220 1100",
      address: { line1: "Marine Drive", city: "Kochi", state: "Kerala", postalCode: "682031", country: "India" },
      bedCount: 30,
      createdAt: daysAgoIso(2),
      verifiedAt: undefined,
    }),
    hospital({
      id: "hosp-apex",
      name: "Apex Diagnostics",
      code: "APX",
      type: "DIAGNOSTIC_CENTRE",
      plan: "STARTER",
      email: "ops@apexdiag.dev",
      phone: "+91 40 6600 1200",
      address: { line1: "Road No. 12, Banjara Hills", city: "Hyderabad", state: "Telangana", postalCode: "500034", country: "India" },
      bedCount: 0,
      createdAt: daysAgoIso(120),
      verifiedAt: daysAgoIso(118),
    }),
    hospital({
      id: "hosp-northstar",
      name: "Northstar Telehealth",
      code: "NST",
      type: "TELEHEALTH",
      plan: "GROWTH",
      status: "SUSPENDED",
      email: "support@northstar.dev",
      phone: "+91 11 4100 2200",
      address: { line1: "Connaught Place", city: "New Delhi", state: "Delhi", postalCode: "110001", country: "India" },
      bedCount: 0,
      createdAt: daysAgoIso(200),
      verifiedAt: daysAgoIso(198),
    }),
  );

  /* ---------------- Departments & wards ---------------- */

  const DEPT_DEFS: [string, string, string, number][] = [
    ["GEN", "General Medicine", "Primary care, chronic disease management and internal medicine", 600],
    ["CAR", "Cardiology", "Heart and vascular care, ECG, echo and stress testing", 1000],
    ["ORT", "Orthopaedics", "Bones, joints, sports injuries and fracture care", 900],
    ["PAE", "Paediatrics", "Child health, immunisation and neonatal care", 700],
    ["DER", "Dermatology", "Skin, hair and nail disorders", 800],
    ["GYN", "Obstetrics & Gynaecology", "Women's health, antenatal and maternity care", 900],
    ["ENT", "ENT", "Ear, nose and throat disorders", 700],
    ["EMR", "Emergency", "24×7 emergency and trauma care", 1200],
  ];
  const deptId = (hospitalId: string, code: string) => `dep-${hospitalId.replace("hosp-", "")}-${code.toLowerCase()}`;

  for (const [code, name, description, fee] of DEPT_DEFS) {
    db.departments.push({
      id: deptId(CITY, code),
      hospitalId: CITY,
      name,
      code,
      description,
      totalBeds: 0,
      occupiedBeds: 0,
      consultationFee: fee,
    });
  }
  for (const [code, name, description, fee] of DEPT_DEFS.filter(([c]) => ["GEN", "PAE", "DER"].includes(c))) {
    db.departments.push({
      id: deptId(SUN, code),
      hospitalId: SUN,
      name,
      code,
      description,
      totalBeds: 0,
      occupiedBeds: 0,
      consultationFee: Math.round(fee * 0.8),
    });
  }

  const WARD_DEFS: [string, string, string, number][] = [
    [CITY, "GEN", "General Ward A", 30],
    [CITY, "CAR", "Cardiac Care Unit", 12],
    [CITY, "ORT", "Orthopaedic Ward", 20],
    [CITY, "PAE", "Paediatric Ward", 16],
    [CITY, "GYN", "Maternity Ward", 18],
    [CITY, "EMR", "Emergency Observation", 10],
    [SUN, "GEN", "Day Care Ward", 20],
    [SUN, "PAE", "Children's Ward", 10],
  ];
  for (const [hid, code, name, beds] of WARD_DEFS) {
    const ward: Ward = {
      id: `ward-${hid.replace("hosp-", "")}-${code.toLowerCase()}`,
      hospitalId: hid,
      departmentId: deptId(hid, code),
      name,
      totalBeds: beds,
    };
    db.wards.push(ward);
    const dept = db.departments.find((d) => d.id === ward.departmentId)!;
    dept.totalBeds += beds;
  }

  /* ---------------- Users ---------------- */

  const user = (u: Partial<StoredUser> & Pick<StoredUser, "id" | "role" | "firstName" | "lastName" | "email">): StoredUser => ({
    hospitalId: CITY,
    phone: `+91 9${int(100000000, 999999999)}`,
    status: "ACTIVE",
    isEmailVerified: true,
    isPhoneVerified: true,
    createdAt: daysAgoIso(int(60, 400)),
    lastLoginAt: daysAgoIso(int(0, 3), int(8, 18)),
    password: DEMO_PASSWORD,
    deletedAt: null,
    ...u,
  });

  db.users.push(
    user({
      id: "usr-superadmin",
      role: "SUPER_ADMIN",
      firstName: "Platform",
      lastName: "Operations",
      email: "superadmin@medcore.dev",
      hospitalId: null,
    }),
    user({ id: "usr-cch-admin", role: "HOSPITAL_ADMIN", firstName: "Sanjay", lastName: "Gupta", email: "admin@citycare.dev" }),
    user({ id: "usr-cch-nurse", role: "NURSE", firstName: "Maria", lastName: "Fernandes", email: "nurse.fernandes@citycare.dev" }),
    user({ id: "usr-cch-nurse2", role: "NURSE", firstName: "Lakshmi", lastName: "Menon", email: "nurse.menon@citycare.dev" }),
    user({ id: "usr-cch-reception", role: "RECEPTIONIST", firstName: "Pooja", lastName: "Desai", email: "reception@citycare.dev" }),
    user({ id: "usr-cch-lab", role: "LAB_TECHNICIAN", firstName: "Rahul", lastName: "Verma", email: "lab@citycare.dev" }),
    user({ id: "usr-cch-lab2", role: "LAB_TECHNICIAN", firstName: "Deepa", lastName: "Rao", email: "lab.senior@citycare.dev" }),
    user({ id: "usr-cch-pharmacy", role: "PHARMACIST", firstName: "Imran", lastName: "Shaikh", email: "pharmacy@citycare.dev" }),
    user({ id: "usr-cch-accounts", role: "ACCOUNTANT", firstName: "Nikhil", lastName: "Bansal", email: "accounts@citycare.dev" }),
    user({
      id: "usr-cch-reception2",
      role: "RECEPTIONIST",
      firstName: "Anjali",
      lastName: "Pawar",
      email: "frontdesk@citycare.dev",
      status: "INVITED",
      isEmailVerified: false,
      lastLoginAt: undefined,
    }),
    user({
      id: "usr-src-admin",
      role: "HOSPITAL_ADMIN",
      firstName: "Kiran",
      lastName: "Shetty",
      email: "admin@sunrise.dev",
      hospitalId: SUN,
    }),
    user({
      id: "usr-src-reception",
      role: "RECEPTIONIST",
      firstName: "Divya",
      lastName: "Bhat",
      email: "reception@sunrise.dev",
      hospitalId: SUN,
    }),
    user({
      id: "usr-lotus-admin",
      role: "HOSPITAL_ADMIN",
      firstName: "Joseph",
      lastName: "Thomas",
      email: "admin@lotushealth.dev",
      hospitalId: "hosp-lotus",
      status: "INVITED",
      isEmailVerified: false,
      lastLoginAt: undefined,
    }),
    user({
      id: "usr-apex-admin",
      role: "HOSPITAL_ADMIN",
      firstName: "Harsh",
      lastName: "Malhotra",
      email: "admin@apexdiag.dev",
      hospitalId: "hosp-apex",
    }),
  );

  /* ---------------- Doctors & availability ---------------- */

  const DOCTOR_DEFS: {
    hid: string;
    first: string;
    last: string;
    email: string;
    depts: string[];
    spec: string;
    qual: string;
    exp: number;
    fee: number;
    days: number[];
    evening?: { days: number[]; start: string; end: string; slot: number };
  }[] = [
    {
      hid: CITY,
      first: "Rohan",
      last: "Mehta",
      email: "dr.mehta@citycare.dev",
      depts: ["GEN", "EMR"],
      spec: "Internal Medicine",
      qual: "MBBS, MD (Medicine)",
      exp: 12,
      fee: 800,
      days: [0, 1, 2, 3, 4, 5, 6],
      evening: { days: [0, 1, 2, 3, 4, 5, 6], start: "17:00", end: "21:00", slot: 20 },
    },
    {
      hid: CITY,
      first: "Ananya",
      last: "Iyer",
      email: "dr.iyer@citycare.dev",
      depts: ["CAR"],
      spec: "Cardiology",
      qual: "MBBS, MD, DM (Cardiology)",
      exp: 15,
      fee: 1500,
      days: [1, 2, 3, 4, 5],
    },
    {
      hid: CITY,
      first: "Vikram",
      last: "Singh",
      email: "dr.singh@citycare.dev",
      depts: ["ORT"],
      spec: "Orthopaedic Surgery",
      qual: "MBBS, MS (Ortho)",
      exp: 18,
      fee: 1200,
      days: [1, 2, 3, 4, 5, 6],
    },
    {
      hid: CITY,
      first: "Priya",
      last: "Nair",
      email: "dr.nair@citycare.dev",
      depts: ["PAE"],
      spec: "Paediatrics",
      qual: "MBBS, MD (Paediatrics)",
      exp: 9,
      fee: 900,
      days: [1, 2, 3, 4, 5, 6],
      evening: { days: [1, 3, 5], start: "16:00", end: "19:00", slot: 20 },
    },
    {
      hid: CITY,
      first: "Sameer",
      last: "Khan",
      email: "dr.khan@citycare.dev",
      depts: ["DER"],
      spec: "Dermatology",
      qual: "MBBS, MD (DVL)",
      exp: 7,
      fee: 900,
      days: [1, 3, 5, 6],
    },
    {
      hid: CITY,
      first: "Kavita",
      last: "Joshi",
      email: "dr.joshi@citycare.dev",
      depts: ["GYN"],
      spec: "Obstetrics & Gynaecology",
      qual: "MBBS, MS (OBG)",
      exp: 14,
      fee: 1100,
      days: [1, 2, 3, 4, 5, 6],
    },
    {
      hid: CITY,
      first: "Arjun",
      last: "Reddy",
      email: "dr.reddy@citycare.dev",
      depts: ["ENT"],
      spec: "Otorhinolaryngology",
      qual: "MBBS, MS (ENT)",
      exp: 10,
      fee: 800,
      days: [1, 2, 4, 5, 6],
    },
    {
      hid: CITY,
      first: "Neha",
      last: "Kulkarni",
      email: "dr.kulkarni@citycare.dev",
      depts: ["EMR", "GEN"],
      spec: "Emergency Medicine",
      qual: "MBBS, MD (Emergency Medicine)",
      exp: 6,
      fee: 1000,
      days: [0, 1, 2, 3, 4, 5, 6],
      evening: { days: [0, 1, 2, 3, 4, 5, 6], start: "14:00", end: "22:00", slot: 30 },
    },
    {
      hid: SUN,
      first: "Farah",
      last: "Ali",
      email: "dr.ali@sunrise.dev",
      depts: ["GEN"],
      spec: "Family Medicine",
      qual: "MBBS, DNB (Family Medicine)",
      exp: 8,
      fee: 600,
      days: [1, 2, 3, 4, 5, 6],
    },
    {
      hid: SUN,
      first: "Suresh",
      last: "Babu",
      email: "dr.babu@sunrise.dev",
      depts: ["PAE"],
      spec: "Paediatrics",
      qual: "MBBS, DCH",
      exp: 20,
      fee: 600,
      days: [1, 2, 3, 4, 5],
    },
    {
      hid: SUN,
      first: "Meera",
      last: "Pillai",
      email: "dr.pillai@sunrise.dev",
      depts: ["DER"],
      spec: "Dermatology",
      qual: "MBBS, MD (Dermatology)",
      exp: 5,
      fee: 700,
      days: [2, 4, 6],
    },
  ];

  DOCTOR_DEFS.forEach((d, i) => {
    const userId = `usr-doc-${pad(i + 1)}`;
    const doctorId = `doc-${pad(i + 1)}`;
    db.users.push(user({ id: userId, role: "DOCTOR", firstName: d.first, lastName: d.last, email: d.email, hospitalId: d.hid }));
    db.doctors.push({
      id: doctorId,
      userId,
      hospitalId: d.hid,
      departmentIds: d.depts.map((c) => deptId(d.hid, c)),
      firstName: d.first,
      lastName: d.last,
      email: d.email,
      phone: `+91 98${int(10000000, 99999999)}`,
      specialisation: d.spec,
      qualification: d.qual,
      registrationNumber: `${d.hid === CITY ? "MMC" : "KMC"}/${int(2005, 2019)}/${int(10000, 99999)}`,
      experienceYears: d.exp,
      consultationFee: d.fee,
      bio: `Dr. ${d.first} ${d.last} has ${d.exp} years of experience in ${d.spec.toLowerCase()} and believes in evidence-based, patient-centred care.`,
      rating: round(4 + rand() * 0.9, 1),
      languages: pick([
        ["English", "Hindi", "Marathi"],
        ["English", "Hindi"],
        ["English", "Kannada", "Tamil"],
        ["English", "Malayalam", "Hindi"],
      ]),
      isAcceptingPatients: true,
      deletedAt: null,
    });
    for (const day of d.days) {
      db.availability.push({
        id: `av-${doctorId}-${day}-am`,
        doctorId,
        departmentId: deptId(d.hid, d.depts[0]),
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "13:00",
        slotMinutes: 30,
      });
      if (d.evening?.days.includes(day)) {
        db.availability.push({
          id: `av-${doctorId}-${day}-pm`,
          doctorId,
          departmentId: deptId(d.hid, d.depts[0]),
          dayOfWeek: day,
          startTime: d.evening.start,
          endTime: d.evening.end,
          slotMinutes: d.evening.slot,
        });
      }
    }
  });
  db.departments.forEach((dep) => {
    const head = db.doctors.find((d) => d.departmentIds[0] === dep.id);
    if (head) dep.headDoctorId = head.id;
  });
  db.availabilityExceptions.push({
    id: "avx-1",
    doctorId: "doc-003",
    date: dayStr(4),
    reason: "Conference — Indian Orthopaedic Association",
  });

  /* ---------------- Medicines ---------------- */

  const seedMedicines = (hid: string, catalog: typeof MEDICINE_CATALOG) => {
    catalog.forEach((m, i) => {
      const medId = `med-${hid.replace("hosp-", "")}-${pad(i + 1)}`;
      const batches: MedicineBatch[] = [];
      const batchCount = int(1, 3);
      for (let b = 0; b < batchCount; b++) {
        const expiryOffset = b === 0 ? int(60, 500) : int(200, 720);
        const mfg = subDays(addDays(TODAY, expiryOffset), 720);
        batches.push({
          id: `${medId}-b${b + 1}`,
          medicineId: medId,
          batchNumber: `${m.name
            .replace(/[^A-Z]/gi, "")
            .slice(0, 3)
            .toUpperCase()}${int(1000, 9999)}${String.fromCharCode(65 + b)}`,
          mfgDate: format(mfg, "yyyy-MM-dd"),
          expiryDate: dayStr(expiryOffset),
          quantity: int(Math.round(m.reorderLevel * 0.6), m.reorderLevel * 4),
          unitCost: round(m.mrp * 0.72, 2),
          mrp: m.mrp,
          status: "ACTIVE",
          receivedAt: daysAgoIso(int(10, 200)),
        });
      }
      db.medicines.push({
        id: medId,
        hospitalId: hid,
        name: m.name,
        genericName: m.genericName,
        form: m.form,
        strength: m.strength,
        manufacturer: m.manufacturer,
        category: m.category,
        reorderLevel: m.reorderLevel,
        requiresPrescription: m.requiresPrescription,
        batches,
      });
    });
  };
  seedMedicines(CITY, MEDICINE_CATALOG);
  seedMedicines(SUN, MEDICINE_CATALOG.slice(0, 25));

  // Hand-tuned stock situations so the pharmacy screens have something to show.
  const cityMeds = db.medicines.filter((m) => m.hospitalId === CITY);
  const setOnlyBatch = (m: StoredMedicine, patch: Partial<MedicineBatch>) => {
    m.batches = [{ ...m.batches[0], ...patch }];
  };
  setOnlyBatch(cityMeds[2], { quantity: 34 }); // Augmentin — low
  setOnlyBatch(cityMeds[9], { quantity: 0, status: "DEPLETED" }); // Amaryl — out
  setOnlyBatch(cityMeds[17], { quantity: 6 }); // Asthalin — low
  setOnlyBatch(cityMeds[27], { quantity: 0, status: "DEPLETED" }); // Uprise D3 — out
  setOnlyBatch(cityMeds[33], { quantity: 9 }); // Insugen — low
  cityMeds[0].batches[0].expiryDate = dayStr(12); // Dolo — expiring soon
  cityMeds[6].batches[0].expiryDate = dayStr(21); // Pan 40
  cityMeds[15].batches[0].expiryDate = dayStr(27); // Montair LC
  cityMeds[19].batches.push({
    ...cityMeds[19].batches[0],
    id: `${cityMeds[19].id}-bx`,
    batchNumber: "ASC0391X",
    expiryDate: dayStr(-9),
    mfgDate: dayStr(-740),
    quantity: 18,
    status: "QUARANTINED",
  }); // Ascoril — expired & quarantined
  cityMeds[23].batches.push({
    ...cityMeds[23].batches[0],
    id: `${cityMeds[23].id}-by`,
    batchNumber: "BRU7710Y",
    expiryDate: dayStr(-3),
    mfgDate: dayStr(-733),
    quantity: 120,
    status: "ACTIVE",
  }); // Brufen — expired but not yet quarantined (should be flagged)

  const medByName = (hid: string, name: string) => db.medicines.find((m) => m.hospitalId === hid && m.name === name);

  /* ---------------- Patients ---------------- */

  const makePatient = (hid: string, idx: number, overrides: Partial<Patient> = {}): Patient => {
    const gender: Gender = overrides.gender ?? (chance(0.5) ? "MALE" : "FEMALE");
    const firstName = overrides.firstName ?? pick(gender === "MALE" ? MALE_NAMES : FEMALE_NAMES);
    const lastName = overrides.lastName ?? pick(LAST_NAMES);
    const age = int(1, 82);
    const city = hid === CITY ? "Pune" : "Bengaluru";
    const area = pick(hid === CITY ? PUNE_AREAS : BLR_AREAS);
    const code = hid === CITY ? "CCH" : "SRC";
    const insured = chance(0.45);
    const allergies = chance(0.25) ? [pick(ALLERGY_POOL)] : [];
    return {
      id: `pat-${code.toLowerCase()}-${pad(idx, 4)}`,
      hospitalId: hid,
      mrn: `${code}-${pad(100000 + idx * 37, 6)}`,
      firstName,
      lastName,
      dob: format(subDays(TODAY, age * 365 + int(0, 364)), "yyyy-MM-dd"),
      gender,
      bloodGroup: pick(BLOOD_GROUPS),
      phone: `+91 9${int(100000000, 999999999)}`,
      email: chance(0.7) ? `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}${int(1, 99)}@mail.dev` : undefined,
      address: {
        line1: `${int(1, 220)}, ${pick(["Shanti", "Ganga", "Sai", "Lake View", "Green"])} Residency`,
        line2: area,
        city,
        state: hid === CITY ? "Maharashtra" : "Karnataka",
        postalCode: hid === CITY ? `4110${int(10, 62)}` : `5600${int(10, 99)}`,
        country: "India",
      },
      emergencyContact: {
        name: `${pick(gender === "MALE" ? FEMALE_NAMES : MALE_NAMES)} ${lastName}`,
        relation: pick(["Spouse", "Parent", "Sibling", "Child"]),
        phone: `+91 9${int(100000000, 999999999)}`,
      },
      allergies,
      familyHistory: { diabetes: chance(0.3), hypertension: chance(0.35), cancer: chance(0.08), cardiac: chance(0.15) },
      chronicConditions:
        age > 40 && chance(0.4) ? [pick(["Type 2 diabetes", "Hypertension", "Hypothyroidism", "Asthma", "Osteoarthritis"])] : [],
      currentMedications: [],
      insurance: insured
        ? { provider: pick(INSURERS), policyNumber: `POL${int(10000000, 99999999)}`, validTill: dayStr(int(60, 600)) }
        : undefined,
      createdAt: daysAgoIso(int(15, 400)),
      deletedAt: null,
      ...overrides,
    };
  };

  db.patients.push(
    makePatient(CITY, 1, {
      firstName: "Aarav",
      lastName: "Sharma",
      gender: "MALE",
      dob: format(subDays(TODAY, 34 * 365 + 120), "yyyy-MM-dd"),
      bloodGroup: "B+",
      phone: "+91 98220 11223",
      email: "aarav.sharma@mail.dev",
      userId: "usr-pat-aarav",
      allergies: [{ substance: "Penicillin", reaction: "Hives, facial swelling", severity: "SEVERE" }],
      familyHistory: { diabetes: true, hypertension: true, cancer: false, cardiac: false },
      chronicConditions: ["Hypertension"],
      currentMedications: ["Telma 40 — once daily"],
      insurance: { provider: "Star Health", policyNumber: "POL40917733", validTill: dayStr(240) },
      address: {
        line1: "B-702, Lake View Residency",
        line2: "Baner",
        city: "Pune",
        state: "Maharashtra",
        postalCode: "411045",
        country: "India",
      },
      emergencyContact: { name: "Kavya Sharma", relation: "Spouse", phone: "+91 98220 44556" },
      createdAt: daysAgoIso(380),
    }),
    makePatient(CITY, 2, {
      firstName: "Diya",
      lastName: "Patel",
      gender: "FEMALE",
      dob: format(subDays(TODAY, 28 * 365 + 40), "yyyy-MM-dd"),
      email: "diya.patel@mail.dev",
      userId: "usr-pat-diya",
      insurance: undefined,
      allergies: [],
    }),
  );
  for (let i = 3; i <= 110; i++) db.patients.push(makePatient(CITY, i));
  for (let i = 1; i <= 24; i++) db.patients.push(makePatient(SUN, i));

  db.users.push(
    user({
      id: "usr-pat-aarav",
      role: "PATIENT",
      firstName: "Aarav",
      lastName: "Sharma",
      email: "aarav.sharma@mail.dev",
      phone: "+91 98220 11223",
    }),
    user({ id: "usr-pat-diya", role: "PATIENT", firstName: "Diya", lastName: "Patel", email: "diya.patel@mail.dev" }),
  );

  /* ---------------- Appointments + encounters ---------------- */

  const booked = new Set<string>(); // `${patientId}|${date}|${time}` and `${doctorId}|${date}|${time}`
  const patientsByHospital = (hid: string) => db.patients.filter((p) => p.hospitalId === hid);
  const outpatientPool = (hid: string) => patientsByHospital(hid).slice(0, hid === CITY ? 80 : 24);
  const deptCode = (id: string) => db.departments.find((d) => d.id === id)!.code;
  const deptName = (id: string) => db.departments.find((d) => d.id === id)!.name;
  const doctorUser = (doc: Doctor) => db.users.find((u) => u.id === doc.userId)!;
  const nurseName = "Maria Fernandes";

  const templatesFor = (code: string) => {
    const list = CONDITION_TEMPLATES.filter((t) => t.departments.includes(code));
    return list.length ? list : CONDITION_TEMPLATES.filter((t) => t.departments.includes("GEN"));
  };

  const makeVitals = (patient: Patient, at: string, recordedById: string, recordedByName: string, sick = false): Vitals => {
    const age = new Date().getFullYear() - Number(patient.dob.slice(0, 4));
    const child = age < 13;
    // Stable per patient so BMI doesn't jump between visits.
    const h = [...patient.id].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) % 9973, 7);
    const heightCm = child ? 80 + (h % 70) : (patient.gender === "MALE" ? 162 : 150) + (h % 22);
    const bmiTarget = child ? 16 : 20 + ((h >> 3) % 90) / 10;
    const weightKg = Math.round(bmiTarget * (heightCm / 100) ** 2 + (rand() - 0.5) * 2);
    return {
      bpSystolic: child ? int(90, 110) : int(108, sick ? 162 : 138),
      bpDiastolic: child ? int(55, 70) : int(68, sick ? 98 : 88),
      pulse: int(64, sick ? 112 : 92),
      temperatureC: round(sick ? 37.2 + rand() * 1.8 : 36.4 + rand() * 0.8, 1),
      spo2: int(sick ? 93 : 96, 99),
      respiratoryRate: int(14, sick ? 24 : 18),
      heightCm,
      weightKg,
      bmi: calculateBmi(heightCm, weightKg),
      recordedAt: at,
      recordedById,
      recordedByName,
    };
  };

  const resultsFor = (testIds: string[], gender: Gender, abnormalBias = 0.25): LabResult[] => {
    const out: LabResult[] = [];
    for (const testId of testIds) {
      const test = LAB_TESTS.find((t) => t.id === testId)!;
      for (const p of test.parameters) {
        const [lo, hi] = referenceRange(p, gender);
        const abnormal = chance(abnormalBias);
        let v: number;
        if (lo != null && hi != null)
          v = abnormal ? (chance(0.5) ? hi * (1.08 + rand() * 0.3) : lo * (0.65 + rand() * 0.25)) : lo + rand() * (hi - lo);
        else if (hi != null) v = abnormal ? hi * (1.1 + rand() * 0.4) : hi * (0.5 + rand() * 0.45);
        else if (lo != null) v = abnormal ? lo * (0.7 + rand() * 0.25) : lo * (1.05 + rand() * 0.6);
        else v = rand() * 10;
        const value = round(v, v < 2 ? 3 : v < 10 ? 2 : v < 100 ? 1 : 0);
        out.push({ testId, parameter: p.name, value, unit: p.unit, refLow: lo, refHigh: hi, flag: flagResult(p, value, gender) });
      }
    }
    return out;
  };

  const frequencyFor = (category: string): Frequency =>
    ["Antibiotic"].includes(category)
      ? "BD"
      : ["Antihypertensive", "Statin", "Antiplatelet", "Thyroid", "Supplement", "Antiallergic"].includes(category)
        ? "OD"
        : category === "Analgesic" || category === "NSAID"
          ? pick(["TDS", "SOS"] as Frequency[])
          : "BD";
  const durationFor = (category: string) =>
    ["Antihypertensive", "Statin", "Antiplatelet", "Thyroid", "Antidiabetic"].includes(category)
      ? 30
      : category === "Antibiotic"
        ? 5
        : pick([3, 5, 7]);
  const instructionFor = (category: string) =>
    category === "Antacid"
      ? "Take 30 minutes before breakfast"
      : category === "NSAID"
        ? "Take after food"
        : category === "Thyroid"
          ? "Take on an empty stomach"
          : category === "Antibiotic"
            ? "Complete the full course"
            : pick(["Take after food", "Take after food", ""]);

  const paymentMethods: PaymentMethod[] = ["STRIPE_CARD", "RAZORPAY_UPI", "RAZORPAY_UPI", "CASH", "RAZORPAY_NETBANKING"];

  interface PlannedAppointment {
    doctor: Doctor;
    patient: Patient;
    date: string;
    offset: number;
    startTime: string;
    slotMinutes: number;
    departmentId: string;
    status?: AppointmentStatus;
    templateIndex?: number;
    type?: Appointment["type"];
  }

  const createEncounter = (plan: PlannedAppointment) => {
    const { doctor, patient, date, offset, startTime, slotMinutes, departmentId } = plan;
    const code = deptCode(departmentId);
    const templates = templatesFor(code);
    const tpl = plan.templateIndex != null ? CONDITION_TEMPLATES[plan.templateIndex] : pick(templates);
    const nowMin = NOW.getHours() * 60 + NOW.getMinutes();
    const startMin = toMinutes(startTime);
    const endTime = fromMinutes(startMin + slotMinutes);

    let status: AppointmentStatus = plan.status ?? "CONFIRMED";
    if (!plan.status) {
      if (offset < 0) status = chance(0.84) ? "COMPLETED" : chance(0.55) ? "CANCELLED" : "NO_SHOW";
      else if (offset === 0) {
        if (startMin + slotMinutes <= nowMin) status = chance(0.92) ? "COMPLETED" : "NO_SHOW";
        else if (startMin <= nowMin) status = "IN_PROGRESS";
        else status = chance(0.8) ? "CONFIRMED" : "PENDING";
      } else status = chance(0.05) ? "CANCELLED" : chance(offset <= 2 ? 0.75 : 0.55) ? "CONFIRMED" : "PENDING";
    }

    const isEmergency = plan.type === "EMERGENCY" || (code === "EMR" && chance(0.35));
    const type: Appointment["type"] = plan.type ?? (isEmergency ? "EMERGENCY" : chance(0.25) ? "FOLLOW_UP" : "CONSULTATION");
    const createdAt = isoAt(dayStr(Math.min(offset, 0) - int(0, 5)), `${pad(int(8, 19), 2)}:${pad(int(0, 59), 2)}`);
    const docUser = doctorUser(doctor);
    const docName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
    const patientName = `${patient.firstName} ${patient.lastName}`;

    const appt: Appointment = {
      id: `apt-${pad(counter("apt"), 5)}`,
      hospitalId: patient.hospitalId,
      patientId: patient.id,
      patientName,
      patientMrn: patient.mrn,
      doctorId: doctor.id,
      doctorName: docName,
      departmentId,
      departmentName: deptName(departmentId),
      date,
      startTime,
      endTime,
      type,
      status,
      isEmergency,
      reason: tpl.complaint,
      cancelledReason:
        status === "CANCELLED"
          ? pick(["Patient requested reschedule", "Doctor unavailable", "Patient unwell, could not travel"])
          : undefined,
      createdById: chance(0.6) ? "usr-cch-reception" : (patient.userId ?? "usr-cch-reception"),
      createdAt,
      updatedAt: createdAt,
      version: status === "PENDING" ? 1 : 2,
      deletedAt: null,
    };
    db.appointments.push(appt);
    booked.add(`${patient.id}|${date}|${startTime}`);
    booked.add(`${doctor.id}|${date}|${startTime}`);

    if (status !== "COMPLETED" && status !== "IN_PROGRESS") return appt;

    /* Medical record */
    const startIso = isoAt(date, startTime);
    const sick = ["B34.9", "A90", "J03.90", "J06.9", "A09"].includes(tpl.diagnosis.code);
    const vitals = makeVitals(patient, startIso, "usr-cch-nurse", nurseName, sick);
    const record: MedicalRecord = {
      id: `mr-${pad(counter("mr"), 5)}`,
      hospitalId: patient.hospitalId,
      appointmentId: appt.id,
      patientId: patient.id,
      patientName,
      doctorId: doctor.id,
      doctorName: docName,
      departmentName: appt.departmentName,
      vitals: [vitals],
      chiefComplaint: status === "IN_PROGRESS" ? tpl.complaint : tpl.complaint,
      symptoms: status === "IN_PROGRESS" ? tpl.symptoms.slice(0, 1) : tpl.symptoms,
      diagnoses: status === "IN_PROGRESS" ? [] : [{ ...tpl.diagnosis, type: "CONFIRMED" }],
      treatmentPlan: status === "IN_PROGRESS" ? "" : tpl.plan,
      allergiesNoted: patient.allergies,
      notes:
        status === "IN_PROGRESS"
          ? []
          : [
              {
                id: `note-${counter("note")}`,
                authorId: docUser.id,
                authorName: docName,
                authorRole: "DOCTOR" as Role,
                text: `Patient seen. ${tpl.plan}`,
                createdAt: addMinutes(new Date(startIso), 15).toISOString(),
              },
            ],
      attachments: [],
      followUpDate: status === "COMPLETED" && chance(0.4) ? dayStr(offset + pick([7, 14, 30])) : undefined,
      prescriptionIds: [],
      labOrderIds: [],
      isFinalised: status === "COMPLETED",
      createdAt: startIso,
      updatedAt: addMinutes(new Date(startIso), slotMinutes).toISOString(),
    };
    db.medicalRecords.push(record);
    appt.medicalRecordId = record.id;
    if (status === "IN_PROGRESS") return appt;

    const invoiceItems: InvoiceItem[] = [
      {
        id: `ii-${counter("ii")}`,
        type: "CONSULTATION",
        description: `${type === "FOLLOW_UP" ? "Follow-up" : "Consultation"} — ${docName}`,
        quantity: 1,
        unitPrice: type === "FOLLOW_UP" ? Math.round(doctor.consultationFee * 0.5) : doctor.consultationFee,
        amount: 0,
        refId: appt.id,
      },
    ];

    /* Prescription */
    const meds = tpl.medicines.map((n) => medByName(patient.hospitalId, n)).filter(Boolean) as StoredMedicine[];
    if (meds.length && chance(0.85)) {
      const dispensed = offset <= -1 && chance(0.8);
      const items: PrescriptionItem[] = meds.map((m) => {
        const frequency = frequencyFor(m.category);
        const durationDays = durationFor(m.category);
        const countable = m.form === "TABLET" || m.form === "CAPSULE";
        const quantity = countable ? suggestedQuantity(frequency, durationDays) : 1;
        return {
          id: `pi-${counter("pi")}`,
          medicineId: m.id,
          medicineName: m.name,
          form: m.form,
          dosage: m.strength,
          frequency,
          durationDays,
          quantity,
          instructions: instructionFor(m.category) || undefined,
          dispensedQty: dispensed ? quantity : 0,
        };
      });
      const rx: Prescription = {
        id: `rx-${pad(counter("rx"), 5)}`,
        hospitalId: patient.hospitalId,
        number: `RX-${year}-${pad(db.counters.rx, 5)}`,
        medicalRecordId: record.id,
        appointmentId: appt.id,
        patientId: patient.id,
        patientName,
        doctorId: doctor.id,
        doctorName: docName,
        items,
        status: dispensed ? "DISPENSED" : "ISSUED",
        signedAt: record.updatedAt,
        createdAt: record.updatedAt,
      };
      db.prescriptions.push(rx);
      record.prescriptionIds.push(rx.id);
      if (dispensed) {
        for (const it of items) {
          const med = meds.find((m) => m.id === it.medicineId)!;
          const batch = med.batches[0];
          db.dispensations.push({
            id: `dsp-${counter("dsp")}`,
            prescriptionId: rx.id,
            itemId: it.id,
            medicineId: med.id,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            quantity: it.quantity,
            dispensedByName: "Imran Shaikh",
            dispensedAt: addMinutes(new Date(record.updatedAt), 40).toISOString(),
          });
          invoiceItems.push({
            id: `ii-${counter("ii")}`,
            type: "PHARMACY",
            description: `${med.name} ${med.strength} × ${it.quantity}`,
            quantity: it.quantity,
            unitPrice: batch.mrp,
            amount: 0,
            refId: rx.id,
          });
        }
      }
    }

    /* Lab order */
    const wantsLab = tpl.labs.length > 0 && (patient.id === "pat-cch-0001" || chance(0.5));
    if (wantsLab) {
      let labStatus: LabOrderStatus = "APPROVED";
      if (offset === 0) labStatus = pick(["ORDERED", "ORDERED", "SAMPLE_COLLECTED", "PROCESSING"] as LabOrderStatus[]);
      else if (offset === -1)
        labStatus = pick(["SAMPLE_COLLECTED", "PROCESSING", "PENDING_APPROVAL", "PENDING_APPROVAL", "APPROVED"] as LabOrderStatus[]);
      const hasResults = ["PENDING_APPROVAL", "APPROVED"].includes(labStatus);
      const tests = tpl.labs.map((id) => {
        const t = LAB_TESTS.find((x) => x.id === id)!;
        return { testId: t.id, testName: t.name, price: t.price };
      });
      const created = addMinutes(new Date(startIso), slotMinutes).toISOString();
      const order: LabOrder = {
        id: `lab-${pad(counter("lab"), 5)}`,
        hospitalId: patient.hospitalId,
        number: `LAB-${year}-${pad(db.counters.lab, 5)}`,
        medicalRecordId: record.id,
        appointmentId: appt.id,
        patientId: patient.id,
        patientName,
        patientGender: patient.gender,
        doctorId: doctor.id,
        doctorName: docName,
        tests,
        priority: isEmergency ? "STAT" : chance(0.15) ? "URGENT" : "ROUTINE",
        status: labStatus,
        clinicalNotes: `Suspected ${tpl.diagnosis.description.toLowerCase()}.`,
        results: hasResults ? resultsFor(tpl.labs, patient.gender, patient.id === "pat-cch-0001" ? 0.4 : 0.25) : [],
        technicianRemarks: hasResults ? "Sample adequate. Results verified against internal QC." : undefined,
        collectedAt: labStatus !== "ORDERED" ? addMinutes(new Date(created), 30).toISOString() : undefined,
        collectedByName: labStatus !== "ORDERED" ? "Rahul Verma" : undefined,
        processedById: hasResults ? "usr-cch-lab" : undefined,
        processedByName: hasResults ? "Rahul Verma" : undefined,
        approvedAt: labStatus === "APPROVED" ? addMinutes(new Date(created), 60 * 8).toISOString() : undefined,
        approvedByName: labStatus === "APPROVED" ? "Deepa Rao" : undefined,
        createdAt: created,
        updatedAt: created,
      };
      db.labOrders.push(order);
      record.labOrderIds.push(order.id);
      for (const t of tests)
        invoiceItems.push({
          id: `ii-${counter("ii")}`,
          type: "LAB",
          description: t.testName,
          quantity: 1,
          unitPrice: t.price,
          amount: 0,
          refId: order.id,
        });
    }

    /* Invoice */
    invoiceItems.forEach((it) => (it.amount = round(it.quantity * it.unitPrice, 2)));
    const subtotal = round(
      invoiceItems.reduce((s, it) => s + it.amount, 0),
      2,
    );
    const discount = chance(0.1) ? round(subtotal * 0.1, 2) : 0;
    const total = round(subtotal - discount, 2);
    let invStatus: Invoice["status"] = "PAID";
    if (offset === 0) invStatus = chance(0.45) ? "PAID" : chance(0.5) ? "DRAFT" : "ISSUED";
    else if (patient.id === "pat-cch-0001" && offset > -6) invStatus = "ISSUED";
    else {
      const r = rand();
      invStatus = r < 0.74 ? "PAID" : r < 0.84 ? "ISSUED" : r < 0.9 ? "PARTIALLY_PAID" : patient.insurance ? "INSURANCE_PENDING" : "PAID";
    }
    const issuedAt = invStatus === "DRAFT" ? undefined : record.updatedAt;
    const payments: Payment[] = [];
    let amountPaid = 0;
    const invoiceId = `inv-${pad(counter("inv"), 5)}`;
    if (invStatus === "PAID" || invStatus === "PARTIALLY_PAID") {
      amountPaid = invStatus === "PAID" ? total : round(total * 0.5, 2);
      const method = pick(paymentMethods);
      payments.push({
        id: `pay-${counter("pay")}`,
        invoiceId,
        amount: amountPaid,
        method,
        status: "SUCCEEDED",
        gatewayRef: method === "CASH" ? undefined : method === "STRIPE_CARD" ? `pi_${int(1e9, 9e9)}` : `pay_${int(1e9, 9e9)}`,
        paidAt: new Date(Math.min(addMinutes(new Date(record.updatedAt), int(20, 90)).getTime(), NOW.getTime())).toISOString(),
        receivedByName: method === "CASH" ? "Pooja Desai" : undefined,
      });
    }
    const invoice: Invoice = {
      id: invoiceId,
      hospitalId: patient.hospitalId,
      number: `INV-${year}-${pad(db.counters.inv, 5)}`,
      patientId: patient.id,
      patientName,
      patientMrn: patient.mrn,
      appointmentId: appt.id,
      status: invStatus,
      items: invoiceItems,
      subtotal,
      discount,
      taxRate: 0,
      tax: 0,
      total,
      amountPaid,
      balanceDue: round(total - amountPaid, 2),
      currency: "INR",
      payments,
      issuedAt,
      dueDate: issuedAt ? dayStr(offset + 7) : undefined,
      createdAt: record.updatedAt,
      updatedAt: record.updatedAt,
    };
    db.invoices.push(invoice);
    appt.invoiceId = invoice.id;

    if (invStatus === "INSURANCE_PENDING" && patient.insurance) {
      const claim: InsuranceClaim = {
        id: `clm-${pad(counter("clm"), 4)}`,
        hospitalId: patient.hospitalId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        patientId: patient.id,
        patientName,
        tpaName: pick(TPAS),
        policyNumber: patient.insurance.policyNumber,
        claimAmount: total,
        status: pick(["SUBMITTED", "UNDER_REVIEW"] as const),
        submittedAt: addMinutes(new Date(record.updatedAt), 120).toISOString(),
        updatedAt: addMinutes(new Date(record.updatedAt), 120).toISOString(),
      };
      db.claims.push(claim);
      invoice.claimId = claim.id;
    }
    return appt;
  };

  /* Aarav's scripted history (the demo patient). */
  const aarav = db.patients.find((p) => p.id === "pat-cch-0001")!;
  const drMehta = db.doctors.find((d) => d.id === "doc-001")!;
  const drIyer = db.doctors.find((d) => d.id === "doc-002")!;
  const hypertensionTpl = CONDITION_TEMPLATES.findIndex((t) => t.diagnosis.code === "I10");
  const lipidTpl = CONDITION_TEMPLATES.findIndex((t) => t.diagnosis.code === "E78.5");
  const feverTpl = CONDITION_TEMPLATES.findIndex((t) => t.diagnosis.code === "B34.9");
  const scripted: PlannedAppointment[] = [
    {
      doctor: drMehta,
      patient: aarav,
      date: dayStr(-13),
      offset: -13,
      startTime: "10:00",
      slotMinutes: 30,
      departmentId: deptId(CITY, "GEN"),
      status: "COMPLETED",
      templateIndex: hypertensionTpl,
    },
    {
      doctor: drIyer,
      patient: aarav,
      date: dayStr(-8),
      offset: -8,
      startTime: "11:30",
      slotMinutes: 30,
      departmentId: deptId(CITY, "CAR"),
      status: "COMPLETED",
      templateIndex: lipidTpl,
    },
    {
      doctor: drMehta,
      patient: aarav,
      date: dayStr(-3),
      offset: -3,
      startTime: "09:30",
      slotMinutes: 30,
      departmentId: deptId(CITY, "GEN"),
      status: "COMPLETED",
      templateIndex: feverTpl,
      type: "FOLLOW_UP",
    },
    {
      doctor: drMehta,
      patient: aarav,
      date: dayStr(2),
      offset: 2,
      startTime: "10:30",
      slotMinutes: 30,
      departmentId: deptId(CITY, "GEN"),
      status: "CONFIRMED",
      templateIndex: hypertensionTpl,
      type: "FOLLOW_UP",
    },
  ];
  scripted.forEach(createEncounter);

  /* Everyone else. */
  for (let offset = -14; offset <= 7; offset++) {
    const date = dayStr(offset);
    const dow = addDays(TODAY, offset).getDay();
    for (const doctor of db.doctors) {
      if (db.availabilityExceptions.some((x) => x.doctorId === doctor.id && x.date === date)) continue;
      const rules = db.availability.filter((r) => r.doctorId === doctor.id && r.dayOfWeek === dow);
      const density = offset < 0 ? 0.55 : offset === 0 ? (doctor.id === "doc-001" ? 0.9 : 0.7) : offset <= 2 ? 0.5 : 0.25;
      const pool = outpatientPool(doctor.hospitalId);
      for (const rule of rules) {
        for (let m = toMinutes(rule.startTime); m + rule.slotMinutes <= toMinutes(rule.endTime); m += rule.slotMinutes) {
          const time = fromMinutes(m);
          if (booked.has(`${doctor.id}|${date}|${time}`) || !chance(density)) continue;
          let patient: Patient | undefined;
          for (let tries = 0; tries < 6 && !patient; tries++) {
            const cand = pick(pool);
            if (cand.id === aarav.id) continue;
            if (!booked.has(`${cand.id}|${date}|${time}`)) patient = cand;
          }
          if (!patient) continue;
          const departmentId = doctor.departmentIds.length > 1 && chance(0.3) ? doctor.departmentIds[1] : rule.departmentId;
          createEncounter({ doctor, patient, date, offset, startTime: time, slotMinutes: rule.slotMinutes, departmentId });
        }
      }
    }
  }
  // Keep at most one IN_PROGRESS encounter per doctor.
  const seenInProgress = new Set<string>();
  for (const a of db.appointments) {
    if (a.status !== "IN_PROGRESS") continue;
    if (seenInProgress.has(a.doctorId)) a.status = "CONFIRMED";
    else seenInProgress.add(a.doctorId);
  }

  /* Vaccinations */
  for (const p of patientsByHospital(CITY).slice(0, 60)) {
    const n = int(0, 3);
    for (let i = 0; i < n; i++) {
      const date = dayStr(-int(30, 900));
      const v: Vaccination = {
        id: `vac-${counter("vac")}`,
        patientId: p.id,
        vaccine: pick(VACCINES),
        date,
        batchNumber: `VB${int(10000, 99999)}`,
        nextDueDate: chance(0.5) ? dayStr(int(10, 300)) : undefined,
      };
      db.vaccinations.push(v);
    }
  }
  db.vaccinations.push({
    id: `vac-${counter("vac")}`,
    patientId: aarav.id,
    vaccine: "Influenza (seasonal)",
    date: dayStr(-330),
    batchNumber: "FLU22871",
    nextDueDate: dayStr(35),
  });

  /* ---------------- Admissions (nurse / wards) ---------------- */

  const inpatients = patientsByHospital(CITY).slice(30);
  let inpatientIdx = 0;
  for (const ward of db.wards.filter((w) => w.hospitalId === CITY)) {
    const occupancy = Math.round(ward.totalBeds * (0.55 + rand() * 0.35));
    const wardDoctor = db.doctors.find((d) => d.departmentIds.includes(ward.departmentId)) ?? drMehta;
    for (let b = 0; b < occupancy && inpatientIdx < inpatients.length; b++) {
      const patient = inpatients[inpatientIdx++];
      const daysIn = int(0, 6);
      const admittedAt = daysAgoIso(daysIn, int(6, 22));
      const tpl = pick(templatesFor(deptCode(ward.departmentId)));
      const vitals: Vitals[] = [];
      for (let h = 0; h <= Math.min(daysIn * 2, 5); h++) {
        vitals.push(
          makeVitals(
            patient,
            addMinutes(new Date(admittedAt), h * 360).toISOString(),
            "usr-cch-nurse",
            h % 2 ? "Lakshmi Menon" : nurseName,
            h < 3,
          ),
        );
      }
      const admission: Admission = {
        id: `adm-${pad(counter("adm"), 4)}`,
        hospitalId: CITY,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientMrn: patient.mrn,
        wardId: ward.id,
        wardName: ward.name,
        bedNumber: `${ward.name
          .split(" ")
          .map((w) => w[0])
          .join("")}-${pad(b + 1, 2)}`,
        attendingDoctorId: wardDoctor.id,
        attendingDoctorName: `Dr. ${wardDoctor.firstName} ${wardDoctor.lastName}`,
        diagnosis: tpl.diagnosis.description,
        status: "ADMITTED",
        admittedAt,
        vitals: vitals.reverse(),
        medicationLog: tpl.medicines
          .slice(0, 2)
          .flatMap((m, i) => [
            {
              id: `mar-${counter("mar")}`,
              medicine: m,
              dose: "1 tab",
              route: "Oral",
              administeredAt: addMinutes(NOW, -(i * 180 + int(30, 170))).toISOString(),
              nurseName,
              notes: i === 0 ? "Tolerated well" : undefined,
            },
          ]),
        nursingNotes: [
          {
            id: `note-${counter("note")}`,
            authorId: "usr-cch-nurse",
            authorName: nurseName,
            authorRole: "NURSE",
            text: pick([
              "Patient comfortable, resting.",
              "Ambulating with support.",
              "Mild pain reported, analgesic given as per chart.",
              "Oral intake adequate.",
            ]),
            createdAt: addMinutes(NOW, -int(30, 600)).toISOString(),
          },
        ],
      };
      db.admissions.push(admission);
    }
  }
  for (const dep of db.departments) {
    const wardIds = db.wards.filter((w) => w.departmentId === dep.id).map((w) => w.id);
    dep.occupiedBeds = db.admissions.filter((a) => a.status === "ADMITTED" && wardIds.includes(a.wardId)).length;
  }

  /* ---------------- Settled claims history ---------------- */

  db.invoices
    .filter((i) => i.status === "PAID" && i.hospitalId === CITY)
    .slice(0, 6)
    .forEach((inv) => {
      const p = db.patients.find((x) => x.id === inv.patientId);
      if (!p?.insurance) return;
      db.claims.push({
        id: `clm-${pad(counter("clm"), 4)}`,
        hospitalId: inv.hospitalId,
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        patientId: p.id,
        patientName: inv.patientName,
        tpaName: pick(TPAS),
        policyNumber: p.insurance.policyNumber,
        claimAmount: inv.total,
        approvedAmount: round(inv.total * 0.9, 2),
        status: "SETTLED",
        remarks: "Settled after 10% co-pay",
        submittedAt: inv.createdAt,
        updatedAt: inv.updatedAt,
      });
    });

  /* ---------------- Notifications ---------------- */

  const notify = (n: Omit<Notification, "id">) => db.notifications.push({ id: `ntf-${pad(counter("ntf"), 5)}`, ...n });
  const upcomingAarav = db.appointments.find((a) => a.patientId === aarav.id && a.status === "CONFIRMED");
  const aaravLab = db.labOrders.find((l) => l.patientId === aarav.id && l.status === "APPROVED");
  const aaravInvoice = db.invoices.find((i) => i.patientId === aarav.id && i.status === "ISSUED");
  if (upcomingAarav)
    notify({
      userId: "usr-pat-aarav",
      type: "APPOINTMENT_CONFIRMED",
      title: "Appointment confirmed",
      body: `Your appointment with ${upcomingAarav.doctorName} on ${upcomingAarav.date} at ${upcomingAarav.startTime} is confirmed.`,
      link: "/portal/appointments",
      channels: ["EMAIL", "SMS", "IN_APP"],
      readAt: null,
      createdAt: daysAgoIso(1, 12),
    });
  if (aaravLab)
    notify({
      userId: "usr-pat-aarav",
      type: "LAB_REPORT_APPROVED",
      title: "Lab report ready",
      body: `Your ${aaravLab.tests.map((t) => t.testName).join(", ")} report is now available.`,
      link: `/portal/reports/${aaravLab.id}`,
      channels: ["EMAIL", "IN_APP"],
      readAt: null,
      createdAt: daysAgoIso(2, 18),
    });
  if (aaravInvoice)
    notify({
      userId: "usr-pat-aarav",
      type: "INVOICE_GENERATED",
      title: "New invoice",
      body: `Invoice ${aaravInvoice.number} for ₹${aaravInvoice.total} is due.`,
      link: `/portal/invoices/${aaravInvoice.id}`,
      channels: ["EMAIL", "IN_APP"],
      readAt: daysAgoIso(1, 9),
      createdAt: daysAgoIso(3, 11),
    });

  const staffNotices: [string, Notification["type"], string, string, string][] = [
    [
      "usr-doc-001",
      "EMERGENCY_APPOINTMENT",
      "Emergency appointment",
      "An emergency appointment was added to your schedule today.",
      "/appointments",
    ],
    ["usr-doc-001", "LAB_REPORT_APPROVED", "Lab results approved", "CBC results for one of your patients have been approved.", "/lab"],
    ["usr-cch-pharmacy", "LOW_STOCK_ALERT", "Low stock: Augmentin 625 Duo", "Stock (34) is below the reorder level (100).", "/pharmacy"],
    [
      "usr-cch-pharmacy",
      "EXPIRY_ALERT",
      "3 batches expiring within 30 days",
      "Nightly expiry scan found batches that need attention.",
      "/pharmacy?stock=EXPIRING",
    ],
    ["usr-cch-admin", "LOW_STOCK_ALERT", "Pharmacy low-stock report", "5 medicines are at or below reorder level.", "/pharmacy"],
    [
      "usr-cch-admin",
      "EXPIRY_ALERT",
      "Expiry report",
      "3 batches expire within 30 days; 1 expired batch is not yet quarantined.",
      "/pharmacy?stock=EXPIRING",
    ],
    ["usr-cch-lab", "GENERAL", "New STAT order", "A STAT lab order was placed from Emergency.", "/lab"],
    ["usr-cch-accounts", "PAYMENT_RECEIVED", "Payment received", "₹2,350 received via Razorpay UPI.", "/billing"],
    [
      "usr-cch-reception",
      "APPOINTMENT_CONFIRMED",
      "Online booking",
      "A patient booked an appointment through the portal.",
      "/appointments",
    ],
    ["usr-cch-nurse", "GENERAL", "Vitals due", "6 patients in General Ward A are due for 4-hourly vitals.", "/wards"],
    ["usr-superadmin", "GENERAL", "New hospital signup", "Lotus Health Centre is awaiting verification.", "/hospitals"],
  ];
  staffNotices.forEach(([userId, type, title, body, link], i) =>
    notify({
      userId,
      type,
      title,
      body,
      link,
      channels: ["IN_APP", "EMAIL"],
      readAt: i % 3 === 2 ? daysAgoIso(0, 9) : null,
      createdAt: addMinutes(NOW, -(i + 1) * 47).toISOString(),
    }),
  );

  /* ---------------- Audit log ---------------- */

  const audit = (a: Omit<AuditLog, "id">) => db.auditLogs.push({ id: `aud-${pad(counter("aud"), 5)}`, ...a });
  const ips = ["10.0.4.21", "10.0.4.37", "49.36.112.8", "10.0.5.12", "103.21.58.4"];
  db.appointments.slice(-80).forEach((a) => {
    const actor = db.users.find((u) => u.id === a.createdById) ?? db.users.find((u) => u.id === "usr-cch-reception")!;
    audit({
      hospitalId: a.hospitalId,
      userId: actor.id,
      userName: `${actor.firstName} ${actor.lastName}`,
      userRole: actor.role,
      action: "CREATE",
      entityType: "Appointment",
      entityId: a.id,
      summary: `Booked ${a.patientName} with ${a.doctorName} on ${a.date} ${a.startTime}`,
      ip: pick(ips),
      createdAt: a.createdAt,
    });
  });
  db.invoices
    .filter((i) => i.status === "PAID")
    .slice(-40)
    .forEach((i) => {
      audit({
        hospitalId: i.hospitalId,
        userId: "usr-cch-accounts",
        userName: "Nikhil Bansal",
        userRole: "ACCOUNTANT",
        action: "UPDATE",
        entityType: "Invoice",
        entityId: i.id,
        summary: `Marked ${i.number} as paid (₹${i.total})`,
        ip: pick(ips),
        createdAt: i.payments[0]?.paidAt ?? i.updatedAt,
      });
    });
  db.users
    .filter((u) => u.lastLoginAt)
    .forEach((u) => {
      audit({
        hospitalId: u.hospitalId,
        userId: u.id,
        userName: `${u.firstName} ${u.lastName}`,
        userRole: u.role,
        action: "LOGIN",
        entityType: "User",
        entityId: u.id,
        summary: "Signed in",
        ip: pick(ips),
        createdAt: u.lastLoginAt!,
      });
    });
  audit({
    hospitalId: "hosp-lotus",
    userId: "usr-superadmin",
    userName: "Platform Operations",
    userRole: "SUPER_ADMIN",
    action: "CREATE",
    entityType: "Hospital",
    entityId: "hosp-lotus",
    summary: "Onboarded Lotus Health Centre (pending verification)",
    ip: "10.0.0.2",
    createdAt: daysAgoIso(2, 15),
  });
  db.auditLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  db.counters.hospitalPatients = db.patients.length;
  return db;
}
