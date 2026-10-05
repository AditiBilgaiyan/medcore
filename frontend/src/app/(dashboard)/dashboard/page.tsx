"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CardsSkeleton } from "@/components/shared/states";
import { AccountantDashboard } from "@/components/modules/dashboard/accountant-dashboard";
import { AdminDashboard } from "@/components/modules/dashboard/admin-dashboard";
import { DoctorDashboard } from "@/components/modules/dashboard/doctor-dashboard";
import { LabDashboard } from "@/components/modules/dashboard/lab-dashboard";
import { NurseDashboard } from "@/components/modules/dashboard/nurse-dashboard";
import { PharmacistDashboard } from "@/components/modules/dashboard/pharmacist-dashboard";
import { ReceptionistDashboard } from "@/components/modules/dashboard/receptionist-dashboard";
import { SuperAdminDashboard } from "@/components/modules/dashboard/super-admin-dashboard";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import type { Role } from "@/types";

const DASHBOARDS: Record<Exclude<Role, "PATIENT">, React.ComponentType> = {
  SUPER_ADMIN: SuperAdminDashboard,
  HOSPITAL_ADMIN: AdminDashboard,
  DOCTOR: DoctorDashboard,
  NURSE: NurseDashboard,
  RECEPTIONIST: ReceptionistDashboard,
  LAB_TECHNICIAN: LabDashboard,
  PHARMACIST: PharmacistDashboard,
  ACCOUNTANT: AccountantDashboard,
};

export default function DashboardPage() {
  const { role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (role === "PATIENT") router.replace(ROUTES.portal);
  }, [role, router]);

  if (!role || role === "PATIENT") return <CardsSkeleton />;
  const Dashboard = DASHBOARDS[role];

  return (
    <motion.div key={role} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Dashboard />
    </motion.div>
  );
}
