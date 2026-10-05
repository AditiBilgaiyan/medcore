"use client";

import { Briefcase, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AcceptingBadge, DoctorLanguages, DoctorRating } from "@/components/modules/doctors/doctor-bits";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/constants/routes";
import { doctorName, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDepartments } from "@/services/admin";
import { useDoctors } from "@/services/doctors";
import type { Department, Doctor } from "@/types";

const ALL = "all";

export default function DoctorsPage() {
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [specialisation, setSpecialisation] = useState("");

  const departments = useDepartments();
  const all = useDoctors();
  const doctors = useDoctors({
    search: search || undefined,
    departmentId: departmentId || undefined,
    specialisation: specialisation || undefined,
  });

  const specialisations = useMemo(
    () => [...new Set((all.data?.data ?? []).map((d) => d.specialisation))].sort((a, b) => a.localeCompare(b)),
    [all.data],
  );
  const filtersActive = !!(search || departmentId || specialisation);
  const clear = () => {
    setSearch("");
    setDepartmentId("");
    setSpecialisation("");
  };

  return (
    <>
      <PageHeader
        title="Doctors"
        description={
          doctors.data ? (
            <span className="tabular-nums">
              {doctors.data.meta.total} doctor{doctors.data.meta.total === 1 ? "" : "s"}
              {filtersActive ? " match" : " on staff"}
            </span>
          ) : (
            "Directory of consultants and their availability."
          )
        }
      />

      <div className="bg-card mb-4 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or specialty…" />
        <Select value={departmentId || ALL} onValueChange={(v) => setDepartmentId(v === ALL ? "" : v)}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Department">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {departments.data?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={specialisation || ALL} onValueChange={(v) => setSpecialisation(v === ALL ? "" : v)}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Specialisation">
            <SelectValue placeholder="All specialisations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All specialisations</SelectItem>
            {specialisations.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="ghost" onClick={clear}>
            Clear filters
          </Button>
        )}
      </div>

      {doctors.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : doctors.error && !doctors.data ? (
        <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} className="bg-card rounded-xl border" />
      ) : !doctors.data?.data.length ? (
        <div className="bg-card rounded-xl border">
          <EmptyState
            icon={Stethoscope}
            title="No doctors found"
            description={filtersActive ? "Try a different name, department or specialisation." : "No doctors have been added yet."}
            action={
              filtersActive ? (
                <Button variant="outline" size="sm" onClick={clear}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul
          className={cn("grid gap-3 transition-opacity sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", doctors.isFetching && "opacity-70")}
        >
          {doctors.data.data.map((d) => (
            <li key={d.id}>
              <DoctorCard doctor={d} departments={departments.data} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DoctorCard({ doctor, departments }: { doctor: Doctor; departments?: Department[] }) {
  const name = doctorName(doctor);
  const depts = doctor.departmentIds.map((id) => departments?.find((d) => d.id === id)?.name).filter(Boolean);
  return (
    <Card className="hover:border-primary/40 hover:bg-accent/30 relative h-full gap-3 p-4 transition-colors">
      <div className="flex items-start gap-3">
        <UserAvatar name={name} className="size-12" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">
            <Link
              href={ROUTES.doctor(doctor.id)}
              className="focus-visible:after:ring-ring/50 after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-3"
            >
              {name}
            </Link>
          </h2>
          <p className="text-primary truncate text-sm">{doctor.specialisation}</p>
          <p className="text-muted-foreground truncate text-xs">{doctor.qualification}</p>
        </div>
      </div>
      {depts.length > 0 && <p className="text-muted-foreground truncate text-xs">{depts.join(" · ")}</p>}
      <dl className="bg-muted/40 grid grid-cols-3 gap-2 rounded-lg px-3 py-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Experience</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1 font-medium tabular-nums">
            <Briefcase className="text-muted-foreground size-3" aria-hidden />
            {doctor.experienceYears} yrs
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fee</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{formatCurrency(doctor.consultationFee)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rating</dt>
          <dd className="mt-0.5">
            <DoctorRating rating={doctor.rating} />
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-2 text-xs">
        <DoctorLanguages languages={doctor.languages} />
        <AcceptingBadge doctor={doctor} />
      </div>
    </Card>
  );
}
