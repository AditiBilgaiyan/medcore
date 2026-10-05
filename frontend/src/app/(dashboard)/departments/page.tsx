"use client";

import { motion } from "framer-motion";
import { BedDouble, Building, MoreHorizontal, Pencil, Plus, Stethoscope, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard } from "@/components/shared/stat-card";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { DepartmentDialog } from "@/components/modules/admin/department-dialog";
import { useAuth } from "@/hooks/use-auth";
import { doctorName, formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDeleteDepartment, useDepartments } from "@/services/admin";
import { useDoctors } from "@/services/doctors";
import type { Department, Doctor } from "@/types";

export default function DepartmentsPage() {
  const { can } = useAuth();
  const manage = can("departments:manage");
  const { data: departments, isLoading, error, refetch } = useDepartments();
  const { data: doctorPage } = useDoctors({ limit: 200 });
  const doctors = useMemo(() => doctorPage?.data ?? [], [doctorPage]);
  const del = useDeleteDepartment();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Department | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Department | undefined>();

  const doctorById = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (departments ?? []).filter((d) => !q || d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q));
  }, [departments, search]);

  const totals = useMemo(() => {
    const deps = departments ?? [];
    const beds = deps.reduce((s, d) => s + d.totalBeds, 0);
    const occupied = deps.reduce((s, d) => s + d.occupiedBeds, 0);
    return { count: deps.length, beds, occupied, rate: beds ? occupied / beds : 0 };
  }, [departments]);

  const openCreate = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };
  const openEdit = (d: Department) => {
    setEditing(d);
    setDialogOpen(true);
  };

  const deletingDoctors = deleting ? doctors.filter((d) => d.departmentIds.includes(deleting.id)).length : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Departments"
        description="Clinical departments, bed capacity, consultation fees and heads of department."
        actions={
          manage ? (
            <Button onClick={openCreate}>
              <Plus /> New department
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <CardsSkeleton />
      ) : (
        departments && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Departments" value={formatNumber(totals.count)} icon={Building} />
            <StatCard label="Doctors" value={formatNumber(doctors.length)} icon={Stethoscope} tone="success" />
            <StatCard
              label="Beds"
              value={formatNumber(totals.beds)}
              icon={BedDouble}
              tone="neutral"
              hint={`${formatNumber(totals.occupied)} occupied`}
            />
            <StatCard
              label="Occupancy"
              value={formatPercent(totals.rate)}
              icon={BedDouble}
              tone={totals.rate >= 0.9 ? "danger" : totals.rate >= 0.75 ? "warning" : "success"}
              hint={totals.rate >= 0.9 ? "Near capacity" : undefined}
            />
          </div>
        )
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Search departments" delay={150} />
        {departments && (
          <p className="text-muted-foreground text-xs tabular-nums">
            {list.length} of {departments.length} departments
          </p>
        )}
      </div>

      {error && !departments ? (
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Card>
      ) : isLoading ? (
        <CardsSkeleton count={6} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building}
            title={search ? "No departments match your search" : "No departments yet"}
            description={search ? "Try a different name or code." : "Create departments so doctors can be assigned and patients can book."}
            action={
              !search && manage ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus /> New department
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d, i) => (
            <motion.li
              key={d.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: Math.min(i, 8) * 0.02 }}
            >
              <DepartmentCard
                department={d}
                head={d.headDoctorId ? doctorById.get(d.headDoctorId) : undefined}
                doctorCount={doctors.filter((doc) => doc.departmentIds.includes(d.id)).length}
                manage={manage}
                onEdit={() => openEdit(d)}
                onDelete={() => setDeleting(d)}
              />
            </motion.li>
          ))}
        </ul>
      )}

      {manage && <DepartmentDialog open={dialogOpen} onOpenChange={setDialogOpen} department={editing} doctors={doctors} />}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(undefined)}
        title={`Delete ${deleting?.name ?? "department"}?`}
        description={
          deletingDoctors > 0
            ? `${deletingDoctors} doctor${deletingDoctors === 1 ? " is" : "s are"} assigned to this department. Reassign them before deleting it.`
            : "The department is removed from booking and reports. This can't be undone."
        }
        confirmLabel="Delete department"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await del.mutateAsync(deleting.id);
          toast.success(`${deleting.name} deleted`);
        }}
      />
    </div>
  );
}

function DepartmentCard({
  department: d,
  head,
  doctorCount,
  manage,
  onEdit,
  onDelete,
}: {
  department: Department;
  head?: Doctor;
  doctorCount: number;
  manage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const rate = d.totalBeds ? d.occupiedBeds / d.totalBeds : 0;
  return (
    <Card className="h-full gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-heading truncate text-base font-semibold">{d.name}</h2>
            <Badge variant="outline" className="font-mono">
              {d.code}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 min-h-10 text-sm">{d.description || "No description."}</p>
        </div>
        {manage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">Beds occupied</span>
          <span className="tabular-nums">
            <span className="font-medium">{d.occupiedBeds}</span> / {d.totalBeds}
            {d.totalBeds > 0 && <span className="text-muted-foreground"> · {formatPercent(rate)}</span>}
          </span>
        </div>
        <Progress
          value={Math.min(rate * 100, 100)}
          aria-label={`${d.name} bed occupancy`}
          aria-valuetext={`${d.occupiedBeds} of ${d.totalBeds} beds occupied`}
          className={cn("h-1.5", rate >= 0.9 && "[&>[data-slot=progress-indicator]]:bg-destructive")}
        />
        {d.totalBeds === 0 && <p className="text-muted-foreground text-xs">Outpatient only — no beds.</p>}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 border-t pt-3 text-sm">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Head of department</p>
          {head ? (
            <p className="mt-1 flex items-center gap-1.5">
              <UserAvatar name={`${head.firstName} ${head.lastName}`} className="size-6" />
              <span className="truncate font-medium">{doctorName(head)}</span>
            </p>
          ) : (
            <p className="text-muted-foreground mt-1">Not assigned</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-muted-foreground flex items-center justify-end gap-1 text-xs">
            <Wallet className="size-3" aria-hidden /> Consultation
          </p>
          <p className="mt-1 font-medium tabular-nums">{formatCurrency(d.consultationFee)}</p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {doctorCount} doctor{doctorCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </Card>
  );
}
