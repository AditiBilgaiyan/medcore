"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Laptop, Loader2, LogOut, MonitorSmartphone, Smartphone, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { ROUTES } from "@/constants/routes";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useLogoutAll, useRevokeSession, useSessions } from "@/services/auth";
import { useNotificationStore } from "@/store/notification-store";
import { ListSkeleton } from "../dashboard/common";

function deviceIcon(name: string) {
  return /iphone|android|mobile|phone/i.test(name) ? Smartphone : Laptop;
}

export function SessionsCard() {
  const { data, isLoading, error, refetch } = useSessions();
  const revoke = useRevokeSession();
  const logoutAll = useLogoutAll();
  const [revoking, setRevoking] = useState<string | null>(null);
  const qc = useQueryClient();
  const router = useRouter();
  const sessions = [...(data ?? [])].sort((a, b) => Number(b.current) - Number(a.current) || b.lastUsedAt.localeCompare(a.lastUsedAt));

  const onRevoke = (id: string, name: string) => {
    setRevoking(id);
    revoke.mutate(id, {
      onSuccess: () => toast.success(`Signed out ${name}`),
      onSettled: () => setRevoking(null),
    });
  };

  const signOutEverywhere = async () => {
    await logoutAll.mutateAsync();
    qc.clear();
    useNotificationStore.getState().reset();
    toast.success("Signed out of all devices");
    router.replace(ROUTES.login);
  };

  return (
    <SectionCard
      title="Active sessions"
      description="Devices currently signed in to your account."
      action={
        <ConfirmDialog
          title="Sign out of all devices?"
          description="Every session, including this one, will be ended. You'll need to sign in again."
          confirmLabel="Sign out everywhere"
          destructive
          onConfirm={signOutEverywhere}
          trigger={
            <Button variant="outline" size="sm" disabled={logoutAll.isPending}>
              {logoutAll.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
              Sign out all devices
            </Button>
          }
        />
      }
    >
      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => refetch()} className="py-6" />
      ) : sessions.length === 0 ? (
        <EmptyState compact icon={MonitorSmartphone} title="No active sessions" />
      ) : (
        <ul className="divide-y">
          {sessions.map((s) => {
            const Icon = deviceIcon(s.deviceName);
            return (
              <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg" aria-hidden>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{s.deviceName}</span>
                    {s.current && <StatusBadge status="CURRENT" tone="success" label="This device" />}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    <span className="font-mono">{s.ip}</span> · last active{" "}
                    <time dateTime={s.lastUsedAt} title={formatDateTime(s.lastUsedAt)}>
                      {formatRelative(s.lastUsedAt)}
                    </time>
                  </p>
                </div>
                {!s.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRevoke(s.id, s.deviceName)}
                    disabled={revoke.isPending}
                    aria-label={`Sign out ${s.deviceName} (${s.ip})`}
                  >
                    {revoking === s.id ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
