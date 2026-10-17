import { expect, test, type Page } from "@playwright/test";
import { startSampleResume } from "./helpers";

// Pixel snapshots of the main editor surfaces. Refresh them deliberately with
// `npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots`
// after an intended visual change, and review the new images before committing.

async function snap(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    // The Next.js dev-tools badge is not part of the app.
    mask: [page.locator("nextjs-portal")],
    // Allows text anti-aliasing noise; layout changes are far larger.
    maxDiffPixelRatio: 0.001,
  });
}

async function previewReady(page: Page) {
  await expect(page.getByText("Preparing pages…")).toHaveCount(0);
  await expect(page.locator(".paginated-resume").first()).toBeVisible();
}

for (const width of [360, 768, 1440]) {
  test.describe(`visual regression at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } });

    test("library, editor, design panel and check panel", async ({ page }) => {
      test.setTimeout(120_000);
      await page.goto("/builder");
      await expect(page.locator(".save-status")).toHaveText(
        "Saved in this browser",
      );
      await snap(page, `library-${width}`);

      await startSampleResume(page);
      if (width < 900) {
        await snap(page, `editor-${width}`);
        await page.getByRole("button", { name: "Preview resume" }).click();
        await previewReady(page);
        await snap(page, `preview-${width}`);
      } else {
        await previewReady(page);
        await snap(page, `editor-${width}`);
      }

      // Side panels dock beside the form on wide screens and are sheets on narrow ones.
      const panelRole = width < 900 ? "dialog" : "complementary";
      await page.getByRole("button", { name: "Design", exact: true }).click();
      await expect(page.getByRole(panelRole, { name: "Design" })).toBeVisible();
      await snap(page, `design-panel-${width}`);
      await page.getByRole("button", { name: "Close Design" }).click();

      await page.getByRole("button", { name: /^Check/ }).click();
      await expect(
        page.getByRole(panelRole, { name: "Check my CV" }),
      ).toBeVisible();
      await snap(page, `check-panel-${width}`);
    });
  });
}
