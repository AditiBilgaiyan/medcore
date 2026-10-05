"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { doctorName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { applyServerErrors } from "@/lib/validation";
import { useCreateDepartment, useUpdateDepartment } from "@/services/admin";
import type { Department, Doctor } from "@/types";

const NO_HEAD = "none";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the department name").max(80),
  code: z
    .string()
    .trim()
    .min(2, "Use 2–8 characters")
    .max(8, "Use 2–8 characters")
    .regex(/^[A-Z0-9-]+$/, "Letters, numbers and hyphens only"),
  description: z.string().trim().max(300, "Keep it under 300 characters"),
  totalBeds: z
    .number({ invalid_type_error: "Enter the number of beds (0 if none)" })
    .int("Whole numbers only")
    .min(0, "Can't be negative")
    .max(5000),
  consultationFee: z.number({ invalid_type_error: "Enter the fee (0 if free)" }).min(0, "Can't be negative").max(100_000),
  headDoctorId: z.string(),
});

type Values = z.infer<typeof schema>;

function toValues(d?: Department): Values {
  return {
    name: d?.name ?? "",
    code: d?.code ?? "",
    description: d?.description ?? "",
    totalBeds: d?.totalBeds ?? 0,
    consultationFee: d?.consultationFee ?? 500,
    headDoctorId: d?.headDoctorId ?? NO_HEAD,
  };
}

export function DepartmentDialog({
  open,
  onOpenChange,
  department,
  doctors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  department?: Department;
  doctors: Doctor[];
}) {
  const editing = !!department;
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const pending = create.isPending || update.isPending;
  const { register, control, handleSubmit, reset, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(department),
  });
  const errors = formState.errors;

  // Reset only when the dialog opens (or switches department) — not on background refetches.
  useEffect(() => {
    if (open) reset(toValues(department));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, department?.id]);

  const inDept = department ? doctors.filter((d) => d.departmentIds.includes(department.id)) : [];
  const others = department ? doctors.filter((d) => !d.departmentIds.includes(department.id)) : doctors;

  const onSubmit = handleSubmit(async (v) => {
    const head = v.headDoctorId === NO_HEAD ? undefined : v.headDoctorId;
    if (department && v.totalBeds < department.occupiedBeds) {
      setError(
        "totalBeds",
        { type: "validate", message: `${department.occupiedBeds} beds are occupied — discharge or transfer patients first.` },
        { shouldFocus: true },
      );
      return;
    }
    try {
      if (department) {
        await update.mutateAsync({
          id: department.id,
          name: v.name,
          description: v.description,
          totalBeds: v.totalBeds,
          consultationFee: v.consultationFee,
          // An empty string clears the head of department on the server.
          headDoctorId: head ?? "",
        });
        toast.success(`${v.name} updated`);
      } else {
        await create.mutateAsync({ ...v, code: v.code.toUpperCase(), headDoctorId: head });
        toast.success(`${v.name} department created`);
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "DUPLICATE_CODE")
          setError("code", { type: "server", message: "Another department already uses this code." }, { shouldFocus: true });
        else applyServerErrors<Values>(err.details, setError);
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${department.name}` : "New department"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update details, bed capacity, fee and head of department."
                : "Departments organise doctors, wards and appointment booking."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_8rem]">
            <Field data-invalid={!!errors.name || undefined}>
              <FieldLabel htmlFor="dep-name">Name</FieldLabel>
              <Input
                id="dep-name"
                autoFocus
                placeholder="e.g. Cardiology"
                aria-invalid={!!errors.name || undefined}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.code || undefined}>
              <FieldLabel htmlFor="dep-code">Code</FieldLabel>
              <Input
                id="dep-code"
                placeholder="CARD"
                className={cn("font-mono uppercase", editing && "bg-muted text-muted-foreground")}
                readOnly={editing}
                aria-readonly={editing || undefined}
                aria-invalid={!!errors.code || undefined}
                {...register("code", { setValueAs: (v: string) => v.toUpperCase().trim() })}
              />
              {editing && <FieldDescription className="text-xs">Codes can&apos;t be changed.</FieldDescription>}
              <FieldError errors={[errors.code]} />
            </Field>
            <Field data-invalid={!!errors.description || undefined} className="sm:col-span-2">
              <FieldLabel htmlFor="dep-desc">Description</FieldLabel>
              <Textarea id="dep-desc" rows={2} placeholder="What the department treats" {...register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>
          </FieldGroup>
          <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
            <Field data-invalid={!!errors.totalBeds || undefined}>
              <FieldLabel htmlFor="dep-beds">Total beds</FieldLabel>
              <Input
                id="dep-beds"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                className="tabular-nums"
                aria-invalid={!!errors.totalBeds || undefined}
                {...register("totalBeds", { valueAsNumber: true })}
              />
              {editing && department.occupiedBeds > 0 && (
                <FieldDescription className="text-xs">{department.occupiedBeds} currently occupied.</FieldDescription>
              )}
              <FieldError errors={[errors.totalBeds]} />
            </Field>
            <Field data-invalid={!!errors.consultationFee || undefined}>
              <FieldLabel htmlFor="dep-fee">Consultation fee (₹)</FieldLabel>
              <Input
                id="dep-fee"
                type="number"
                inputMode="decimal"
                min={0}
                step="1"
                className="tabular-nums"
                aria-invalid={!!errors.consultationFee || undefined}
                {...register("consultationFee", { valueAsNumber: true })}
              />
              <FieldError errors={[errors.consultationFee]} />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="dep-head">Head of department</FieldLabel>
              <Controller
                control={control}
                name="headDoctorId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="dep-head" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NO_HEAD}>No head assigned</SelectItem>
                      {inDept.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>In this department</SelectLabel>
                          {inDept.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {doctorName(d)} · {d.specialisation}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {others.length > 0 && (
                        <SelectGroup>
                          {editing && <SelectLabel>Other doctors</SelectLabel>}
                          {others.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {doctorName(d)} · {d.specialisation}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Create department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
