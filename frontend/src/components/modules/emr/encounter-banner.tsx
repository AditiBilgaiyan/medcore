import { Clock, Droplet } from "lucide-react";
import Link from "next/link";
import { AllergyBadges } from "@/components/shared/clinical";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ROUTES } from "@/constants/routes";
import { ageGender, formatDate, formatTime, fullName } from "@/lib/format";
import type { Allergy, Appointment, Patient } from "@/types";

export const ENCOUNTER_SECTIONS = [
  { id: "vitals", label: "Vitals" },
  { id: "clinical-notes", label: "Clinical notes" },
  { id: "notes", label: "Notes" },
  { id: "attachments", label: "Attachments" },
  { id: "prescription", label: "Prescription" },
  { id: "lab-orders", label: "Lab orders" },
];

/** Sticky patient context for the encounter — allergies always in view while prescribing. */
export function EncounterBanner({
  patient,
  appointment,
  allergies,
  actions,
  showNav,
}: {
  patient: Patient;
  appointment: Appointment;
  allergies: Allergy[];
  actions?: React.ReactNode;
  showNav?: boolean;
}) {
  return (
    <section
      aria-label="Patient summary"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/85 z-20 -mx-4 border-y px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:sticky lg:top-14"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 gap-3">
          <UserAvatar name={fullName(patient)} className="size-10" />
          <div className="min-w-0 space-y-1">
            <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold">
              <Link href={ROUTES.patient(patient.id)} className="truncate hover:underline">
                {fullName(patient)}
              </Link>
              <StatusBadge status={appointment.status} />
              {appointment.isEmergency && <StatusBadge status="EMERGENCY" />}
            </h1>
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
              <span className="text-foreground font-mono">{patient.mrn}</span>
              <span className="tabular-nums">{ageGender(patient.dob, patient.gender)}</span>
              <span className="inline-flex items-center gap-1">
                <Droplet className="size-3.5" aria-hidden />
                <span className="sr-only">Blood group</span>
                {patient.bloodGroup ?? "Unknown"}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="size-3.5" aria-hidden />
                {formatDate(appointment.date)} · {formatTime(appointment.startTime)}
              </span>
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Reason: </span>
              {appointment.reason || "—"}
            </p>
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <div className="mt-2.5 flex flex-col gap-x-6 gap-y-2 md:flex-row md:flex-wrap md:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Allergies</span>
          <AllergyBadges allergies={allergies} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Chronic</span>
          {patient.chronicConditions.length ? (
            <ul className="flex flex-wrap gap-1">
              {patient.chronicConditions.map((c) => (
                <li key={c} className="bg-secondary text-secondary-foreground rounded-md px-1.5 py-0.5 text-xs">
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted-foreground text-sm">None recorded</span>
          )}
        </div>
      </div>

      {showNav && (
        <nav aria-label="Encounter sections" className="mt-2.5 -mb-1 hidden overflow-x-auto lg:block">
          <ul className="flex gap-1">
            {ENCOUNTER_SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-ring inline-flex h-6 items-center rounded-md px-2 text-xs font-medium focus-visible:outline-2"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
