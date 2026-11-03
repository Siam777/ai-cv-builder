import { expect, test } from "@playwright/test";
import { createDocument } from "../../src/lib/document";
import { authenticateForExport, openFirstCv, startSampleResume } from "./helpers";

function fixture() {
  const doc = createDocument(true);
  doc.contact.location = "";
  const experience = doc.sections.find((s) => s.type === "experience")!;
  experience.entries[0].bullets[0].text = "Responsible for weekly design reviews with the team.";
  return doc;
}

test("findings are grouped, fixable in place, and the panel stays open", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page, fixture());
  await page.getByRole("button", { name: /^Check/ }).click();
  const panel = page.getByRole("complementary", { name: "Check my CV" });
  await expect(panel.getByRole("tab", { name: /To fix/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // No raw counters; completeness and a short checklist instead.
  await expect(panel).not.toContainText("0/0");
  // On wide screens the meter lives in the steps rail; the panel keeps the checklist.
  await expect(panel.locator(".check-checklist")).toContainText("Contact details");
  await expect(page.getByRole("meter", { name: "CV strength" })).toHaveCount(1);
  await expect(panel.getByRole("meter", { name: "CV strength" })).toHaveCount(0);
  await expect(
    panel.getByRole("region", { name: "Personal details" }),
  ).toContainText("Add your city or region");
  const work = panel.getByRole("region", { name: /^Experience/ });
  await expect(work).toContainText("Start with a stronger verb");
  await expect(work).toContainText("Responsible for weekly design reviews");

  // Fix focuses the field and keeps the panel open.
  await panel.getByRole("button", { name: "Fix: Add your city or region" }).click();
  await expect(page.locator("#contact-location")).toBeFocused();
  await expect(panel).toBeVisible();

  // Findings clear live as the CV changes.
  await page.locator("#contact-location").fill("Leeds, UK");
  await expect(panel).not.toContainText("Add your city or region");

  // Next issue walks through what is left, starting with the first group.
  await panel.getByRole("button", { name: "Next issue" }).click();
  await expect(panel.locator(".finding.active")).toContainText(
    "Start with a stronger verb",
  );
  await expect(page.getByLabel("Bullet 1", { exact: true }).first()).toBeFocused();
});

test("dismissed findings stay hidden after reload and can be restored", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page, fixture());
  await page.getByRole("button", { name: /^Check/ }).click();
  const panel = page.getByRole("complementary", { name: "Check my CV" });
  const toFix = panel.getByRole("tab", { name: /To fix/ });
  const before = Number((await toFix.textContent())!.replace(/\D/g, ""));
  await panel
    .getByRole("button", { name: "Dismiss: Start with a stronger verb" })
    .click();
  await expect(panel).not.toContainText("Start with a stronger verb");
  await expect(toFix).toContainText(String(before - 1));

  await page.reload();
  await openFirstCv(page);
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(panel).not.toContainText("Start with a stronger verb");
  await panel.getByRole("button", { name: "Show 1 dismissed" }).click();
  await panel
    .getByRole("button", { name: "Restore: Start with a stronger verb" })
    .click();
  await expect(panel.getByRole("button", { name: /dismissed/ })).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Fix: Start with a stronger verb" }),
  ).toBeVisible();
});

test("bullet hints use the same checks and wait until you leave the field", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page, fixture());
  await page
    .getByRole("complementary", { name: "Resume sections" })
    .getByRole("button", { name: /^Experience/ })
    .click();
  const bullet = page.getByLabel("Bullet 1", { exact: true }).first();
  const hints = page.locator(".bullet-field").first().locator(".field-hints");
  await expect(hints).toContainText("Start with a stronger verb");
  await expect(bullet).toHaveAttribute("aria-describedby", /bullet-hints-/);
  await bullet.fill("Responsible");
  await expect(hints).toHaveCount(0);
  await bullet.blur();
  await expect(hints).toContainText("Bullet is very short");
  await bullet.fill("Cut review time by 30% by running weekly design critiques.");
  await bullet.blur();
  await expect(hints).toHaveCount(0);
});

test("the advanced view keeps the text and file checks out of the way", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await page.getByRole("button", { name: /^Check/ }).click();
  const panel = page.getByRole("complementary", { name: "Check my CV" });
  await expect(panel.locator(".plaintext-terminal")).toHaveCount(0);
  const advanced = panel.getByRole("button", { name: /^Advanced/ });
  await expect(advanced).toHaveAttribute("aria-expanded", "false");
  await advanced.click();
  await expect(panel.locator(".plaintext-terminal")).toContainText("ALEX MORGAN");
  await panel.getByRole("button", { name: "File diagnostics" }).click();
  await expect(panel.getByLabel("File to check")).toBeVisible();
});

function overlapFixture() {
  const doc = createDocument(true);
  // Northstar starts 2022-03 and is current; Fieldwork now runs to 2022-09.
  doc.sections.find((s) => s.type === "experience")!.entries[1].end = "2022-09";
  return doc;
}

test("a consistency finding can be confirmed, and editing the dates reopens it", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page, overlapFixture());
  await page.getByRole("button", { name: /^Check/ }).click();
  const panel = page.getByRole("complementary", { name: "Check my CV" });
  const work = panel.getByRole("region", { name: /^Experience/ });
  await expect(work.getByRole("heading", { name: "Is everything consistent?" })).toBeVisible();
  await expect(work).toContainText("Check these dates");
  await expect(work).toContainText("overlap by about 7 months");

  await panel.getByRole("button", { name: "Confirm: Check these dates" }).focus();
  await page.keyboard.press("Enter");
  await expect(panel).not.toContainText("Check these dates");
  await panel.getByRole("button", { name: "Show 1 confirmed" }).click();
  await expect(panel.locator(".finding.confirmed")).toContainText("Confirmed");
  await panel.getByRole("button", { name: "Hide confirmed" }).click();

  // Confirmations survive a reload.
  await page.reload();
  await openFirstCv(page);
  await page.getByRole("button", { name: /^Check/ }).click();
  await expect(panel).not.toContainText("Check these dates");

  await page
    .getByRole("complementary", { name: "Resume sections" })
    .getByRole("button", { name: /^Experience/ })
    .click();
  const end = page.getByLabel("End date (YYYY or YYYY-MM)").nth(1);
  await expect(end).toHaveValue("2022-09");
  await end.fill("2022-11");
  await expect(panel).toContainText("overlap by about 9 months");
  await expect(panel.getByRole("button", { name: "Confirm: Check these dates" })).toBeVisible();
});

function dateOrderFixture() {
  const doc = createDocument(true);
  doc.sections.find((s) => s.type === "experience")!.entries[1].end = "2018-01";
  return doc;
}

async function downloadTxt(page: import("@playwright/test").Page) {
  await page.locator(".export-menu summary").click();
  await page.getByRole("button", { name: "Plain text (.txt)" }).click();
}

test("the export reminder never blocks and can be skipped for this version", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/builder");
  await startSampleResume(page, dateOrderFixture());
  await authenticateForExport(page);

  await downloadTxt(page);
  const reminder = page.getByRole("dialog", { name: /Before you send it: 1 thing to check/ });
  await expect(reminder).toContainText("End date is before the start date");
  // Escape closes it without exporting.
  await page.keyboard.press("Escape");
  await expect(reminder).toHaveCount(0);

  // Review opens Check my CV.
  await downloadTxt(page);
  await reminder.getByRole("button", { name: "Review" }).click();
  await expect(reminder).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Check my CV" })).toContainText(
    "End date is before the start date",
  );

  // Export anyway continues the normal export.
  await downloadTxt(page);
  await reminder.getByLabel("Don't remind me for this version").check();
  const downloading = page.waitForEvent("download");
  await reminder.getByRole("button", { name: "Export anyway" }).click();
  expect((await downloading).suggestedFilename()).toMatch(/\.txt$/);

  // Skipped for this version: the next export goes straight through.
  const again = page.waitForEvent("download");
  await downloadTxt(page);
  expect((await again).suggestedFilename()).toMatch(/\.txt$/);
  await expect(reminder).toHaveCount(0);
});

test("no export reminder without attention-level consistency findings", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await authenticateForExport(page);
  const downloading = page.waitForEvent("download");
  await downloadTxt(page);
  expect((await downloading).suggestedFilename()).toMatch(/\.txt$/);
  await expect(page.getByRole("dialog", { name: /Before you send it/ })).toHaveCount(0);
});

test("the export reminder fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto("/builder");
  await startSampleResume(page, dateOrderFixture());
  await authenticateForExport(page);
  await downloadTxt(page);
  const reminder = page.getByRole("dialog", { name: /Before you send it/ });
  for (const name of ["Review", "Export anyway"])
    await expect(reminder.getByRole("button", { name })).toBeInViewport();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
