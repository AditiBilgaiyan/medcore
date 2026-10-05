import type { AuthSession, DeviceSession } from "@/types";
import { uid, type StoredUser } from "../db";
import { created, fail, ok, requireFields, route, toCurrentUser, type MockContext } from "../router";
import { ACCESS_TTL_SECONDS, randomOtp, randomToken, REFRESH_TTL_MS, signAccessToken } from "../tokens";

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function issueSession(ctx: MockContext, user: StoredUser, deviceName = "Web browser"): AuthSession {
  const now = new Date();
  // One refresh token per device; logging in again on the same device replaces it.
  ctx.db.refreshTokens
    .filter((t) => t.userId === user.id && t.deviceId === ctx.deviceId && !t.revokedAt)
    .forEach((t) => (t.revokedAt = now.toISOString()));
  const refresh = randomToken();
  ctx.db.refreshTokens.push({
    token: refresh,
    userId: user.id,
    deviceId: ctx.deviceId,
    deviceName,
    ip: ctx.ip,
    createdAt: now.toISOString(),
    lastUsedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + REFRESH_TTL_MS).toISOString(),
  });
  ctx.setRefreshCookie(refresh);
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role, hid: user.hospitalId }),
    expiresIn: ACCESS_TTL_SECONDS,
    user: toCurrentUser(ctx.db, user),
  };
}

function issueOtp(ctx: MockContext, userId: string, purpose: "EMAIL" | "PHONE" | "RESET") {
  const code = purpose === "RESET" ? randomToken(16) : randomOtp();
  ctx.db.otps = ctx.db.otps.filter((o) => !(o.userId === userId && o.purpose === purpose));
  ctx.db.otps.push({ userId, purpose, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  return code;
}

function consumeOtp(ctx: MockContext, userId: string, purpose: "EMAIL" | "PHONE" | "RESET", code: string) {
  const otp = ctx.db.otps.find((o) => o.userId === userId && o.purpose === purpose);
  if (!otp || otp.code !== code) fail(400, "INVALID_CODE", "That code is incorrect.");
  if (new Date(otp!.expiresAt).getTime() < Date.now()) fail(400, "CODE_EXPIRED", "That code has expired. Request a new one.");
  ctx.db.otps = ctx.db.otps.filter((o) => o !== otp);
}

route(
  "POST",
  "/auth/login",
  (ctx) => {
    requireFields(ctx.body, ["email", "password"]);
    const email = String(ctx.body.email).trim().toLowerCase();
    const user = ctx.db.users.find((u) => u.email.toLowerCase() === email && !u.deletedAt);
    if (!user || user.password !== ctx.body.password) {
      fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    if (user!.status === "DISABLED") fail(403, "ACCOUNT_DISABLED", "This account has been disabled. Contact your administrator.");
    if (!user!.isEmailVerified) fail(403, "EMAIL_NOT_VERIFIED", "Verify your email address before signing in.");
    const hospital = ctx.db.hospitals.find((h) => h.id === user!.hospitalId);
    if (hospital?.status === "SUSPENDED") fail(403, "HOSPITAL_SUSPENDED", `${hospital.name} is suspended. Contact MedCore support.`);
    if (hospital?.status === "PENDING_VERIFICATION") fail(403, "HOSPITAL_PENDING", `${hospital.name} is awaiting verification.`);

    if (user!.status === "INVITED") user!.status = "ACTIVE";
    user!.lastLoginAt = new Date().toISOString();
    ctx.user = user!;
    ctx.audit("LOGIN", "User", user!.id, "Signed in");
    return ok(issueSession(ctx, user!, String(ctx.body.deviceName ?? "Web browser")), "Signed in");
  },
  { public: true },
);

route(
  "POST",
  "/auth/refresh",
  (ctx) => {
    const token = ctx.getRefreshCookie();
    if (!token) fail(401, "NO_REFRESH_TOKEN", "Please sign in.");
    const stored = ctx.db.refreshTokens.find((t) => t.token === token);
    if (!stored) {
      ctx.setRefreshCookie(null);
      fail(401, "INVALID_REFRESH_TOKEN", "Please sign in.");
    }
    if (stored!.revokedAt) {
      // Reuse of a rotated token: assume theft and revoke every session for this user.
      if (stored!.replacedBy) {
        ctx.db.refreshTokens
          .filter((t) => t.userId === stored!.userId && !t.revokedAt)
          .forEach((t) => (t.revokedAt = new Date().toISOString()));
      }
      ctx.setRefreshCookie(null);
      fail(401, "REFRESH_TOKEN_REUSED", "Your session is no longer valid. Please sign in again.");
    }
    if (new Date(stored!.expiresAt).getTime() < Date.now()) {
      ctx.setRefreshCookie(null);
      fail(401, "REFRESH_TOKEN_EXPIRED", "Your session has expired. Please sign in again.");
    }
    const user = ctx.db.users.find((u) => u.id === stored!.userId && !u.deletedAt);
    if (!user || user.status === "DISABLED") fail(401, "UNAUTHORIZED", "Please sign in.");

    // Rotate: issue a new token and invalidate the old one.
    const next = randomToken();
    const now = new Date().toISOString();
    stored!.revokedAt = now;
    stored!.replacedBy = next;
    ctx.db.refreshTokens.push({
      ...stored!,
      token: next,
      createdAt: now,
      lastUsedAt: now,
      revokedAt: undefined,
      replacedBy: undefined,
    });
    ctx.setRefreshCookie(next);
    const session: AuthSession = {
      accessToken: signAccessToken({ sub: user!.id, role: user!.role, hid: user!.hospitalId }),
      expiresIn: ACCESS_TTL_SECONDS,
      user: toCurrentUser(ctx.db, user!),
    };
    return ok(session);
  },
  { public: true },
);

route("POST", "/auth/logout", (ctx) => {
  const token = ctx.getRefreshCookie();
  const stored = ctx.db.refreshTokens.find((t) => t.token === token);
  if (stored) stored.revokedAt = new Date().toISOString();
  ctx.setRefreshCookie(null);
  ctx.audit("LOGOUT", "User", ctx.requireUser().id, "Signed out");
  return ok(null, "Signed out");
});

route("POST", "/auth/logout-all", (ctx) => {
  const user = ctx.requireUser();
  ctx.db.refreshTokens.filter((t) => t.userId === user.id && !t.revokedAt).forEach((t) => (t.revokedAt = new Date().toISOString()));
  ctx.setRefreshCookie(null);
  ctx.audit("LOGOUT", "User", user.id, "Signed out of all devices");
  return ok(null, "Signed out of all devices");
});

route("GET", "/auth/me", (ctx) => ok(toCurrentUser(ctx.db, ctx.requireUser())));

route("PATCH", "/auth/me", (ctx) => {
  const user = ctx.requireUser();
  const { firstName, lastName, phone } = ctx.body as Record<string, string | undefined>;
  if (firstName !== undefined) user.firstName = firstName.trim();
  if (lastName !== undefined) user.lastName = lastName.trim();
  if (phone !== undefined && phone !== user.phone) {
    user.phone = phone.trim();
    user.isPhoneVerified = false;
  }
  ctx.audit("UPDATE", "User", user.id, "Updated profile");
  return ok(toCurrentUser(ctx.db, user), "Profile updated");
});

route("POST", "/auth/change-password", (ctx) => {
  const user = ctx.requireUser();
  requireFields(ctx.body, ["currentPassword", "newPassword"]);
  if (ctx.body.currentPassword !== user.password) fail(400, "INVALID_PASSWORD", "Current password is incorrect.");
  if (!PASSWORD_RULE.test(String(ctx.body.newPassword))) {
    fail(422, "WEAK_PASSWORD", "Use at least 8 characters with upper and lower case letters, a number and a symbol.");
  }
  user.password = String(ctx.body.newPassword);
  ctx.audit("UPDATE", "User", user.id, "Changed password");
  return ok(null, "Password changed");
});

route(
  "POST",
  "/auth/register",
  (ctx) => {
    requireFields(ctx.body, ["firstName", "lastName", "email", "phone", "password", "hospitalId", "dob", "gender"]);
    const email = String(ctx.body.email).trim().toLowerCase();
    if (ctx.db.users.some((u) => u.email.toLowerCase() === email)) {
      fail(409, "EMAIL_TAKEN", "An account with this email already exists.", { email: ["Already registered."] });
    }
    if (!PASSWORD_RULE.test(String(ctx.body.password))) {
      fail(422, "WEAK_PASSWORD", "Use at least 8 characters with upper and lower case letters, a number and a symbol.");
    }
    const hospital = ctx.db.hospitals.find((h) => h.id === ctx.body.hospitalId && h.status === "ACTIVE");
    if (!hospital) fail(422, "VALIDATION_ERROR", "Choose a hospital.", { hospitalId: ["Choose a hospital."] });

    const now = new Date().toISOString();
    const userId = uid("usr");
    ctx.db.users.push({
      id: userId,
      hospitalId: hospital!.id,
      role: "PATIENT",
      firstName: String(ctx.body.firstName).trim(),
      lastName: String(ctx.body.lastName).trim(),
      email,
      phone: String(ctx.body.phone).trim(),
      status: "ACTIVE",
      isEmailVerified: false,
      isPhoneVerified: false,
      createdAt: now,
      password: String(ctx.body.password),
      deletedAt: null,
    });
    ctx.db.patients.push({
      id: uid("pat"),
      userId,
      hospitalId: hospital!.id,
      mrn: `${hospital!.code}-${String(200000 + ctx.db.patients.length).padStart(6, "0")}`,
      firstName: String(ctx.body.firstName).trim(),
      lastName: String(ctx.body.lastName).trim(),
      dob: String(ctx.body.dob),
      gender: ctx.body.gender as "MALE" | "FEMALE" | "OTHER",
      phone: String(ctx.body.phone).trim(),
      email,
      address: { line1: "", city: "", state: "", postalCode: "", country: "India" },
      emergencyContact: { name: "", relation: "", phone: "" },
      allergies: [],
      familyHistory: { diabetes: false, hypertension: false, cancer: false, cardiac: false },
      chronicConditions: [],
      currentMedications: [],
      createdAt: now,
      deletedAt: null,
    });
    const devOtp = issueOtp(ctx, userId, "EMAIL");
    return created({ userId, email, devOtp }, "Account created. Check your email for a verification code.");
  },
  { public: true },
);

route(
  "POST",
  "/auth/verify-email",
  (ctx) => {
    requireFields(ctx.body, ["email", "code"]);
    const user = ctx.db.users.find((u) => u.email.toLowerCase() === String(ctx.body.email).toLowerCase());
    if (!user) fail(400, "INVALID_CODE", "That code is incorrect.");
    consumeOtp(ctx, user!.id, "EMAIL", String(ctx.body.code));
    user!.isEmailVerified = true;
    return ok({ verified: true }, "Email verified");
  },
  { public: true },
);

route(
  "POST",
  "/auth/resend-otp",
  (ctx) => {
    const user = ctx.db.users.find((u) => u.email.toLowerCase() === String(ctx.body.email ?? "").toLowerCase());
    // Don't reveal whether the email exists.
    if (!user || user.isEmailVerified) return ok({}, "If the account exists, a new code has been sent.");
    return ok({ devOtp: issueOtp(ctx, user.id, "EMAIL") }, "A new code has been sent.");
  },
  { public: true },
);

route("POST", "/auth/send-phone-otp", (ctx) => {
  const user = ctx.requireUser();
  return ok({ devOtp: issueOtp(ctx, user.id, "PHONE") }, `Code sent to ${user.phone}`);
});

route("POST", "/auth/verify-phone", (ctx) => {
  const user = ctx.requireUser();
  requireFields(ctx.body, ["code"]);
  consumeOtp(ctx, user.id, "PHONE", String(ctx.body.code));
  user.isPhoneVerified = true;
  return ok(toCurrentUser(ctx.db, user), "Phone verified");
});

route(
  "POST",
  "/auth/forgot-password",
  (ctx) => {
    requireFields(ctx.body, ["email"]);
    const user = ctx.db.users.find((u) => u.email.toLowerCase() === String(ctx.body.email).toLowerCase());
    const devResetToken = user ? issueOtp(ctx, user.id, "RESET") : undefined;
    return ok({ devResetToken }, "If an account exists for that email, we've sent a reset link.");
  },
  { public: true },
);

route(
  "POST",
  "/auth/reset-password",
  (ctx) => {
    requireFields(ctx.body, ["token", "password"]);
    const otp = ctx.db.otps.find((o) => o.purpose === "RESET" && o.code === ctx.body.token);
    if (!otp || new Date(otp.expiresAt).getTime() < Date.now()) {
      fail(400, "INVALID_RESET_TOKEN", "This reset link is invalid or has expired. Request a new one.");
    }
    if (!PASSWORD_RULE.test(String(ctx.body.password))) {
      fail(422, "WEAK_PASSWORD", "Use at least 8 characters with upper and lower case letters, a number and a symbol.");
    }
    const user = ctx.db.users.find((u) => u.id === otp!.userId)!;
    user.password = String(ctx.body.password);
    ctx.db.otps = ctx.db.otps.filter((o) => o !== otp);
    // Resetting the password signs the user out everywhere.
    ctx.db.refreshTokens.filter((t) => t.userId === user.id && !t.revokedAt).forEach((t) => (t.revokedAt = new Date().toISOString()));
    return ok(null, "Password updated. You can sign in now.");
  },
  { public: true },
);

route("GET", "/auth/sessions", (ctx) => {
  const user = ctx.requireUser();
  const current = ctx.getRefreshCookie();
  const sessions: DeviceSession[] = ctx.db.refreshTokens
    .filter((t) => t.userId === user.id && !t.revokedAt && new Date(t.expiresAt).getTime() > Date.now())
    .map((t) => ({
      id: t.token.slice(0, 12),
      deviceName: t.deviceName,
      ip: t.ip,
      lastUsedAt: t.lastUsedAt,
      current: t.token === current,
    }));
  return ok(sessions);
});

route("DELETE", "/auth/sessions/:id", (ctx) => {
  const user = ctx.requireUser();
  const t = ctx.db.refreshTokens.find((x) => x.userId === user.id && x.token.startsWith(ctx.params.id) && !x.revokedAt);
  if (!t) fail(404, "NOT_FOUND", "Session not found.");
  t!.revokedAt = new Date().toISOString();
  return ok(null, "Session revoked");
});

route(
  "GET",
  "/hospitals/public",
  (ctx) =>
    ok(
      ctx.db.hospitals
        .filter((h) => h.status === "ACTIVE" && h.bedCount > 0)
        .map((h) => ({ id: h.id, name: h.name, city: h.address.city })),
    ),
  { public: true },
);
