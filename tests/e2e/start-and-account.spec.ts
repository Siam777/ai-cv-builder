import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createDocument } from "../../src/lib/document";
import {
  accountTab,
  editorTool,
  openAccount,
  startSampleResume,
  verifyTestEmail,
} from "./helpers";

const CHOICES = [
  "Upload my CV",
  "Import from LinkedIn",
  "Start from scratch",
  "Start from my job title",
];
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh1sAAAAASUVORK5CYII=",
  "base64",
);

// Signs up through the API so the next page load opens the account.
async function signUp(page: Page) {
  const email = `start-${randomUUID()}@example.test`;
  const response = await page.request.post("/api/auth", {
    headers: {
      origin: process.env.E2E_ORIGIN || "http://localhost:3100",
      "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
    },
    data: { action: "signup", email, password: "Synthetic-account-password-42" },
  });
  expect(response.status(), await response.text()).toBe(200);
  await verifyTestEmail(page.request, email);
  return email;
}

test("an empty builder opens one start screen with four choices at every width", async ({
  page,
}) => {
  await page.goto("/builder");
  const start = page.locator(".start-screen");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { name: "How would you like to start?" }),
    ).toBeVisible();
    for (const name of CHOICES) {
      const button = start.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(start.getByRole("button", { name: "Browse example CVs" })).toBeVisible();
    await expect(start.getByRole("button", { name: "Back to My CVs" })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/start/${width}.png`, fullPage: true });
  }
  await start.getByRole("button", { name: "Start from scratch", exact: true }).click();
  await expect(page.getByLabel("CV name", { exact: true })).toHaveValue("Untitled resume");

  // New from the CV options menu returns to the start screen; Back keeps the CV open.
  await editorTool(page, "New");
  await expect(start).toBeVisible();
  await start.getByRole("button", { name: "Back to My CVs" }).click();
  await expect(page.getByLabel("CV name", { exact: true })).toHaveValue("Untitled resume");
});

test("LinkedIn import reads several export CSVs and goes to review first", async ({
  page,
}) => {
  await page.goto("/builder");
  await page.getByLabel("LinkedIn export CSV files").setInputFiles([
    {
      name: "Positions.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        `Company Name,Title,Location,Started On,Finished On,Description\n"Vercel, Inc.","Principal Engineer","Remote","Jan 2022",,"Shipped edge runtime features"`,
      ),
    },
    { name: "Skills.csv", mimeType: "text/csv", buffer: Buffer.from("Name\nTypeScript") },
  ]);
  const review = page.locator(".import-review");
  await expect(review).toContainText("Positions.csv, Skills.csv");
  await page.getByRole("button", { name: "Restore as new", exact: true }).click();
  await expect(page.getByRole("article", { name: "Resume preview" })).toContainText(
    "Principal Engineer",
  );

  // A CSV that is not from LinkedIn is refused with a plain explanation.
  await editorTool(page, "New");
  await page.getByLabel("LinkedIn export CSV files").setInputFiles({
    name: "notes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a,b\n1,2"),
  });
  await expect(page.locator(".alert")).toContainText("notes.csv is not a LinkedIn export CSV");
});

test("the design picker filters by photo, ATS and columns, and Brand shows a photo", async ({
  page,
}) => {
  await page.goto("/builder");
  const fixture = createDocument(true);
  fixture.presentation.template = "bold";
  await startSampleResume(page, fixture);
  await page.getByLabel("Choose resume photo").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: PIXEL,
  });
  await expect(page.locator(".photo-design-warning")).toHaveCount(0);
  await expect(page.locator('[data-block-id="photo"]').first()).toBeVisible();

  await editorTool(page, "Design");
  const design = page.getByRole("complementary", { name: "Design" });
  const filters = design.getByRole("group", { name: "Filter designs" });
  await filters.getByRole("button", { name: /^ATS-friendly/ }).click();
  await expect(design.locator(".template-card")).toHaveCount(3);
  await expect(design.getByRole("button", { name: "Research template" })).toBeVisible();
  await filters.getByRole("button", { name: /^Two columns/ }).click();
  await expect(design.locator(".template-card")).toHaveCount(1);
  await expect(design.getByRole("button", { name: "Creative template" })).toBeVisible();
  await filters.getByRole("button", { name: /^Supports photo/ }).click();
  await expect(filters.getByRole("button", { name: /^Supports photo/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  for (const name of ["Brand", "Executive Luxury", "Consulting"])
    await expect(design.getByRole("button", { name: `${name} template` })).toBeVisible();
  await expect(design.getByRole("button", { name: "Classic template" })).toHaveCount(0);
});

test("after sign-in, browser CVs are offered once and copied to the account", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await signUp(page);
  await page.reload();
  const banner = page.getByRole("region", { name: "CVs saved in this browser" });
  await expect(banner).toContainText("You have 1 CV saved in this browser.");
  await banner.getByRole("button", { name: "Copy to my account" }).click();
  await expect(banner.locator(".transfer-row input")).toBeChecked();
  await banner.getByRole("button", { name: "Copy 1 selected to account" }).click();
  await expect(page.getByRole("status").filter({ hasText: "copied to your account" })).toBeVisible();
  await expect(page.locator(".library-card")).toHaveCount(1);
  // The browser copy is kept, so a one-line pointer to it stays, with nothing left to copy.
  await expect(banner).toContainText("1 CV is saved in this browser, not in your account.");
  await expect(banner.getByRole("button", { name: "Copy to my account" })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".library-card")).toHaveCount(1);
  await expect(banner).not.toContainText("You have 1 CV saved");
});

test("after Not now the browser CVs stay one click away", async ({ page }) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await signUp(page);
  await page.reload();
  const banner = page.getByRole("region", { name: "CVs saved in this browser" });
  await banner.getByRole("button", { name: "Not now" }).click();
  // Not now shrinks it to one line; the browser CVs stay reachable.
  const line = "1 CV is saved in this browser, not in your account.";
  await expect(banner).toContainText(line);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "How would you like to start?" }),
  ).toBeVisible();
  await expect(banner).toContainText(line);
  await expect(banner.getByRole("button", { name: "Copy to my account" })).toBeVisible();
  await banner.getByRole("button", { name: "Show it" }).click();
  await expect(page.locator(".library-card")).toHaveCount(1);
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
  await expect(page.getByRole("button", { name: "Open my account CVs" })).toBeVisible();
});

test("account settings use keyboard-operable tabs with a danger zone and billing", async ({
  page,
}) => {
  await page.goto("/builder");
  const email = await signUp(page);
  await page.reload();
  await openAccount(page);
  const panel = page.getByRole("region", { name: "Account settings" });
  await expect(panel).toContainText(email);
  const tabs = panel.getByRole("tablist", { name: "Account sections" });
  const profile = tabs.getByRole("tab", { name: "Profile", exact: true });
  await expect(profile).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByRole("button", { name: "Sign out" })).toBeVisible();
  await profile.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "Sign-in & security" })).toBeFocused();
  await expect(panel.getByRole("tabpanel")).toContainText("Sign-in methods");
  await page.keyboard.press("End");
  await expect(tabs.getByRole("tab", { name: "Billing" })).toHaveAttribute("aria-selected", "true");
  // New accounts get Go free during the beta, with its end date shown.
  await expect(panel.getByRole("tabpanel")).toContainText("Current plan: Go (free during the beta)");
  await expect(panel.getByRole("tabpanel")).toContainText("Your free Go period ends on");
  await accountTab(page, "Data & privacy");
  const danger = panel.getByRole("group", { name: "Danger zone" });
  await expect(danger.getByRole("button", { name: "Delete account and cloud resumes" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Download account data" })).toBeVisible();
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `test-results/account-tabs/${width}.png`, fullPage: true });
  }

  // The standalone page opens the requested tab.
  await page.goto("/profile?tab=data");
  await expect(page.getByRole("heading", { level: 1, name: "Account settings" })).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Data & privacy", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("group", { name: "Danger zone" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close account settings" })).toHaveCount(0);
});

test("signed in with a browser CV open, one click copies it to the account for AI", async ({
  page,
}) => {
  await page.goto("/builder");
  await startSampleResume(page);
  await signUp(page);
  // The tab keeps the browser copy for one load, as after signing in mid-edit.
  await page.evaluate(() => sessionStorage.setItem("cv-workspace", "device"));
  await page.reload();
  await page.getByRole("button", { name: "Open CV", exact: true }).first().click();
  await expect(page.locator(".save-status")).toHaveText("Saved in this browser");

  // AI explains the real situation instead of asking to sign in again.
  await page.locator(".section-nav").getByRole("button", { name: /^Experience/ }).click();
  await page.getByRole("button", { name: "AI help for Bullet 1", exact: true }).first().click();
  await page.getByRole("menuitem", { name: /^Improve wording/ }).click();
  const note = page.locator(".field-ai-note");
  await expect(note).toContainText("You are signed in, but this CV is still saved only in this browser");
  await expect(note.getByRole("button", { name: "Sign in" })).toHaveCount(0);

  await note.getByRole("button", { name: "Copy to my account" }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved to your account");
  await expect(page.getByLabel("CV name", { exact: true })).toHaveValue(/Alex Morgan/);
  await expect(page.getByRole("status").filter({ hasText: "now saved to your account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy to my account" })).toHaveCount(0);
});
