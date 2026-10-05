"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { USE_MOCK_API } from "@/constants/config";
import { useRealtime } from "@/hooks/use-realtime";
import { useSidebarStore } from "@/store/sidebar-store";
import { AppSidebar } from "./app-sidebar";
import { CommandSearch } from "./command-search";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const open = useSidebarStore((s) => s.open);
  const setOpen = useSidebarStore((s) => s.setOpen);
  useRealtime();

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="no-print bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur sm:px-4">
          <SidebarTrigger aria-label="Toggle sidebar" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-5" />
          <div className="min-w-0 flex-1">
            <CommandSearch />
          </div>
          {USE_MOCK_API && (
            <span className="hidden rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200 lg:inline dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
              Demo data
            </span>
          )}
          <NotificationBell />
          <UserMenu />
        </header>
        {/* SidebarInset already renders the <main> landmark. */}
        <div id="main" tabIndex={-1} className="mx-auto w-full max-w-[1600px] flex-1 p-4 outline-none sm:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
