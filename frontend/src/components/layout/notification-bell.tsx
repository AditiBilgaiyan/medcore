"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ROUTES } from "@/constants/routes";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCount } from "@/services/misc";
import { useNotificationStore } from "@/store/notification-store";
import { EmptyState, Spinner } from "@/components/shared/states";

export function NotificationBell() {
  const { data: unread } = useUnreadCount();
  const { data, isLoading } = useNotifications({ limit: 8 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const setUnread = useNotificationStore((s) => s.setUnreadCount);
  const count = useNotificationStore((s) => s.unreadCount);
  const router = useRouter();

  useEffect(() => {
    if (unread) setUnread(unread.count);
  }, [unread, setUnread]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${count ? `, ${count} unread` : ""}`}>
          <Bell />
          {count > 0 && (
            <span
              className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
              aria-hidden
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="xs" onClick={() => markAll.mutate()} disabled={!count || markAll.isPending}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : !data?.data.length ? (
            <EmptyState compact icon={Bell} title="You're all caught up" />
          ) : (
            <ul className="divide-y">
              {data.data.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      "hover:bg-accent/50 flex w-full cursor-pointer gap-2 px-3 py-2.5 text-left transition-colors",
                      !n.readAt && "bg-accent/30",
                    )}
                    onClick={() => {
                      if (!n.readAt) markRead.mutate(n.id);
                      if (n.link) router.push(n.link);
                    }}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{n.title}</span>
                      <span className="text-muted-foreground line-clamp-2 block text-xs">{n.body}</span>
                      <span className="text-muted-foreground mt-0.5 block text-[11px]">{formatRelative(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="sr-only">Unread</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-1.5">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href={ROUTES.notifications}>View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
