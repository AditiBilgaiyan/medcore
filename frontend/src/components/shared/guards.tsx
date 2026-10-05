"use client";

import { ShieldX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { hasPermission, type Permission } from "@/constants/permissions";
import { homeForRole, ROUTE_ACCESS, ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth-store";
import type { Role } from "@/types";
import { FullPageLoader } from "./states";

export function canAccessPath(role: Role, pathname: string): boolean {
  const rule = ROUTE_ACCESS.filter((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)).sort(
    (a, b) => b.prefix.length - a.prefix.length,
  )[0];
  if (!rule) return role !== "PATIENT" || pathname === ROUTES.notifications;
  if (rule.roles && !rule.roles.includes(role)) return false;
  if (rule.permission && !hasPermission(role, rule.permission)) return false;
  return true;
}

/**
 * Client-side route guard. The API enforces access on every request; this only
 * keeps users out of screens they can't use and handles session expiry.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated" || !user) return <FullPageLoader />;
  if (!canAccessPath(user.role, pathname)) return <AccessDenied home={homeForRole(user.role)} />;
  return <>{children}</>;
}

export function AccessDenied({ home }: { home: string }) {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300">
        <ShieldX className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">You don&apos;t have access to this page</h1>
        <p className="text-muted-foreground text-sm">
          Your role doesn&apos;t include this area. Ask your hospital admin if you need access.
        </p>
      </div>
      <Button asChild>
        <Link href={home}>Go to my dashboard</Link>
      </Button>
    </div>
  );
}

/** Render children only when the current user has the permission (or one of the roles). */
export function Can({
  permission,
  roles,
  children,
  fallback = null,
}: {
  permission?: Permission;
  roles?: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const role = useAuthStore((s) => s.user?.role);
  const allowed = !!role && (!permission || hasPermission(role, permission)) && (!roles || roles.includes(role));
  return <>{allowed ? children : fallback}</>;
}
