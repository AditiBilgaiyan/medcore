import { expect, test } from "@playwright/test";
import { login, trackErrors } from "./helpers";

/** Every screen each role can reach renders without crashing or failing to load. */
const ROLE_ROUTES: Record<string, string[]> = {
  "superadmin@medcore.dev": [
    "/dashboard",
    "/hospitals",
    "/hospitals/new",
    "/hospitals/hosp-citycare",
    "/analytics",
    "/audit-logs",
    "/notifications",
    "/settings",
  ],
  "admin@citycare.dev": [
    "/dashboard",
    "/analytics",
    "/departments",
    "/staff",
    "/doctors",
    "/doctors/doc-001",
    "/patients",
    "/appointments",
    "/availability?doctorId=doc-002",
    "/wards",
    "/lab",
    "/lab/tests",
    "/pharmacy",
    "/billing",
    "/audit-logs",
    "/search?q=sharma",
  ],
  "dr.mehta@citycare.dev": [
    "/dashboard",
    "/appointments",
    "/availability",
    "/patients",
    "/patients/pat-cch-0001",
    "/prescriptions",
    "/lab",
    "/wards",
    "/pharmacy",
    "/doctors",
  ],
  "nurse.fernandes@citycare.dev": ["/dashboard", "/wards", "/patients", "/appointments", "/prescriptions", "/lab"],
  "reception@citycare.dev": [
    "/dashboard",
    "/appointments",
    "/appointments/new",
    "/patients",
    "/patients/new",
    "/billing",
    "/billing/new",
    "/doctors",
  ],
  "lab@citycare.dev": ["/dashboard", "/lab", "/lab/tests"],
  "pharmacy@citycare.dev": ["/dashboard", "/pharmacy", "/pharmacy/dispense", "/prescriptions"],
  "accounts@citycare.dev": ["/dashboard", "/billing", "/billing/claims", "/analytics"],
  "aarav.sharma@mail.dev": [
    "/portal",
    "/portal/appointments",
    "/portal/book",
    "/portal/records",
    "/portal/reports",
    "/portal/prescriptions",
    "/portal/invoices",
    "/portal/profile",
    "/notifications",
  ],
};

for (const [email, routes] of Object.entries(ROLE_ROUTES)) {
  test(`${email} can open all their screens`, async ({ page }, info) => {
    const errors = trackErrors(page);
    await login(page, email);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("main h1").first(), route).toBeVisible();
      // Let queries settle, then make sure nothing failed to load.
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(600);
      await expect(page.getByText("Couldn't load this"), route).toHaveCount(0);
      await expect(page.getByText("Something went wrong"), route).toHaveCount(0);
      await expect(page.getByText("You don't have access to this page"), route).toHaveCount(0);
      if (process.env.E2E_SCREENSHOTS) {
        await page.screenshot({
          path: `${process.env.E2E_SCREENSHOTS}/${email.split("@")[0]}${route.replace(/[/?=&]/g, "_")}.png`,
          fullPage: true,
        });
      }
    }
    expect(errors, `errors for ${email}`).toEqual([]);
    void info;
  });
}

test("roles can't open screens outside their permissions", async ({ page }) => {
  await login(page, "reception@citycare.dev");
  await page.goto("/pharmacy/dispense");
  await expect(page.getByText("You don't have access to this page")).toBeVisible();
});

test("signed-out users are sent to login", async ({ page }) => {
  await page.goto("/patients");
  await page.waitForURL(/\/login\?next=%2Fpatients/);
});
