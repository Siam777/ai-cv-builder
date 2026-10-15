import { startSampleResume, openFirstCv, authenticateForExport, openAccount } from "./helpers";
import { test, expect } from "@playwright/test";

test.describe("Dedicated Route Verification (Profile & Upgrade)", () => {
  test("profile page renders dedicated account workspace and strictly hides CV editor", async ({
    page,
  }) => {
    await page.goto("/profile");

    // Signed out, the account page offers sign-in
    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Account settings" })).toBeVisible();

    // The CV editor components must NOT be present
    await expect(page.locator(".editor-layout")).toHaveCount(0);
    await expect(page.locator(".editor-toolbar")).toHaveCount(0);
    await expect(page.locator(".paper-stage")).toHaveCount(0);
    await expect(page.locator(".cv-title")).toHaveCount(0);

    // Header back link to studio
    const backBtn = page.getByRole("link", { name: "Back to My CVs" });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL("/builder");
  });

  test("account URL redirects directly to /profile", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/.*\/profile/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeVisible();
  });

  test("upgrade page renders SaaS tiers and strictly hides CV editor", async ({
    page,
  }) => {
    await page.goto("/upgrade");

    // Upgrade heading must be visible
    await expect(
      page.getByRole("heading", { name: "Invest In Your Next Career Chapter" }),
    ).toBeVisible();

    // Commercial pricing cards must be rendered
    await expect(page.getByRole("heading", { name: "Free / Local" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Monthly Pass" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Power Pass" })).toBeVisible();

    // Feature matrix must be present
    await expect(
      page.getByRole("heading", { name: "Detailed Feature Comparison" }),
    ).toBeVisible();

    // The CV editor components must NOT be present
    await expect(page.locator(".editor-layout")).toHaveCount(0);
    await expect(page.locator(".editor-toolbar")).toHaveCount(0);
    await expect(page.locator(".paper-stage")).toHaveCount(0);
    await expect(page.locator(".cv-title")).toHaveCount(0);

    // Header back link to studio
    const backBtn = page.getByRole("link", { name: "← Back to Resume Studio" });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL("/builder");
  });

  test("pricing URL redirects directly to /upgrade", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveURL(/.*\/upgrade/);
    await expect(
      page.getByRole("heading", { name: "Invest In Your Next Career Chapter" }),
    ).toBeVisible();
  });

  test("in-studio account toggle completely hides CV editor while open and restores it when closed", async ({
    page,
  }) => {
    await page.goto("/builder");
    await startSampleResume(page);
    await expect(page.locator(".save-status")).toHaveText("Saved in this browser");

    // Before opening account, editor layout and toolbar are visible
    await expect(page.locator(".workspace-body")).toBeVisible();

    // Open Account settings
    await openAccount(page);
    await expect(page.getByRole("region", { name: "Account settings" })).toBeVisible();

    // While account settings are active, workspace-body CV editor must be hidden (display: none)
    await expect(page.locator(".workspace-body")).toBeHidden();

    // Close account settings
    await page.getByRole("button", { name: "Close account settings" }).click();
    await expect(page.getByRole("region", { name: "Account settings" })).toHaveCount(0);

    // Workspace-body CV editor must be visible again
    await expect(page.locator(".workspace-body")).toBeVisible();
    await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  });

  test("docked panels leave the page scrollable; modal dialogs lock it and scroll inside", async ({
    page,
  }) => {
    await page.goto("/builder");
    await startSampleResume(page);
    await expect(page.locator(".save-status")).toHaveText("Saved in this browser");
    const overflow = () => page.evaluate(() => document.body.style.overflow);
    expect(await overflow()).not.toBe("hidden");

    // A docked side panel keeps the editor and page usable.
    await page.getByRole("button", { name: /^Check/ }).click();
    const panel = page.getByRole("complementary", { name: "Check my CV" });
    await expect(panel).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/modal-open/);
    expect(await overflow()).not.toBe("hidden");
    await panel.getByRole("tab", { name: "Compare with a role" }).click();
    await panel.getByRole("button", { name: "Review selected checklist" }).click();
    // Long content scrolls inside the panel and stays reachable.
    const body = panel.locator(".side-panel-body");
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await page.getByText("Role numeric patterns", { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByText("Role numeric patterns", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Close Check my CV" }).click();
    await expect(panel).toHaveCount(0);

    // A modal dialog locks the page behind it and restores it on close.
    await page.getByRole("button", { name: "CV options", exact: true }).click();
    await page.getByRole("menuitem", { name: /^History/ }).click();
    const dialog = page.getByRole("dialog", { name: "Resume Version History" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/modal-open/);
    expect(await overflow()).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await overflow()).toBe("");
  });
});
