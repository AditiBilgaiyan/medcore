import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const SCREENS: [string, string[]][] = [
  ["aarav.sharma@mail.dev", ["/portal", "/portal/appointments", "/portal/invoices", "/portal/book", "/portal/profile"]],
  ["reception@citycare.dev", ["/dashboard", "/appointments", "/patients", "/billing"]],
  ["dr.mehta@citycare.dev", ["/dashboard", "/patients/pat-cch-0001"]],
];

for (const [email, routes] of SCREENS) {
  test(`@mobile ${email} screens fit a phone without horizontal scrolling`, async ({ page }) => {
    await login(page, email);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("main h1").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} overflows by ${overflow}px`).toBeLessThanOrEqual(1);
      if (process.env.E2E_SCREENSHOTS)
        await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/m-${email.split("@")[0]}${route.replace(/\//g, "_")}.png` });
    }
  });
}
