import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth-store";
import type {
  AuthSession,
  ChangePasswordRequest,
  CurrentUser,
  DeviceSession,
  ForgotPasswordResponse,
  LoginRequest,
  PublicHospital,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  UpdateProfileRequest,
  VerifyEmailRequest,
} from "@/types";
import { useInvalidatingMutation } from "./helpers";
import { qk } from "./query-keys";

export function useLogin() {
  return useMutation({
    mutationFn: (body: LoginRequest) => api.post<AuthSession>("/auth/login", body, { skipAuth: true }),
    meta: { silentError: true },
    onSuccess: (session) => useAuthStore.getState().setSession(session),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post<null>("/auth/logout"),
    meta: { silentError: true },
    onSettled: () => useAuthStore.getState().clear(),
  });
}

export function useLogoutAll() {
  return useMutation({
    mutationFn: () => api.post<null>("/auth/logout-all"),
    onSuccess: () => useAuthStore.getState().clear(),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: RegisterRequest) => api.post<RegisterResponse>("/auth/register", body, { skipAuth: true }),
    meta: { silentError: true },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (body: VerifyEmailRequest) => api.post<{ verified: boolean }>("/auth/verify-email", body, { skipAuth: true }),
    meta: { silentError: true },
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: (email: string) => api.post<{ devOtp?: string }>("/auth/resend-otp", { email }, { skipAuth: true }),
  });
}

export function useSendPhoneOtp() {
  return useMutation({ mutationFn: () => api.post<{ devOtp?: string }>("/auth/send-phone-otp") });
}

export function useVerifyPhone() {
  return useMutation({
    mutationFn: (code: string) => api.post<CurrentUser>("/auth/verify-phone", { code }),
    meta: { silentError: true },
    onSuccess: (user) => useAuthStore.getState().setUser(user),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.post<ForgotPasswordResponse>("/auth/forgot-password", { email }, { skipAuth: true }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: ResetPasswordRequest) => api.post<null>("/auth/reset-password", body, { skipAuth: true }),
    meta: { silentError: true },
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => api.patch<CurrentUser>("/auth/me", body),
    onSuccess: (user) => useAuthStore.getState().setUser(user),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => api.post<null>("/auth/change-password", body),
    meta: { silentError: true },
  });
}

export function useSessions() {
  return useQuery({ queryKey: qk.auth.sessions, queryFn: () => api.get<DeviceSession[]>("/auth/sessions") });
}

export function useRevokeSession() {
  return useInvalidatingMutation((id: string) => api.delete<null>(`/auth/sessions/${id}`), [qk.auth.sessions]);
}

export function usePublicHospitals() {
  return useQuery({
    queryKey: qk.auth.publicHospitals,
    queryFn: () => api.get<PublicHospital[]>("/hospitals/public"),
    staleTime: 5 * 60_000,
  });
}
