"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ageGender, formatDate, fullName } from "@/lib/format";
import { usePatients } from "@/services/patients";
import type { Gender, Patient } from "@/types";

const PAGE_SIZE = 20;

export default function PatientsPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<Gender | "ALL">("ALL");
  const [page, setPage] = useState(1);

  const query = usePatients({ search, gender: gender === "ALL" ? undefined : gender, page, limit: PAGE_SIZE });

  const columns = useMemo<ColumnDef<Patient>[]>(
    () => [
      {
        id: "patient",
        header: "Patient",
        cell: ({ row }) => (
          <div className="flex min-w-48 items-center gap-2.5">
            <UserAvatar name={fullName(row.original)} className="size-7" />
            <div className="min-w-0">
              <Link
                href={ROUTES.patient(row.original.id)}
                className="block truncate font-medium hover:underline focus-visible:underline"
                onClick={(e) => e.stopPropagation()}
                tabIndex={-1}
              >
                {fullName(row.original)}
              </Link>
              <p className="text-muted-foreground font-mono text-xs">{row.original.mrn}</p>
            </div>
          </div>
        ),
      },
      {
        id: "ageGender",
        header: "Age / Gender",
        cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{ageGender(row.original.dob, row.original.gender)}</span>,
      },
      { id: "phone", header: "Phone", cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{row.original.phone}</span> },
      {
        id: "blood",
        header: "Blood",
        cell: ({ row }) =>
          row.original.bloodGroup ? (
            <span className="font-medium">{row.original.bloodGroup}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "allergies",
        header: "Allergies",
        cell: ({ row }) => {
          const a = row.original.allergies;
          if (!a.length) return <span className="text-muted-foreground">None known</span>;
          const severe = a.some((x) => x.severity === "SEVERE");
          return (
            <span title={a.map((x) => x.substance).join(", ")}>
              <StatusBadge
                status="ALLERGY"
                tone={severe ? "danger" : "warning"}
                dot={false}
                label={`${a.length} ${a.length === 1 ? "allergy" : "allergies"}${severe ? " · severe" : ""}`}
                className="gap-1"
              />
              <span className="sr-only">: {a.map((x) => x.substance).join(", ")}</span>
            </span>
          );
        },
      },
      {
        id: "registered",
        header: "Registered",
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap tabular-nums">{formatDate(row.original.createdAt)}</span>
        ),
      },
    ],
    [],
  );

  const filtered = !!search || gender !== "ALL";

  return (
    <div>
      <PageHeader
        title="Patients"
        description="Search the hospital's patient register by name, MRN or phone."
        actions={
          can("patients:write") && (
            <Button asChild>
              <Link href={ROUTES.patientNew}>
                <UserPlus /> Register patient
              </Link>
            </Button>
          )
        }
      />
      <DataTable
        caption="Patients"
        columns={columns}
        data={query.data?.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        rowHref={(p) => ROUTES.patient(p.id)}
        getRowId={(p) => p.id}
        toolbar={
          <>
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search name, MRN or phone"
              aria-label="Search patients"
            />
            <Select
              value={gender}
              onValueChange={(v) => {
                setGender(v as Gender | "ALL");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by gender">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All genders</SelectItem>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        emptyState={
          <EmptyState
            icon={Users}
            title={filtered ? "No patients match" : "No patients yet"}
            description={filtered ? "Try a different name, MRN or phone number." : "Registered patients will appear here."}
            action={
              !filtered && can("patients:write") ? (
                <Button asChild size="sm">
                  <Link href={ROUTES.patientNew}>
                    <UserPlus /> Register patient
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
