"use client";

import { CalendarDays, IndianRupee, Users } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeFilter, lastNDays, type DateRange } from "@/components/shared/date-range-filter";
import { PageHeader } from "@/components/shared/page-header";
import { AppointmentsSection } from "@/components/modules/analytics/appointments-section";
import { PatientsSection } from "@/components/modules/analytics/patients-section";
import { RevenueSection } from "@/components/modules/analytics/revenue-section";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useHospitals } from "@/services/admin";
import type { DateRangeQuery } from "@/types";

const ALL = "all";

export default function AnalyticsPage() {
  const { role, user } = useAuth();
  const isSuperAdmin = role === "SUPER_ADMIN";
  const [range, setRange] = useState<DateRange>(() => lastNDays(30));
  const [hospitalId, setHospitalId] = useState<string>(ALL);
  const [tab, setTab] = useState("revenue");
  const query: DateRangeQuery = { ...range, hospitalId: isSuperAdmin && hospitalId !== ALL ? hospitalId : undefined };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        description={
          <>
            {isSuperAdmin ? "Platform and per-hospital performance" : `Performance for ${user?.hospitalName ?? "your hospital"}`} ·{" "}
            <span className="tabular-nums">
              {formatDate(range.from)} – {formatDate(range.to)}
            </span>
          </>
        }
        className="pb-0"
      />
      <div className="bg-card flex flex-col gap-3 rounded-xl border p-3 lg:flex-row lg:items-center lg:justify-between">
        <DateRangeFilter value={range} onChange={setRange} />
        {isSuperAdmin && <HospitalPicker value={hospitalId} onChange={setHospitalId} />}
      </div>
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList aria-label="Analytics sections" className="w-full sm:w-fit">
          <TabsTrigger value="revenue">
            <IndianRupee aria-hidden /> Revenue
          </TabsTrigger>
          <TabsTrigger value="appointments">
            <CalendarDays aria-hidden /> Appointments
          </TabsTrigger>
          <TabsTrigger value="patients">
            <Users aria-hidden /> Patients
          </TabsTrigger>
        </TabsList>
        <TabsContent value="revenue">
          <RevenueSection query={query} />
        </TabsContent>
        <TabsContent value="appointments">
          <AppointmentsSection query={query} />
        </TabsContent>
        <TabsContent value="patients">
          <PatientsSection query={query} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HospitalPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data, isLoading } = useHospitals({ limit: 100 });
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="analytics-hospital" className="text-muted-foreground shrink-0 text-xs">
        Hospital
      </Label>
      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger id="analytics-hospital" className="w-full sm:w-64">
          <SelectValue placeholder={isLoading ? "Loading hospitals…" : "All hospitals"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All hospitals (platform)</SelectItem>
          {data?.data.map((h) => (
            <SelectItem key={h.id} value={h.id}>
              {h.name}
              {h.status !== "ACTIVE" ? ` (${h.status === "SUSPENDED" ? "suspended" : "pending"})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
