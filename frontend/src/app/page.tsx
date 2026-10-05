"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullPageLoader } from "@/components/shared/states";
import { homeForRole, ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth-store";

export default function RootPage() {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.user?.role);
  const router = useRouter();
  useEffect(() => {
    if (status === "authenticated" && role) router.replace(homeForRole(role));
    if (status === "unauthenticated") router.replace(ROUTES.login);
  }, [status, role, router]);
  return <FullPageLoader />;
}
