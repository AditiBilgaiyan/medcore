import { create } from "zustand";
import type { Notification } from "@/types";

interface NotificationState {
  /** Notifications received over the realtime channel since page load. */
  live: Notification[];
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  push: (notification: Notification) => void;
  markAllRead: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  live: [],
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  push: (notification) => set((s) => ({ live: [notification, ...s.live].slice(0, 50), unreadCount: s.unreadCount + 1 })),
  markAllRead: () => set({ unreadCount: 0 }),
  reset: () => set({ live: [], unreadCount: 0 }),
}));
