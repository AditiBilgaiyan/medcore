"use client";

import {
  AlertTriangle,
  Bell,
  CalendarCheck2,
  CalendarClock,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FlaskConical,
  Loader2,
  PackageX,
  Pill,
  Receipt,
  Siren,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCount } from "@/services/misc";
import type { Notification, NotificationType } from "@/types";

const PAGE_SIZE = 20;

const TYPE_META: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  APPOINTMENT_CONFIRMED: { icon: CalendarCheck2, className: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
  APPOINTMENT_REMINDER: { icon: CalendarClock, className: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
  LAB_REPORT_APPROVED: { icon: FlaskConical, className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  PRESCRIPTION_READY: { icon: Pill, className: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
  INVOICE_GENERATED: { icon: Receipt, className: "bg-muted text-muted-foreground" },
  PAYMENT_RECEIVED: { icon: CreditCard, className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  LOW_STOCK_ALERT: { icon: PackageX, className: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" },
  EMERGENCY_APPOINTMENT: { icon: Siren, className: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" },
  EXPIRY_ALERT: { icon: AlertTriangle, className: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" },
  GENERAL: { icon: Bell, className: "bg-muted text-muted-foreground" },
};

type Filter = "all" | "unread";

export default function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error, refetch } = useNotifications({
    page,
    limit: PAGE_SIZE,
    unread: filter === "unread" || undefined,
  });
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const router = useRouter();
  const unreadCount = unread.data?.count ?? 0;
  const list = data?.data ?? [];
  // The API clamps out-of-range pages, so always paginate from the page it returned.
  const meta = data?.meta;

  const open = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Notifications"
        description={unread.isLoading ? "Loading…" : unreadCount ? `${formatNumber(unreadCount)} unread` : "You're all caught up"}
        actions={
          <Button
            variant="outline"
            onClick={() =>
              markAll.mutate(undefined, {
                onSuccess: () => {
                  toast.success("All notifications marked as read");
                  if (filter === "unread") setPage(1);
                },
              })
            }
            disabled={!unreadCount || markAll.isPending}
          >
            {markAll.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCheck aria-hidden />}
            Mark all read
          </Button>
        }
        className="pb-0"
      />
      <Tabs
        value={filter}
        onValueChange={(v) => {
          setFilter(v as Filter);
          setPage(1);
        }}
      >
        <TabsList aria-label="Filter notifications">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 text-[10px] font-semibold tabular-nums">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Card
        className={cn("gap-0 overflow-hidden py-0 transition-opacity", isFetching && !isLoading && "opacity-70")}
        aria-busy={isFetching}
      >
        {isLoading ? (
          <ul className="divide-y" aria-label="Loading notifications">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex gap-3 p-4">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </li>
            ))}
          </ul>
        ) : error && !data ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
            description={
              filter === "unread" ? "You've read everything." : "Updates about appointments, reports and payments will appear here."
            }
          />
        ) : (
          <ul className="divide-y">
            {list.map((n) => {
              const typeMeta = TYPE_META[n.type] ?? TYPE_META.GENERAL;
              const Icon = typeMeta.icon;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      "hover:bg-accent/50 focus-visible:outline-ring flex w-full cursor-pointer items-start gap-3 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                      !n.readAt && "bg-accent/25",
                    )}
                  >
                    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", typeMeta.className)} aria-hidden>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate text-sm", n.readAt ? "font-medium" : "font-semibold")}>{n.title}</span>
                        {!n.readAt && (
                          <span className="bg-primary/10 text-primary inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            <span className="bg-primary size-1.5 rounded-full" aria-hidden />
                            New
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-sm">{n.body}</span>
                      <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                        <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>
                          {formatRelative(n.createdAt)}
                        </time>
                        {n.link && <span className="text-primary font-medium">Open</span>}
                        {!n.link && !n.readAt && <span>Click to mark as read</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {meta && meta.total > 0 && (
          <nav
            aria-label="Notifications pagination"
            className="flex flex-col items-center justify-between gap-2 border-t px-4 py-2 text-sm sm:flex-row"
          >
            <p className="text-muted-foreground tabular-nums">
              {formatNumber((meta.page - 1) * meta.limit + 1)}–{formatNumber(Math.min(meta.page * meta.limit, meta.total))} of{" "}
              {formatNumber(meta.total)}
            </p>
            {meta.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(meta.page - 1)} disabled={meta.page <= 1}>
                  <ChevronLeft aria-hidden /> Previous
                </Button>
                <span className="text-muted-foreground text-xs tabular-nums">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage(meta.page + 1)} disabled={meta.page >= meta.totalPages}>
                  Next <ChevronRight aria-hidden />
                </Button>
              </div>
            )}
          </nav>
        )}
      </Card>
    </div>
  );
}
