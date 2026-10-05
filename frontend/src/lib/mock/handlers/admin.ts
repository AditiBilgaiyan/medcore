import { DEMO_PASSWORD } from "@/constants/roles";
import type { Department, Hospital, HospitalStatus, Role, UserStatus as StoredUserStatus } from "@/types";
import { uid } from "../db";
import {
  created,
  fail,
  forbidden,
  matchesSearch,
  notFound,
  ok,
  paginate,
  publicUser,
  requireFields,
  route,
  sortBy,
  type MockContext,
} from "../router";

export function departmentWithOccupancy(ctx: MockContext, dep: Department): Department {
  const wardIds = ctx.db.wards.filter((w) => w.departmentId === dep.id).map((w) => w.id);
  return {
    ...dep,
    occupiedBeds: ctx.db.admissions.filter((a) => a.status === "ADMITTED" && wardIds.includes(a.wardId)).length,
  };
}

/* ---------------- Hospitals ---------------- */

route("GET", "/hospitals", (ctx) => {
  ctx.requirePermission("hospitals:manage");
  const status = ctx.query.arr("status");
  const search = ctx.query.str("search");
  const list = ctx.db.hospitals.filter(
    (h) => (!status || status.includes(h.status)) && matchesSearch(search, h.name, h.code, h.address.city, h.email),
  );
  return paginate(sortBy(list, ctx.query, { key: "createdAt", order: "desc" }), ctx.query);
});

route("GET", "/hospitals/:id", (ctx) => {
  const user = ctx.requireUser();
  const h = ctx.db.hospitals.find((x) => x.id === ctx.params.id);
  if (!h || (user.role !== "SUPER_ADMIN" && user.hospitalId !== h.id)) notFound("Hospital");
  const adminUser = ctx.db.users.find((u) => u.hospitalId === h!.id && u.role === "HOSPITAL_ADMIN");
  const stats = {
    departments: ctx.db.departments.filter((d) => d.hospitalId === h!.id).length,
    doctors: ctx.db.doctors.filter((d) => d.hospitalId === h!.id && !d.deletedAt).length,
    staff: ctx.db.users.filter((u) => u.hospitalId === h!.id && u.role !== "PATIENT").length,
    patients: ctx.db.patients.filter((p) => p.hospitalId === h!.id && !p.deletedAt).length,
    admin: adminUser ? publicUser(adminUser) : null,
  };
  return ok({ ...h, stats });
});

route("POST", "/hospitals", (ctx) => {
  ctx.requirePermission("hospitals:manage");
  requireFields(ctx.body, ["name", "type", "plan", "email", "phone", "registrationNumber", "address", "admin"]);
  const body = ctx.body as unknown as Omit<Hospital, "id"> & {
    admin: { firstName: string; lastName: string; email: string; phone: string };
  };
  if (ctx.db.users.some((u) => u.email.toLowerCase() === body.admin.email.toLowerCase())) {
    fail(409, "EMAIL_TAKEN", "The admin email is already in use.", { "admin.email": ["Already in use."] });
  }
  const code = body.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  const hospital: Hospital = {
    id: uid("hosp"),
    name: body.name.trim(),
    code: ctx.db.hospitals.some((h) => h.code === code) ? `${code}${ctx.db.hospitals.length}` : code,
    type: body.type,
    status: "PENDING_VERIFICATION",
    plan: body.plan,
    email: body.email,
    phone: body.phone,
    address: body.address,
    bedCount: Number(body.bedCount) || 0,
    registrationNumber: body.registrationNumber,
    createdAt: new Date().toISOString(),
  };
  ctx.db.hospitals.unshift(hospital);
  ctx.db.users.push({
    id: uid("usr"),
    hospitalId: hospital.id,
    role: "HOSPITAL_ADMIN",
    firstName: body.admin.firstName,
    lastName: body.admin.lastName,
    email: body.admin.email.toLowerCase(),
    phone: body.admin.phone,
    status: "INVITED",
    isEmailVerified: true,
    isPhoneVerified: false,
    createdAt: hospital.createdAt,
    password: DEMO_PASSWORD,
    deletedAt: null,
  });
  ctx.audit("CREATE", "Hospital", hospital.id, `Onboarded ${hospital.name} (pending verification)`);
  return created(hospital, "Hospital created. Verify it to activate the tenant.");
});

route("PATCH", "/hospitals/:id/status", (ctx) => {
  ctx.requirePermission("hospitals:manage");
  const h = ctx.db.hospitals.find((x) => x.id === ctx.params.id);
  if (!h) notFound("Hospital");
  const status = ctx.body.status as HospitalStatus;
  if (!["ACTIVE", "SUSPENDED"].includes(status)) fail(422, "VALIDATION_ERROR", "Invalid status.");
  h!.status = status;
  if (status === "ACTIVE" && !h!.verifiedAt) h!.verifiedAt = new Date().toISOString();
  const admin = ctx.db.users.find((u) => u.hospitalId === h!.id && u.role === "HOSPITAL_ADMIN");
  if (status === "ACTIVE") {
    ctx.notify(admin?.id, {
      type: "GENERAL",
      title: "Hospital verified",
      body: `${h!.name} is now active on MedCore.`,
      link: "/dashboard",
      channels: ["EMAIL", "IN_APP"],
    });
  }
  ctx.audit("UPDATE", "Hospital", h!.id, `${status === "ACTIVE" ? "Verified/activated" : "Suspended"} ${h!.name}`);
  return ok(h, status === "ACTIVE" ? "Hospital activated" : "Hospital suspended");
});

route("PATCH", "/hospitals/:id", (ctx) => {
  const user = ctx.requireRoles("SUPER_ADMIN", "HOSPITAL_ADMIN");
  const h = ctx.db.hospitals.find((x) => x.id === ctx.params.id);
  if (!h || (user.role !== "SUPER_ADMIN" && user.hospitalId !== h.id)) notFound("Hospital");
  const allowed = ["name", "email", "phone", "address", "bedCount", "type"] as const;
  for (const k of allowed) if (ctx.body[k] !== undefined) (h as unknown as Record<string, unknown>)[k] = ctx.body[k];
  if (user.role === "SUPER_ADMIN" && ctx.body.plan) h!.plan = ctx.body.plan as Hospital["plan"];
  ctx.audit("UPDATE", "Hospital", h!.id, `Updated ${h!.name} profile`);
  return ok(h, "Hospital updated");
});

/* ---------------- Departments ---------------- */

function listDepartments(ctx: MockContext, hospitalId: string) {
  return ctx.db.departments
    .filter((d) => d.hospitalId === hospitalId)
    .map((d) => departmentWithOccupancy(ctx, d))
    .sort((a, b) => a.name.localeCompare(b.name));
}

route("GET", "/hospitals/:id/departments", (ctx) => {
  const user = ctx.requireUser();
  if (user.role !== "SUPER_ADMIN" && user.hospitalId !== ctx.params.id) notFound("Hospital");
  return ok(listDepartments(ctx, ctx.params.id));
});

route("GET", "/departments", (ctx) => {
  const user = ctx.requireUser();
  const hospitalId = ctx.query.str("hospitalId") ?? user.hospitalId;
  if (!hospitalId) return ok([]);
  if (user.role !== "SUPER_ADMIN" && hospitalId !== user.hospitalId) notFound("Hospital");
  return ok(listDepartments(ctx, hospitalId));
});

route("POST", "/departments", (ctx) => {
  const user = ctx.requirePermission("departments:manage");
  requireFields(ctx.body, ["name", "code"]);
  const code = String(ctx.body.code).toUpperCase();
  if (ctx.db.departments.some((d) => d.hospitalId === user.hospitalId && d.code === code)) {
    fail(409, "DUPLICATE_CODE", "A department with this code already exists.", { code: ["Already in use."] });
  }
  const dep: Department = {
    id: uid("dep"),
    hospitalId: user.hospitalId!,
    name: String(ctx.body.name).trim(),
    code,
    description: String(ctx.body.description ?? ""),
    totalBeds: Number(ctx.body.totalBeds) || 0,
    occupiedBeds: 0,
    consultationFee: Number(ctx.body.consultationFee) || 0,
    headDoctorId: (ctx.body.headDoctorId as string) || undefined,
  };
  ctx.db.departments.push(dep);
  ctx.audit("CREATE", "Department", dep.id, `Created department ${dep.name}`);
  return created(dep, "Department created");
});

route("PATCH", "/departments/:id", (ctx) => {
  ctx.requirePermission("departments:manage");
  const dep = ctx.db.departments.find((d) => d.id === ctx.params.id);
  ctx.assertTenant(dep, "Department");
  for (const k of ["name", "description", "totalBeds", "consultationFee", "headDoctorId"] as const) {
    if (ctx.body[k] !== undefined) (dep as unknown as Record<string, unknown>)[k] = ctx.body[k];
  }
  ctx.audit("UPDATE", "Department", dep!.id, `Updated department ${dep!.name}`);
  return ok(departmentWithOccupancy(ctx, dep!), "Department updated");
});

route("DELETE", "/departments/:id", (ctx) => {
  ctx.requirePermission("departments:manage");
  const dep = ctx.db.departments.find((d) => d.id === ctx.params.id);
  ctx.assertTenant(dep, "Department");
  if (ctx.db.doctors.some((d) => d.departmentIds.includes(dep!.id) && !d.deletedAt)) {
    fail(409, "DEPARTMENT_IN_USE", "Reassign this department's doctors before deleting it.");
  }
  ctx.db.departments = ctx.db.departments.filter((d) => d !== dep);
  ctx.audit("DELETE", "Department", dep!.id, `Deleted department ${dep!.name}`);
  return ok(null, "Department deleted");
});

/* ---------------- Staff ---------------- */

route("GET", "/staff", (ctx) => {
  const user = ctx.requirePermission("staff:read");
  const roles = ctx.query.arr("role");
  const status = ctx.query.arr("status");
  const search = ctx.query.str("search");
  const list = ctx.db.users
    .filter(
      (u) =>
        u.hospitalId === user.hospitalId &&
        u.role !== "PATIENT" &&
        !u.deletedAt &&
        (!roles || roles.includes(u.role)) &&
        (!status || status.includes(u.status)) &&
        matchesSearch(search, u.firstName, u.lastName, u.email, `${u.firstName} ${u.lastName}`),
    )
    .map(publicUser);
  return paginate(sortBy(list, ctx.query, { key: "firstName", order: "asc" }), ctx.query);
});

route("POST", "/staff/invite", (ctx) => {
  const admin = ctx.requirePermission("staff:manage");
  requireFields(ctx.body, ["firstName", "lastName", "email", "phone", "role"]);
  const role = ctx.body.role as Role;
  if (role === "PATIENT" || role === "SUPER_ADMIN") forbidden("That role can't be invited here.");
  const email = String(ctx.body.email).trim().toLowerCase();
  if (ctx.db.users.some((u) => u.email.toLowerCase() === email)) {
    fail(409, "EMAIL_TAKEN", "A user with this email already exists.", { email: ["Already in use."] });
  }
  const userId = uid("usr");
  const now = new Date().toISOString();
  const newUser = {
    id: userId,
    hospitalId: admin.hospitalId,
    role,
    firstName: String(ctx.body.firstName).trim(),
    lastName: String(ctx.body.lastName).trim(),
    email,
    phone: String(ctx.body.phone),
    status: "INVITED" as const,
    isEmailVerified: true,
    isPhoneVerified: false,
    createdAt: now,
    password: DEMO_PASSWORD,
    deletedAt: null,
  };
  ctx.db.users.push(newUser);
  if (role === "DOCTOR") {
    const d = (ctx.body.doctor ?? {}) as Record<string, unknown>;
    if (!Array.isArray(d.departmentIds) || !d.departmentIds.length) {
      fail(422, "VALIDATION_ERROR", "Choose at least one department.", { "doctor.departmentIds": ["Required."] });
    }
    ctx.db.doctors.push({
      id: uid("doc"),
      userId,
      hospitalId: admin.hospitalId!,
      departmentIds: d.departmentIds as string[],
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email,
      phone: newUser.phone,
      specialisation: String(d.specialisation ?? ""),
      qualification: String(d.qualification ?? ""),
      registrationNumber: String(d.registrationNumber ?? ""),
      experienceYears: Number(d.experienceYears) || 0,
      consultationFee: Number(d.consultationFee) || 0,
      bio: "",
      rating: 0,
      languages: ["English"],
      isAcceptingPatients: true,
      deletedAt: null,
    });
  }
  ctx.audit("CREATE", "User", userId, `Invited ${newUser.firstName} ${newUser.lastName} as ${role}`);
  return created(publicUser(newUser), `Invitation sent to ${email}. Demo password: ${DEMO_PASSWORD}`);
});

route("PATCH", "/staff/:id", (ctx) => {
  const admin = ctx.requirePermission("staff:manage");
  const u = ctx.db.users.find((x) => x.id === ctx.params.id && x.role !== "PATIENT");
  if (!u || u.hospitalId !== admin.hospitalId) notFound("User");
  if (u!.id === admin.id && ctx.body.status === "DISABLED") fail(422, "CANNOT_DISABLE_SELF", "You can't disable your own account.");
  if (ctx.body.status) u!.status = ctx.body.status as StoredUserStatus;
  if (ctx.body.role && ctx.body.role !== "PATIENT" && ctx.body.role !== "SUPER_ADMIN") u!.role = ctx.body.role as Role;
  if (u!.status === "DISABLED") {
    ctx.db.refreshTokens.filter((t) => t.userId === u!.id && !t.revokedAt).forEach((t) => (t.revokedAt = new Date().toISOString()));
  }
  ctx.audit("UPDATE", "User", u!.id, `Updated ${u!.firstName} ${u!.lastName}: ${u!.role}, ${u!.status}`);
  return ok(publicUser(u!), "Staff member updated");
});

route("GET", "/users/:id", (ctx) => {
  const me = ctx.requireUser();
  const u = ctx.db.users.find((x) => x.id === ctx.params.id && !x.deletedAt);
  const isAdmin = me.role === "SUPER_ADMIN" || (me.role === "HOSPITAL_ADMIN" && u?.hospitalId === me.hospitalId);
  if (!u || (u.id !== me.id && !isAdmin)) notFound("User");
  return ok(publicUser(u!));
});

/* ---------------- Audit log ---------------- */

route("GET", "/audit-logs", (ctx) => {
  ctx.requirePermission("audit:read");
  const tenant = ctx.tenantId();
  const actions = ctx.query.arr("action");
  const entity = ctx.query.arr("entityType");
  const search = ctx.query.str("search");
  const from = ctx.query.str("from");
  const to = ctx.query.str("to");
  const list = ctx.db.auditLogs.filter(
    (a) =>
      (tenant === null || a.hospitalId === tenant) &&
      (!actions || actions.includes(a.action)) &&
      (!entity || entity.includes(a.entityType)) &&
      (!from || a.createdAt.slice(0, 10) >= from) &&
      (!to || a.createdAt.slice(0, 10) <= to) &&
      matchesSearch(search, a.userName, a.summary, a.entityId),
  );
  return paginate(sortBy(list, ctx.query, { key: "createdAt", order: "desc" }), ctx.query, 25);
});
