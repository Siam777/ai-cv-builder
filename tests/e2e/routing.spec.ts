import { test, expect } from "@playwright/test";

test.describe("Dedicated Route Verification (Profile & Upgrade)", () => {
  test("profile page renders dedicated account workspace and strictly hides CV editor", async ({
    page,
  }) => {
    await page.goto("/profile");

    // Profile heading must be visible
    await expect(
      page.getByRole("heading", { name: "Your Profile & Account Settings" }),
    ).toBeVisible();

    // Storage options must be visible
    await expect(page.getByText("On this device", { exact: true })).toBeVisible();
    await expect(page.getByText("In your account", { exact: true })).toBeVisible();

    // The CV editor components must NOT be present
    await expect(page.locator(".editor-layout")).toHaveCount(0);
    await expect(page.locator(".document-toolbar")).toHaveCount(0);
    await expect(page.locator(".paper-stage")).toHaveCount(0);
    await expect(page.locator("#resume-select")).toHaveCount(0);

    // Header back link to studio
    const backBtn = page.getByRole("link", { name: "← Back to Resume Studio" });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL("/");
  });

  test("account URL redirects directly to /profile", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/.*\/profile/);
    await expect(
      page.getByRole("heading", { name: "Your Profile & Account Settings" }),
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
    await expect(page.locator(".document-toolbar")).toHaveCount(0);
    await expect(page.locator(".paper-stage")).toHaveCount(0);
    await expect(page.locator("#resume-select")).toHaveCount(0);

    // Header back link to studio
    const backBtn = page.getByRole("link", { name: "← Back to Resume Studio" });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL("/");
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
    await page.goto("/");
    await page.getByRole("button", { name: "Explore an example" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");

    // Before opening account, editor layout and toolbar are visible
    await expect(page.locator(".workspace-body")).toBeVisible();

    // Open Account settings
    await page.getByRole("button", { name: "Account", exact: true }).click();
    await expect(page.getByRole("region", { name: "Account and storage" })).toBeVisible();

    // While account settings are active, workspace-body CV editor must be hidden (display: none)
    await expect(page.locator(".workspace-body")).toBeHidden();

    // Close account settings
    await page.getByRole("button", { name: "Close account settings" }).click();
    await expect(page.getByRole("region", { name: "Account and storage" })).toHaveCount(0);

    // Workspace-body CV editor must be visible again
    await expect(page.locator(".workspace-body")).toBeVisible();
    await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  });

  test("modal open mode locks outside body scroll and enables full internal scroll to see entire modal content", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Explore an example" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved on this device");

    // Body should not have modal-open initially
    const initialOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(initialOverflow).not.toBe("hidden");

    // Open CV Analyzer & Role Gap Inspector (AtsReadinessPanel)
    await page.locator(".ats-score-pill").click();
    const dialog = page.getByRole("dialog", { name: "ATS Readiness Audit" });
    await expect(dialog).toBeVisible();

    // 1. Verify outside body is not scrollable (body scroll locked)
    await expect(page.locator("body")).toHaveClass(/modal-open/);
    const lockedOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(lockedOverflow).toBe("hidden");

    // 2. Verify modal content is internally scrollable
    const atsContent = page.locator(".ats-content");
    await expect(atsContent).toBeVisible();
    const isScrollable = await atsContent.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(isScrollable).toBe(true);

    // 3. Verify the bottom content and templates are fully reachable
    await expect(page.getByText("Role Metric Benchmarks & Google XYZ Templates")).toBeVisible();

    // 4. Verify the modal footer 'Done' button is visible and pinned
    const doneBtn = page.getByRole("button", { name: "Done" });
    await expect(doneBtn).toBeVisible();

    // 5. Close modal and verify outside body scroll is restored
    await doneBtn.click();
    await expect(dialog).toHaveCount(0);
    const restoredOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(restoredOverflow).toBe("");
  });
});
