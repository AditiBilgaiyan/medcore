"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Stethoscope } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { navForRole } from "@/constants/navigation";
import { ROLE_LABELS } from "@/constants/roles";
import { ROUTES, homeForRole } from "@/constants/routes";
import { useNotificationStore } from "@/store/notification-store";
import { useAuthStore } from "@/store/auth-store";

function isActive(pathname: string, href: string, allHrefs: string[]) {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // Prefer the most specific nav item (e.g. /lab/tests over /lab).
  return !allHrefs.some((h) => h !== href && h.startsWith(`${href}/`) && (pathname === h || pathname.startsWith(`${h}/`)));
}

export function AppSidebar() {
  const user = useAuthStore((s) => s.user);
  const unread = useNotificationStore((s) => s.unreadCount);
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  if (!user) return null;
  const sections = navForRole(user.role);
  const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href));

  return (
    <Sidebar collapsible="icon" className="no-print">
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="MedCore HMS">
              <Link href={homeForRole(user.role)}>
                <span className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Stethoscope className="size-4" aria-hidden />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="font-heading truncate text-sm font-semibold">MedCore HMS</span>
                  <span className="text-muted-foreground truncate text-xs">{user.hospitalName ?? "Platform"}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href, allHrefs);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)}>
                          <item.icon aria-hidden />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.href === ROUTES.notifications && unread > 0 && (
                        <SidebarMenuBadge className="bg-primary text-primary-foreground">
                          {unread > 99 ? "99+" : unread}
                          <span className="sr-only"> unread</span>
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <p className="text-muted-foreground truncate px-2 text-xs group-data-[collapsible=icon]:hidden">
          Signed in as <span className="text-foreground font-medium">{ROLE_LABELS[user.role]}</span>
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
