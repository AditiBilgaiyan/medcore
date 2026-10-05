"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission, type Permission } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useLogout } from "@/services/auth";
import { useAuthStore } from "@/store/auth-store";
import { useNotificationStore } from "@/store/notification-store";

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const logoutMutation = useLogout();
  const qc = useQueryClient();
  const router = useRouter();

  const can = useCallback((permission: Permission) => hasPermission(user?.role, permission), [user?.role]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync().catch(() => undefined);
    qc.clear();
    useNotificationStore.getState().reset();
    router.replace(ROUTES.login);
  }, [logoutMutation, qc, router]);

  return {
    user,
    status,
    role: user?.role,
    isAuthenticated: status === "authenticated",
    can,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };
}
