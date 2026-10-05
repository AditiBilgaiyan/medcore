"use client";

import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Siren,
  Stethoscope,
  UserPlus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PatientPicker } from "@/components/shared/patient-picker";
import { KeyValueGrid } from "@/components/shared/section-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, errorMessage } from "@/lib/api/client";
import { ageGender, doctorName, formatCurrency, formatDate, formatTime, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDepartments } from "@/services/admin";
import { useCreateAppointment } from "@/services/appointments";
import { useAvailability, useDoctor, useDoctors, useSlots } from "@/services/doctors";
import { usePatient } from "@/services/patients";
import type { Appointment, CreateAppointmentRequest, Doctor } from "@/types";
import { AcceptingBadge, DoctorLanguages, DoctorRating } from "../doctors/doctor-bits";
import { DatePickerStrip } from "./date-picker-strip";
import { SlotGrid } from "./slot-grid";
import { friendlyDate, todayISO } from "./utils";

type StepId = "patient" | "doctor" | "slot" | "details" | "review";

const STEP_META: Record<StepId, { title: string; description: string }> = {
  patient: { title: "Patient", description: "Who is the appointment for?" },
  doctor: { title: "Doctor", description: "Pick a department, then a doctor." },
  slot: { title: "Date & time", description: "Choose a day within the next 30 days, then an open slot." },
  details: { title: "Visit details", description: "Tell the doctor what the visit is about." },
  review: { title: "Review & confirm", description: "Check the details before booking." },
};

type VisitType = "CONSULTATION" | "FOLLOW_UP";

interface BookingError {
  step: StepId;
  title: string;
  message: string;
  items?: string[];
}

export interface BookingFlowProps {
  mode: "staff" | "patient";
  initialPatientId?: string;
  initialDoctorId?: string;
  onBooked?: (appt: Appointment) => void;
  className?: string;
}

/** Multi-step booking wizard shared by the desk (staff) and the patient portal. */
export function BookingFlow(props: BookingFlowProps) {
  // Remounting resets every field for "Book another".
  const [instance, setInstance] = useState(0);
  return <BookingWizard key={instance} {...props} onReset={() => setInstance((i) => i + 1)} />;
}

const FIELD_STEP: Record<string, StepId> = {
  patientId: "patient",
  doctorId: "doctor",
  departmentId: "doctor",
  date: "slot",
  startTime: "slot",
  reason: "details",
  notes: "details",
  type: "details",
};

function BookingWizard({
  mode,
  initialPatientId,
  initialDoctorId,
  onBooked,
  className,
  onReset,
}: BookingFlowProps & { onReset: () => void }) {
  const { user, can } = useAuth();
  const steps = useMemo<StepId[]>(
    () => (mode === "staff" ? ["patient", "doctor", "slot", "details", "review"] : ["doctor", "slot", "details", "review"]),
    [mode],
  );
  const canEmergency = mode === "staff" && can("appointments:emergency");

  const [patientId, setPatientId] = useState<string | undefined>(initialPatientId);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [doctorId, setDoctorId] = useState<string | undefined>(initialDoctorId);
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState<string>();
  const [visitType, setVisitType] = useState<VisitType>("CONSULTATION");
  const [emergency, setEmergency] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [attempted, setAttempted] = useState<Partial<Record<StepId, boolean>>>({});
  const [error, setError] = useState<BookingError | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);

  const firstStep: StepId = mode === "staff" && !initialPatientId ? "patient" : initialDoctorId ? "slot" : "doctor";
  const [{ step, dir }, setStepState] = useState<{ step: StepId; dir: number }>({ step: firstStep, dir: 1 });
  const [maxReached, setMaxReached] = useState(steps.indexOf(firstStep));
  const stepIndex = steps.indexOf(step);

  const patient = usePatient(mode === "staff" ? patientId : undefined);
  const doctor = useDoctor(doctorId);
  const availability = useAvailability(doctorId);
  const slots = useSlots(emergency ? undefined : doctorId, date);
  const create = useCreateAppointment();

  const selectedDoctor = doctor.data;
  const bookingDepartmentId =
    selectedDoctor && departmentId && selectedDoctor.departmentIds.includes(departmentId) ? departmentId : selectedDoctor?.departmentIds[0];

  /* ------------------------------ validation ------------------------------ */
  const problems: Record<StepId, string | null> = {
    patient: mode === "staff" && !patientId ? "Choose a patient to continue." : null,
    doctor: !doctorId
      ? "Choose a doctor to continue."
      : selectedDoctor && !selectedDoctor.isAcceptingPatients && !emergency
        ? "This doctor isn't accepting new appointments. Choose another doctor."
        : null,
    slot: emergency ? null : !startTime ? "Choose an available time slot." : null,
    details:
      reason.trim().length < 3
        ? "Give a reason for the visit (at least 3 characters)."
        : reason.length > 500
          ? "Keep the reason under 500 characters."
          : null,
    review: null,
  };
  const firstInvalid = steps.find((s) => problems[s]);

  /* ------------------------------ navigation ------------------------------ */
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Move focus to the step heading when the step (or result) changes — not on first render.
  const focusKey = `${step}:${booked?.id ?? ""}`;
  const lastFocusKey = useRef(focusKey);
  useEffect(() => {
    if (lastFocusKey.current === focusKey) return;
    lastFocusKey.current = focusKey;
    headingRef.current?.focus();
  }, [focusKey]);

  const goTo = (target: StepId) => {
    const idx = steps.indexOf(target);
    setStepState({ step: target, dir: idx >= stepIndex ? 1 : -1 });
    setMaxReached((m) => Math.max(m, idx));
  };

  const next = () => {
    if (problems[step]) {
      setAttempted((a) => ({ ...a, [step]: true }));
      return;
    }
    setError(null);
    goTo(steps[stepIndex + 1]);
  };
  const back = () => {
    setError(null);
    goTo(steps[stepIndex - 1]);
  };

  /* ------------------------------ submit ------------------------------ */
  const submit = async () => {
    if (firstInvalid) {
      setAttempted((a) => ({ ...a, [firstInvalid]: true }));
      goTo(firstInvalid);
      return;
    }
    const patientRef = mode === "staff" ? patientId : user?.patientId;
    if (!patientRef || !doctorId || !bookingDepartmentId) return;
    setError(null);
    const body: CreateAppointmentRequest = {
      patientId: patientRef,
      doctorId,
      departmentId: bookingDepartmentId,
      date: emergency ? todayISO() : date,
      startTime: emergency ? format(new Date(), "HH:mm") : startTime!,
      type: emergency ? "EMERGENCY" : visitType,
      reason: reason.trim(),
      notes: notes.trim() || undefined,
    };
    try {
      const appt = await create.mutateAsync(body);
      setBooked(appt);
      toast.success(appt.status === "PENDING" ? "Appointment requested" : "Appointment booked", {
        description: `${appt.doctorName} · ${formatDate(appt.date)}, ${formatTime(appt.startTime)}`,
      });
      onBooked?.(appt);
    } catch (err) {
      handleError(err);
    }
  };

  const handleError = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : "";
    const message = errorMessage(err);
    let next: BookingError;
    switch (code) {
      case "SLOT_UNAVAILABLE":
        setStartTime(undefined);
        void slots.refetch();
        next = {
          step: "slot",
          title: "That slot was just taken",
          message: "This slot was just booked by another patient. Pick another time — everything else is saved.",
        };
        break;
      case "OUTSIDE_AVAILABILITY":
        setStartTime(undefined);
        void slots.refetch();
        next = { step: "slot", title: "Outside the doctor's hours", message };
        break;
      case "PAST_DATE":
        setDate(todayISO());
        setStartTime(undefined);
        next = { step: "slot", title: "That time has passed", message: "You can't book in the past. Choose a time from today onwards." };
        break;
      case "PATIENT_CONFLICT":
        setStartTime(undefined);
        next = { step: "slot", title: "Clashing appointment", message: `${message} Choose a different time.` };
        break;
      case "DOCTOR_UNAVAILABLE":
        next = { step: "doctor", title: "Doctor unavailable", message: `${message} Choose another doctor.` };
        void doctor.refetch();
        break;
      default: {
        const details = err instanceof ApiError ? err.details : undefined;
        if (details && Object.keys(details).length) {
          const fields = Object.keys(details);
          const target = steps.find((s) => fields.some((f) => FIELD_STEP[f] === s)) ?? "review";
          next = {
            step: target,
            title: "Check these details",
            message,
            items: Object.entries(details).flatMap(([f, msgs]) => msgs.map((m) => `${humanField(f)}: ${m}`)),
          };
        } else {
          next = { step: "review", title: "Couldn't book the appointment", message };
        }
      }
    }
    setError(next);
    if (next.step !== step) goTo(next.step);
  };

  /* ------------------------------ render ------------------------------ */
  if (booked) {
    return <SuccessScreen appt={booked} mode={mode} headingRef={headingRef} onReset={onReset} className={className} />;
  }

  const meta = STEP_META[step];
  const showProblem = attempted[step] && problems[step];

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]", className)}>
      <Card className="gap-0 overflow-hidden py-0">
        {/* Step indicator */}
        <nav aria-label="Booking steps" className="bg-muted/30 border-b px-3 py-3 sm:px-4">
          <ol className="flex items-center gap-1 overflow-x-auto">
            {steps.map((s, i) => {
              const done = i < stepIndex;
              const current = s === step;
              const reachable = i <= maxReached && s !== step;
              return (
                <li key={s} className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => reachable && goTo(s)}
                    disabled={!reachable && !current}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "focus-visible:ring-ring/50 flex min-h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors outline-none focus-visible:ring-3",
                      current ? "text-foreground font-semibold" : done ? "text-foreground hover:bg-muted" : "text-muted-foreground",
                      reachable && "cursor-pointer",
                      !reachable && !current && "cursor-default",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full border text-xs tabular-nums",
                        current && "border-primary bg-primary text-primary-foreground",
                        done && !current && "border-primary/40 bg-secondary text-secondary-foreground",
                      )}
                      aria-hidden
                    >
                      {done ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    <span className={cn(!current && "hidden md:inline")}>{STEP_META[s].title}</span>
                    <span className="sr-only">{done ? "(completed)" : current ? "(current step)" : ""}</span>
                  </button>
                  {i < steps.length - 1 && <span className="bg-border h-px w-3 sm:w-6" aria-hidden />}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="space-y-0.5">
            <p className="text-muted-foreground text-xs font-medium tabular-nums">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
              {meta.title}
            </h2>
            <p className="text-muted-foreground text-sm">{meta.description}</p>
          </div>

          <div aria-live="assertive" aria-atomic="true">
            {error && error.step === step && (
              <Alert variant="destructive">
                <AlertTriangle aria-hidden />
                <AlertTitle>{error.title}</AlertTitle>
                <AlertDescription>
                  <p>{error.message}</p>
                  {error.items && (
                    <ul className="mt-1 list-disc pl-4">
                      {error.items.map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -16 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {step === "patient" && (
                <PatientStep
                  patientId={patientId}
                  onChange={(id) => {
                    setPatientId(id);
                    setError(null);
                  }}
                  invalid={!!showProblem}
                />
              )}
              {step === "doctor" && (
                <DoctorStep
                  departmentId={departmentId}
                  onDepartmentChange={setDepartmentId}
                  doctorId={doctorId}
                  onDoctorChange={(id) => {
                    if (id !== doctorId) setStartTime(undefined);
                    setDoctorId(id);
                    setError(null);
                  }}
                  allowNotAccepting={emergency}
                />
              )}
              {step === "slot" && (
                <div className="space-y-5">
                  <SelectedDoctorLine doctor={selectedDoctor} onChange={() => goTo("doctor")} />
                  {canEmergency && <EmergencyToggle checked={emergency} onChange={setEmergency} />}
                  {emergency ? (
                    <Alert>
                      <Siren aria-hidden />
                      <AlertTitle>Emergency — slot selection skipped</AlertTitle>
                      <AlertDescription>
                        Booked for today at the current time, regardless of the doctor&apos;s schedule. The doctor is notified immediately.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <DatePickerStrip
                        value={date}
                        onChange={(d) => {
                          setDate(d);
                          setStartTime(undefined);
                        }}
                        rules={availability.data?.rules}
                        exceptions={availability.data?.exceptions}
                      />
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">
                          Available times · <span className="tabular-nums">{friendlyDate(date)}</span>
                        </h3>
                        <SlotGrid
                          label={`Available times on ${friendlyDate(date)}`}
                          slots={slots.data}
                          isLoading={slots.isLoading}
                          error={slots.error}
                          onRetry={() => void slots.refetch()}
                          value={startTime}
                          onChange={(t) => {
                            setStartTime(t);
                            if (error?.step === "slot") setError(null);
                          }}
                          emptyTitle={
                            availability.data?.exceptions.some((x) => x.date === date) ? "Doctor on leave" : "Doctor not available"
                          }
                          emptyDescription={
                            availability.data?.exceptions.find((x) => x.date === date)?.reason ??
                            `${doctorName(selectedDoctor)} doesn't see patients on ${friendlyDate(date).replace(/^(Today|Tomorrow)$/, (m) => m.toLowerCase())}. Pick another date.`
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              {step === "details" && (
                <DetailsStep
                  visitType={visitType}
                  onVisitType={setVisitType}
                  reason={reason}
                  onReason={setReason}
                  notes={notes}
                  onNotes={setNotes}
                  emergency={emergency}
                  onEmergency={canEmergency ? setEmergency : undefined}
                  reasonError={attempted.details ? problems.details : null}
                />
              )}
              {step === "review" && (
                <ReviewStep
                  mode={mode}
                  patientLabel={patient.data ? `${fullName(patient.data)} · ${patient.data.mrn}` : undefined}
                  doctor={selectedDoctor}
                  departmentId={bookingDepartmentId}
                  date={emergency ? todayISO() : date}
                  startTime={emergency ? undefined : startTime}
                  emergency={emergency}
                  visitType={visitType}
                  reason={reason}
                  notes={notes}
                  onEdit={goTo}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {showProblem && step !== "details" && (
            <p role="alert" className="text-destructive text-sm">
              {problems[step]}
            </p>
          )}
        </div>

        <div className="bg-muted/20 flex items-center justify-between gap-2 border-t px-4 py-3 sm:px-5">
          <Button variant="outline" onClick={back} disabled={stepIndex === 0 || create.isPending}>
            <ArrowLeft /> Back
          </Button>
          {step === "review" ? (
            <Button size="lg" onClick={submit} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" /> : <CalendarCheck2 />}
              {mode === "patient" ? "Request appointment" : emergency ? "Book emergency" : "Confirm booking"}
            </Button>
          ) : (
            <Button onClick={next}>
              Continue <ArrowRight />
            </Button>
          )}
        </div>
      </Card>

      <BookingSummary
        mode={mode}
        patientLabel={patient.data ? fullName(patient.data) : undefined}
        patientSub={patient.data ? patient.data.mrn : undefined}
        doctor={selectedDoctor}
        date={emergency ? todayISO() : date}
        startTime={startTime}
        emergency={emergency}
        visitType={visitType}
      />
    </div>
  );
}

function humanField(f: string) {
  return f
    .replace(/Id$/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());
}

/* ================================ Steps ================================ */

function PatientStep({
  patientId,
  onChange,
  invalid,
}: {
  patientId?: string;
  onChange: (id: string | undefined) => void;
  invalid: boolean;
}) {
  const { can } = useAuth();
  const { data: p, isLoading } = usePatient(patientId);
  return (
    <FieldGroup className="gap-4">
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="booking-patient">Patient</FieldLabel>
        <PatientPicker id="booking-patient" value={patientId} onChange={(pt) => onChange(pt?.id)} invalid={invalid} />
        <FieldDescription>Search by name, MRN or phone number.</FieldDescription>
      </Field>
      {patientId && isLoading && <Skeleton className="h-20" />}
      {p && (
        <div className="bg-muted/30 flex items-start gap-3 rounded-lg border p-3">
          <UserAvatar name={fullName(p)} className="size-10" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{fullName(p)}</p>
            <p className="text-muted-foreground tabular-nums">
              {p.mrn} · {ageGender(p.dob, p.gender)} · {p.phone}
            </p>
            {p.allergies.length > 0 && (
              <p className="text-destructive mt-1 text-xs">Allergies: {p.allergies.map((a) => a.substance).join(", ")}</p>
            )}
          </div>
        </div>
      )}
      {can("patients:write") && (
        <p className="text-muted-foreground text-sm">
          New patient?{" "}
          <Link
            href={ROUTES.patientNew}
            className="text-primary inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
          >
            <UserPlus className="size-3.5" aria-hidden /> Register them first
          </Link>
        </p>
      )}
    </FieldGroup>
  );
}

function DoctorStep({
  departmentId,
  onDepartmentChange,
  doctorId,
  onDoctorChange,
  allowNotAccepting,
}: {
  departmentId: string;
  onDepartmentChange: (id: string) => void;
  doctorId?: string;
  onDoctorChange: (id: string) => void;
  allowNotAccepting: boolean;
}) {
  const departments = useDepartments();
  const doctors = useDoctors({ departmentId: departmentId || undefined });
  const deptName = (id: string) => departments.data?.find((d) => d.id === id)?.name;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-medium" id="dept-label">
          Department
        </h3>
        {departments.isLoading ? (
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-28" />
            ))}
          </div>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-labelledby="dept-label">
            {[{ id: "", name: "All departments" }, ...(departments.data ?? [])].map((d) => (
              <li key={d.id || "all"}>
                <Button
                  type="button"
                  variant={departmentId === d.id ? "default" : "outline"}
                  aria-pressed={departmentId === d.id}
                  className="min-h-9"
                  onClick={() => onDepartmentChange(d.id)}
                >
                  {departmentId === d.id && <Check aria-hidden />}
                  {d.name}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium" id="doctor-label">
          Doctor
        </h3>
        {doctors.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        ) : doctors.error && !doctors.data ? (
          <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} />
        ) : !doctors.data?.data.length ? (
          <EmptyState icon={Stethoscope} title="No doctors in this department" description="Try another department." compact />
        ) : (
          <ul className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", doctors.isFetching && "opacity-70")} aria-labelledby="doctor-label">
            {doctors.data.data.map((d) => (
              <li key={d.id}>
                <DoctorChoice
                  doctor={d}
                  selected={d.id === doctorId}
                  disabled={!d.isAcceptingPatients && !allowNotAccepting}
                  departmentNames={d.departmentIds.map(deptName).filter(Boolean) as string[]}
                  onSelect={() => onDoctorChange(d.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DoctorChoice({
  doctor,
  selected,
  disabled,
  departmentNames,
  onSelect,
}: {
  doctor: Doctor;
  selected: boolean;
  disabled: boolean;
  departmentNames: string[];
  onSelect: () => void;
}) {
  const name = doctorName(doctor);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onSelect()}
      className={cn(
        "bg-card relative flex h-full w-full flex-col gap-2 rounded-xl border p-3 text-left text-sm transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
        selected ? "border-primary ring-primary/30 ring-2" : "hover:border-primary/50 hover:bg-accent/40",
        disabled && "hover:border-border hover:bg-card cursor-not-allowed opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <UserAvatar name={name} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-muted-foreground truncate">{doctor.specialisation}</p>
          {departmentNames.length > 0 && <p className="text-muted-foreground truncate text-xs">{departmentNames.join(", ")}</p>}
        </div>
        {selected && (
          <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full" aria-hidden>
            <Check className="size-3.5" />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <DoctorRating rating={doctor.rating} />
        <span className="text-muted-foreground tabular-nums">{doctor.experienceYears} yrs exp.</span>
        <span className="font-medium tabular-nums">{formatCurrency(doctor.consultationFee)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <DoctorLanguages languages={doctor.languages} />
        {!doctor.isAcceptingPatients && <AcceptingBadge doctor={doctor} />}
      </div>
    </button>
  );
}

function SelectedDoctorLine({ doctor, onChange }: { doctor?: Doctor; onChange: () => void }) {
  if (!doctor) return <Skeleton className="h-12" />;
  return (
    <div className="bg-muted/30 flex items-center gap-3 rounded-lg border px-3 py-2">
      <UserAvatar name={doctorName(doctor)} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-medium">{doctorName(doctor)}</p>
        <p className="text-muted-foreground truncate text-xs">
          {doctor.specialisation} · <span className="tabular-nums">{formatCurrency(doctor.consultationFee)}</span>
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onChange}>
        Change
      </Button>
    </div>
  );
}

function EmergencyToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <FieldLabel htmlFor="booking-emergency" className={cn(checked && "border-destructive/40")}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>
            <Siren className="text-destructive size-4" aria-hidden /> Emergency
          </FieldTitle>
          <FieldDescription>Bypasses slot selection and books the patient in now.</FieldDescription>
        </FieldContent>
        <Switch id="booking-emergency" checked={checked} onCheckedChange={onChange} />
      </Field>
    </FieldLabel>
  );
}

function DetailsStep({
  visitType,
  onVisitType,
  reason,
  onReason,
  notes,
  onNotes,
  emergency,
  onEmergency,
  reasonError,
}: {
  visitType: VisitType;
  onVisitType: (v: VisitType) => void;
  reason: string;
  onReason: (v: string) => void;
  notes: string;
  onNotes: (v: string) => void;
  emergency: boolean;
  onEmergency?: (v: boolean) => void;
  reasonError: string | null;
}) {
  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldTitle id="visit-type-label">Visit type</FieldTitle>
        <RadioGroup
          value={visitType}
          onValueChange={(v) => onVisitType(v as VisitType)}
          aria-labelledby="visit-type-label"
          className="grid gap-2 sm:grid-cols-2"
          disabled={emergency}
        >
          {(
            [
              ["CONSULTATION", "Consultation", "New problem or first visit."],
              ["FOLLOW_UP", "Follow-up", "Review of an earlier visit — usually half fee."],
            ] as const
          ).map(([value, title, desc]) => (
            <FieldLabel key={value} htmlFor={`vt-${value}`}>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{title}</FieldTitle>
                  <FieldDescription>{desc}</FieldDescription>
                </FieldContent>
                <RadioGroupItem value={value} id={`vt-${value}`} />
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </Field>
      {onEmergency && <EmergencyToggle checked={emergency} onChange={onEmergency} />}
      <Field data-invalid={!!reasonError || undefined}>
        <FieldLabel htmlFor="booking-reason">
          Reason for visit <span className="text-destructive">*</span>
        </FieldLabel>
        <Textarea
          id="booking-reason"
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          placeholder="e.g. Fever and cough for 3 days"
          rows={3}
          maxLength={500}
          aria-invalid={!!reasonError || undefined}
          aria-describedby="booking-reason-count"
          required
        />
        <div className="flex justify-between gap-2">
          <FieldError errors={reasonError ? [{ message: reasonError }] : []} />
          <span id="booking-reason-count" className="text-muted-foreground ml-auto text-xs tabular-nums">
            {reason.length}/500
          </span>
        </div>
      </Field>
      <Field>
        <FieldLabel htmlFor="booking-notes">Notes (optional)</FieldLabel>
        <Textarea
          id="booking-notes"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder="Anything the front desk or doctor should know"
          rows={2}
          maxLength={1000}
        />
      </Field>
    </FieldGroup>
  );
}

function ReviewStep({
  mode,
  patientLabel,
  doctor,
  departmentId,
  date,
  startTime,
  emergency,
  visitType,
  reason,
  notes,
  onEdit,
}: {
  mode: "staff" | "patient";
  patientLabel?: string;
  doctor?: Doctor;
  departmentId?: string;
  date: string;
  startTime?: string;
  emergency: boolean;
  visitType: VisitType;
  reason: string;
  notes: string;
  onEdit: (s: StepId) => void;
}) {
  const departments = useDepartments();
  const dept = departments.data?.find((d) => d.id === departmentId)?.name;
  const fee = doctor
    ? visitType === "FOLLOW_UP" && !emergency
      ? Math.round(doctor.consultationFee * 0.5)
      : doctor.consultationFee
    : undefined;
  const editBtn = (s: StepId, what: string) => (
    <Button variant="link" size="xs" className="h-auto px-0" onClick={() => onEdit(s)} aria-label={`Edit ${what}`}>
      Edit
    </Button>
  );
  return (
    <div className="space-y-4">
      <dl className="divide-y rounded-lg border">
        {mode === "staff" && (
          <ReviewRow label="Patient" action={editBtn("patient", "patient")}>
            {patientLabel ?? <Skeleton className="h-4 w-40" />}
          </ReviewRow>
        )}
        <ReviewRow label="Doctor" action={editBtn("doctor", "doctor")}>
          {doctor ? (
            <>
              {doctorName(doctor)}{" "}
              <span className="text-muted-foreground font-normal">
                · {doctor.specialisation}
                {dept ? ` · ${dept}` : ""}
              </span>
            </>
          ) : (
            <Skeleton className="h-4 w-40" />
          )}
        </ReviewRow>
        <ReviewRow label="When" action={editBtn("slot", "date and time")}>
          {emergency ? (
            <span className="inline-flex items-center gap-2">
              Today, now <StatusBadge status="EMERGENCY" label="Emergency" />
            </span>
          ) : (
            <span className="tabular-nums">
              {format(new Date(`${date}T00:00:00`), "EEEE, dd MMM yyyy")} · {formatTime(startTime)}
            </span>
          )}
        </ReviewRow>
        <ReviewRow label="Visit" action={editBtn("details", "visit details")}>
          {emergency ? "Emergency" : visitType === "FOLLOW_UP" ? "Follow-up" : "Consultation"}
          <p className="text-muted-foreground mt-0.5 font-normal break-words">{reason}</p>
          {notes && <p className="text-muted-foreground mt-0.5 text-xs font-normal break-words">Notes: {notes}</p>}
        </ReviewRow>
        <ReviewRow label={mode === "patient" ? "Fee (pay at the hospital)" : "Consultation fee"}>
          <span className="tabular-nums">{formatCurrency(fee)}</span>
        </ReviewRow>
      </dl>
      {mode === "patient" && (
        <Alert>
          <BadgeCheck aria-hidden />
          <AlertTitle>The hospital will confirm your request</AlertTitle>
          <AlertDescription>
            Your appointment stays pending until the front desk confirms it. You&apos;ll get a notification as soon as it&apos;s confirmed.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ReviewRow({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <dt className="text-muted-foreground w-28 shrink-0 text-xs sm:w-36">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm font-medium">{children}</dd>
      {action}
    </div>
  );
}

/* ================================ Summary ================================ */

function BookingSummary({
  mode,
  patientLabel,
  patientSub,
  doctor,
  date,
  startTime,
  emergency,
  visitType,
}: {
  mode: "staff" | "patient";
  patientLabel?: string;
  patientSub?: string;
  doctor?: Doctor;
  date: string;
  startTime?: string;
  emergency: boolean;
  visitType: VisitType;
}) {
  const rows: { icon: typeof UserRound; label: string; value?: React.ReactNode; sub?: React.ReactNode }[] = [
    ...(mode === "staff" ? [{ icon: UserRound, label: "Patient", value: patientLabel, sub: patientSub }] : []),
    { icon: Stethoscope, label: "Doctor", value: doctor ? doctorName(doctor) : undefined, sub: doctor?.specialisation },
    {
      icon: Clock,
      label: "When",
      value: emergency ? "Today, now" : startTime ? `${friendlyDate(date)}, ${formatTime(startTime)}` : undefined,
      sub: emergency ? "Emergency" : visitType === "FOLLOW_UP" ? "Follow-up" : "Consultation",
    },
  ];
  return (
    <aside aria-label="Booking summary" className="hidden lg:block">
      <Card className="sticky top-20 gap-3 p-4">
        <h2 className="text-sm font-semibold">Summary</h2>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.label} className="flex items-start gap-2.5 text-sm">
              <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md" aria-hidden>
                <r.icon className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs">{r.label}</p>
                <p className={cn("truncate font-medium tabular-nums", !r.value && "text-muted-foreground font-normal")}>
                  {r.value ?? "Not chosen"}
                </p>
                {r.value && r.sub && <p className="text-muted-foreground truncate text-xs">{r.sub}</p>}
              </div>
            </li>
          ))}
        </ul>
        {doctor && (
          <p className="text-muted-foreground border-t pt-3 text-xs">
            Fee <span className="text-foreground font-medium tabular-nums">{formatCurrency(doctor.consultationFee)}</span>
            {visitType === "FOLLOW_UP" && !emergency && " (follow-ups usually half)"}
          </p>
        )}
      </Card>
    </aside>
  );
}

/* ================================ Success ================================ */

function SuccessScreen({
  appt,
  mode,
  headingRef,
  onReset,
  className,
}: {
  appt: Appointment;
  mode: "staff" | "patient";
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onReset: () => void;
  className?: string;
}) {
  const pending = appt.status === "PENDING";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={className}>
      <Card className="mx-auto max-w-2xl gap-5 p-5 sm:p-6" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="bg-success/15 text-success flex size-12 items-center justify-center rounded-full" aria-hidden>
            <CheckCircle2 className="size-6" />
          </span>
          <div className="space-y-1">
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
              {pending ? "Appointment requested" : appt.isEmergency ? "Emergency appointment booked" : "Appointment booked"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {pending
                ? "The hospital will confirm your appointment shortly. We'll notify you once it's confirmed."
                : appt.isEmergency
                  ? "The doctor has been alerted."
                  : "The patient has been notified by SMS and email."}
            </p>
          </div>
        </div>
        <KeyValueGrid
          className="bg-muted/30 rounded-lg border p-4"
          items={[
            ...(mode === "staff" ? [{ label: "Patient", value: `${appt.patientName} · ${appt.patientMrn}` }] : []),
            { label: "Doctor", value: appt.doctorName },
            { label: "Department", value: appt.departmentName },
            {
              label: "Date & time",
              value: <span className="tabular-nums">{`${formatDate(appt.date)}, ${formatTime(appt.startTime)}`}</span>,
            },
            {
              label: "Type",
              value: appt.isEmergency ? (
                <StatusBadge status="EMERGENCY" label="Emergency" />
              ) : appt.type === "FOLLOW_UP" ? (
                "Follow-up"
              ) : (
                "Consultation"
              ),
            },
            { label: "Status", value: <StatusBadge status={appt.status} /> },
          ]}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={onReset}>
            Book another
          </Button>
          <Button asChild>
            <Link href={mode === "patient" ? ROUTES.portalAppointments : ROUTES.appointment(appt.id)}>
              {mode === "patient" ? "View my appointments" : "View appointment"} <ArrowRight />
            </Link>
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
