"use client";

import { Building, Hourglass, Loader2, Stethoscope, UserRound, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { KeyValueGrid, SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HOSPITAL_TYPE_LABEL, PLANS, PLAN_BY_VALUE } from "@/components/modules/admin/constants";
import { HospitalStatusActions } from "@/components/modules/admin/hospital-status-actions";
import { ROUTES } from "@/constants/routes";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { useHospital, useUpdateHospital } from "@/services/admin";
import type { SubscriptionPlan } from "@/types";

export default function HospitalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: h, isLoading, error, refetch } = useHospital(id);
  const updateHospital = useUpdateHospital();

  if (isLoading) return <DetailSkeleton />;
  if (error || !h) {
    return (
      <div className="space-y-5">
        <PageHeader title="Hospital" breadcrumbs={[{ label: "Hospitals", href: ROUTES.hospitals }, { label: "Hospital" }]} />
        <ErrorState error={error ?? new Error("Hospital not found")} onRetry={() => void refetch()} />
      </div>
    );
  }

  const plan = PLAN_BY_VALUE[h.plan];
  const admin = h.stats.admin;

  const changePlan = async (value: string) => {
    if (value === h.plan) return;
    try {
      await updateHospital.mutateAsync({ id: h.id, plan: value as SubscriptionPlan });
      toast.success(`${h.name} moved to the ${PLAN_BY_VALUE[value as SubscriptionPlan].name} plan`);
    } catch {
      /* toast from the mutation cache */
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {h.name}
            <StatusBadge status={h.status} />
          </span>
        }
        description={
          <>
            <span className="font-mono">{h.code}</span> · {HOSPITAL_TYPE_LABEL[h.type]} · {h.address.city}, {h.address.state}
          </>
        }
        breadcrumbs={[{ label: "Hospitals", href: ROUTES.hospitals }, { label: h.name }]}
        actions={<HospitalStatusActions hospital={h} />}
      />

      {h.status === "PENDING_VERIFICATION" && (
        <div
          role="status"
          className="border-warning/40 bg-warning/10 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium">Pending verification</p>
              <p className="text-muted-foreground text-sm">
                Check registration number <span className="font-mono">{h.registrationNumber}</span>, then verify to activate the tenant.
                Staff can&apos;t sign in until then.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <HospitalStatusActions hospital={h} />
          </div>
        </div>
      )}
      {h.status === "SUSPENDED" && (
        <div role="status" className="border-destructive/30 bg-destructive/5 rounded-xl border p-4 text-sm">
          <p className="text-destructive font-medium">Suspended</p>
          <p className="text-muted-foreground">Staff and patients of this hospital can&apos;t sign in. Reactivate to restore access.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Departments" value={formatNumber(h.stats.departments)} icon={Building} />
        <StatCard label="Doctors" value={formatNumber(h.stats.doctors)} icon={Stethoscope} tone="success" />
        <StatCard label="Staff" value={formatNumber(h.stats.staff)} icon={Users} tone="neutral" />
        <StatCard label="Patients" value={formatNumber(h.stats.patients)} icon={UserRound} tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Profile">
            <KeyValueGrid
              columns={3}
              items={[
                { label: "Type", value: HOSPITAL_TYPE_LABEL[h.type] },
                { label: "Registration no.", value: <span className="font-mono">{h.registrationNumber}</span> },
                { label: "Beds", value: <span className="tabular-nums">{formatNumber(h.bedCount)}</span> },
                {
                  label: "Email",
                  value: (
                    <a href={`mailto:${h.email}`} className="text-primary underline-offset-4 hover:underline">
                      {h.email}
                    </a>
                  ),
                },
                {
                  label: "Phone",
                  value: (
                    <a href={`tel:${h.phone}`} className="tabular-nums">
                      {h.phone}
                    </a>
                  ),
                },
                { label: "Tenant code", value: <span className="font-mono">{h.code}</span> },
                { label: "Onboarded", value: formatDateTime(h.createdAt) },
                { label: "Verified", value: h.verifiedAt ? formatDateTime(h.verifiedAt) : "Not yet" },
              ]}
            />
          </SectionCard>
          <SectionCard title="Address">
            <address className="text-sm not-italic">
              {h.address.line1}
              {h.address.line2 && <>, {h.address.line2}</>}
              <br />
              {h.address.city}, {h.address.state} {h.address.postalCode}
              <br />
              {h.address.country}
            </address>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Subscription" description="Billed monthly per hospital." contentClassName="space-y-3">
            <div>
              <p className="font-heading text-lg font-semibold">{plan?.name ?? h.plan}</p>
              <p className="text-muted-foreground text-sm tabular-nums">{plan ? `${formatCurrency(plan.price)} / month` : ""}</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="plan-select" className="text-muted-foreground text-xs font-medium">
                Change plan
              </label>
              <div className="flex items-center gap-2">
                <Select value={h.plan} onValueChange={changePlan} disabled={updateHospital.isPending}>
                  <SelectTrigger id="plan-select" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.name} · {formatCurrency(p.price)}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {updateHospital.isPending && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Saving" />}
              </div>
            </div>
            {plan && (
              <ul className="text-muted-foreground space-y-1 text-xs">
                {plan.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Hospital Admin">
            {admin ? (
              <div className="flex items-start gap-3">
                <UserAvatar name={`${admin.firstName} ${admin.lastName}`} src={admin.avatarUrl} className="size-9" />
                <div className="min-w-0 space-y-0.5 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {admin.firstName} {admin.lastName}
                    <StatusBadge status={admin.status} />
                  </p>
                  <p className="text-muted-foreground truncate">{admin.email}</p>
                  <p className="text-muted-foreground tabular-nums">{admin.phone}</p>
                  <p className="text-muted-foreground text-xs">
                    {admin.lastLoginAt
                      ? `Last sign-in ${formatRelative(admin.lastLoginAt)}`
                      : `Invited ${formatDate(admin.createdAt)} · never signed in`}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState compact icon={UserRound} title="No admin account" description="This hospital has no Hospital Admin yet." />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
