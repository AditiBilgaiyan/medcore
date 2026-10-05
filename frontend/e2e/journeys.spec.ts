import { expect, test } from "@playwright/test";
import { login, trackErrors } from "./helpers";

test("patient pays an outstanding bill online", async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, "aarav.sharma@mail.dev");
  // The home page's "Amount due" card links to the unpaid bill.
  await page
    .getByRole("link", { name: "Pay now" })
    .or(page.getByRole("button", { name: "Pay now" }))
    .first()
    .click();
  await page.waitForURL(/\/portal\/invoices\//);
  await page
    .getByRole("main")
    .getByRole("button", { name: /^Pay ₹/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Continue to/ }).click();
  await dialog.getByRole("button", { name: /^Pay ₹/ }).click();
  await expect(dialog.getByText("Payment successful")).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Balance due").locator("..").getByText("₹0.00")).toBeVisible();
  expect(errors).toEqual([]);
});

test("patient requests an appointment from the portal", async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, "aarav.sharma@mail.dev");
  await page.goto("/portal/book");
  await page.getByRole("button", { name: /Dr\. Ananya Iyer/ }).click();
  const dateStep = page.getByRole("heading", { name: "Date & time", level: 2 });
  if (!(await dateStep.isVisible())) await page.getByRole("button", { name: "Continue" }).click();
  await expect(dateStep).toBeVisible();
  // First working day after today that still has an open slot.
  const days = page
    .getByRole("list", { name: "Date" })
    .getByRole("button")
    .filter({ hasNotText: /Off|Today/ });
  await expect(days.first()).toBeVisible();
  const count = await days.count();
  let picked = false;
  for (let i = 0; i < count && !picked; i++) {
    await days.nth(i).click();
    await expect(days.nth(i)).toHaveAttribute("aria-pressed", "true");
    const group = page.getByRole("group", { name: /Available times/ });
    await expect(
      group
        .getByText(/slots? available/)
        .or(page.getByText(/Pick another date/))
        .first(),
    ).toBeVisible();
    const open = group.getByRole("button", { disabled: false });
    if ((await open.count()) > 0) {
      await open.first().click();
      picked = true;
    }
  }
  expect(picked, "found an open slot").toBe(true);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: /Reason for visit/ }).fill("Palpitations after climbing stairs");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Request appointment" }).click();
  await expect(page.getByRole("heading", { name: "Appointment requested" })).toBeVisible();

  await page.goto("/portal/appointments");
  await expect(page.getByText("Palpitations after climbing stairs")).toBeVisible();
  expect(errors).toEqual([]);
});

test("doctor runs an encounter: vitals, diagnosis, prescription with allergy check, complete", async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, "dr.mehta@citycare.dev");
  await page.goto("/patients/pat-cch-0001");
  await page.getByRole("tab", { name: "Appointments" }).click();
  await page
    .getByRole("link", { name: /Confirmed$/ })
    .first()
    .click();
  await page.waitForURL(/\/appointments\/apt-/);
  await page
    .getByRole("link", { name: /Start encounter/ })
    .first()
    .click();
  await page.waitForURL(/\/encounters\//);
  await page.getByRole("button", { name: "Start encounter" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("In progress");

  // Vitals with live BMI.
  await page.getByRole("spinbutton", { name: "BP systolic" }).fill("148");
  await page.getByRole("spinbutton", { name: "BP diastolic" }).fill("94");
  await page.getByRole("spinbutton", { name: "Pulse" }).fill("82");
  await page.getByRole("spinbutton", { name: "Height" }).fill("176");
  await page.getByRole("spinbutton", { name: "Weight" }).fill("78");
  await expect(page.getByText(/BMI 25\.2/)).toBeVisible();
  await page.getByRole("button", { name: "Save vitals" }).click();
  await expect(page.getByText("148/94")).toBeVisible();

  // ICD-10 diagnosis + plan.
  await page.getByRole("combobox", { name: "Diagnoses" }).click();
  await page.getByRole("combobox", { name: "Search ICD-10" }).fill("I10");
  await page.getByRole("option", { name: /I10/ }).first().click();
  await page.getByRole("textbox", { name: "Treatment plan" }).fill("Increase Telma to 80 mg. Home BP log. Review in 2 weeks.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();

  // Prescribing a penicillin to a penicillin-allergic patient needs an explicit override.
  await page.getByRole("combobox").filter({ hasText: "Add medicine" }).click();
  await page.getByRole("combobox", { name: "Search medicines" }).fill("Augmentin");
  await page
    .getByRole("option", { name: /Augmentin/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign & issue" }).click();
  const warning = page.getByRole("alertdialog").or(page.getByRole("dialog"));
  await expect(warning.getByText(/Penicillin/).first()).toBeVisible();
  await warning.getByRole("button", { name: "Prescribe anyway" }).click();
  await expect(page.getByText(/RX-\d{4}-/).first()).toBeVisible();

  // Complete the visit.
  await page.getByRole("button", { name: "Complete visit" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Finalise & complete" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Completed");
  expect(errors).toEqual([]);
});
