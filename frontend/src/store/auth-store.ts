import { create } from "zustand";
import type { AuthSession, CurrentUser } from "@/types";

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: CurrentUser | null;
  /** Kept in memory only — never persisted. The refresh token lives in an httpOnly cookie. */
  accessToken: string | null;
  status: AuthStatus;
  setSession: (session: AuthSession) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: CurrentUser) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  status: "idle",
  setSession: (session) => set({ user: session.user, accessToken: session.accessToken, status: "authenticated" }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: () => set({ user: null, accessToken: null, status: "unauthenticated" }),
}));
