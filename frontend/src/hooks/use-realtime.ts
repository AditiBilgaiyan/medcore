"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { USE_MOCK_API, WS_URL } from "@/constants/config";
import { qk } from "@/services/query-keys";
import { useAuthStore } from "@/store/auth-store";
import { useNotificationStore } from "@/store/notification-store";
import type { Notification, NotificationType } from "@/types";

/** Which cached data a notification makes stale. */
const INVALIDATES: Partial<Record<NotificationType, QueryKey[]>> = {
  APPOINTMENT_CONFIRMED: [qk.appointments.all],
  EMERGENCY_APPOINTMENT: [qk.appointments.all],
  LAB_REPORT_APPROVED: [qk.lab.all],
  PRESCRIPTION_READY: [qk.prescriptions.all],
  INVOICE_GENERATED: [qk.billing.all],
  PAYMENT_RECEIVED: [qk.billing.all],
  LOW_STOCK_ALERT: [qk.pharmacy.all],
  EXPIRY_ALERT: [qk.pharmacy.all],
};

/**
 * Subscribes to the user's realtime channel (Socket.IO in production, the
 * in-browser event bus in mock mode) and fans notifications out to the store,
 * a toast and the query cache.
 */
export function useRealtime() {
  const userId = useAuthStore((s) => s.user?.id);
  const accessToken = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const onNotification = (n: Notification) => {
      useNotificationStore.getState().push(n);
      void qc.invalidateQueries({ queryKey: qk.notifications.all });
      INVALIDATES[n.type]?.forEach((queryKey) => void qc.invalidateQueries({ queryKey }));
      const urgent = n.type === "EMERGENCY_APPOINTMENT" || n.title.toLowerCase().includes("critical");
      (urgent ? toast.warning : toast.info)(n.title, { description: n.body });
    };

    if (USE_MOCK_API) {
      let unsubscribe: (() => void) | undefined;
      let cancelled = false;
      void import("@/lib/mock/events").then(({ mockBus }) => {
        if (cancelled) return;
        unsubscribe = mockBus.subscribe(userId, (event, payload) => {
          if (event === "notification:new") onNotification(payload as Notification);
        });
      });
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    }

    let socket: import("socket.io-client").Socket | undefined;
    let cancelled = false;
    void import("socket.io-client").then(({ io }) => {
      if (cancelled) return;
      socket = io(WS_URL, { auth: { token: accessToken }, transports: ["websocket"] });
      socket.on("notification:new", onNotification);
    });
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
    // Reconnect when the access token rotates so the socket stays authenticated.
  }, [userId, accessToken, qc]);
}
