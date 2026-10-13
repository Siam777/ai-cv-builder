import { editorTool } from "./helpers";
import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createDocument } from "../../src/lib/document";
import { verifyTestEmail } from "./helpers";

// A current-state baseline, not a pixel snapshot or accessibility certification.
// Only synthetic data and the isolated local test server are used.
for (const width of [360, 768, 1440]) {
  test(`visual baseline at ${width}px: routes, editor, account and dialogs`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 1000 });
    page.setDefaultTimeout(10_000);
    const directory = `test-results/visual-baseline/${width}`;
    await mkdir(directory, { recursive: true });
    const records: Array<{
      state: string;
      path: string;
      overflow: number;
      dialogOverflow: number;
      clippedControls: string[];
    }> = [];
    async function capture(state: string, fullPage = false) {
      await page.evaluate(() => document.fonts.ready);
      const dimensions = await page.evaluate(() => ({
        overflow: Math.max(
          0,
          document.documentElement.scrollWidth - innerWidth,
        ),
        dialogOverflow: Math.max(
          0,
          ...Array.from(
            document.querySelectorAll<HTMLElement>(
              '[role="dialog"] .modal-card, [role="dialog"].modal-card',
            ),
          ).map((element) => element.scrollWidth - element.clientWidth),
        ),
        clippedControls: Array.from(
          document.querySelectorAll<HTMLElement>(
            ".tailor-input-stage input, .tailor-input-stage textarea, .export-menu[open] > div button",
          ),
        )
          .filter((element) => {
            const bounds = element.getBoundingClientRect();
            const modal = element
              .closest(".modal-card")
              ?.getBoundingClientRect();
            return (
              bounds.width > 0 &&
              (bounds.left < -1 ||
                bounds.right > innerWidth + 1 ||
                (modal &&
                  (bounds.left < modal.left - 1 ||
                    bounds.right > modal.right + 1)))
            );
          })
          .map(
            (element) =>
              element.textContent?.trim() ||
              element.getAttribute("placeholder") ||
              element.tagName,
          ),
      }));
      const path = `${directory}/${state}.png`;
      await page.screenshot({ path, fullPage, animations: "disabled" });
      records.push({ state, path, ...dimensions });
    }
    async function closeDialog() {
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("button", {
          name: /^(Close dialog|Close demo gallery|Close shortcuts dialog|Close design dialog)$/,
        })
        .click();
      await expect(dialog).toHaveCount(0);
    }
    async function openAndCapture(button: string | RegExp, state: string) {
      await page
        .getByRole("button", {
          name: button,
          exact: typeof button === "string",
        })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await capture(state);
      await closeDialog();
    }

    await page.goto("/builder");
    await expect(page.locator(".save-status")).toHaveText(
      "Saved in this browser",
    );
    await page.goto("/auth/complete");
    await expect(
      page.getByRole("heading", {
        name: "Check your email verification status",
      }),
    ).toBeVisible();
    await capture("verification-without-session", true);
    await page.goto("/builder");
    await expect(page.locator(".save-status")).toHaveText(
      "Saved in this browser",
    );
    await capture("library-empty", true);
    await page.getByRole("button", { name: "Browse demo examples" }).click();
    await capture("demo-gallery");
    await page
      .locator(".demo-profile-card")
      .first()
      .getByRole("button")
      .click();
    await expect(page.locator(".page-sheet").first()).toBeVisible();
    await capture("demo-preview");
    await closeDialog();

    const fixture = createDocument(true);
    fixture.provenance = { purpose: "personal", origin: "import" };
    await page.getByLabel("Import JSON backup").setInputFiles({
      name: "baseline.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
    await capture("import-review");
    await page
      .getByRole("button", { name: "Restore as new", exact: true })
      .click();
    await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
      fixture.contact.name,
    );
    await capture("editor-contact", true);
    await page
      .locator(".section-nav")
      .getByRole("button", { name: /Experience/ })
      .click();
    await capture("editor-experience", true);
    const previewToggle = page.getByRole("button", {
      name: "Preview resume",
      exact: true,
    });
    if (await previewToggle.isVisible()) {
      await previewToggle.click();
      await capture("editor-preview", true);
      await page
        .getByRole("button", { name: "Edit details", exact: true })
        .click();
    }
    await page.getByRole("button", { name: "Design", exact: true }).click();
    await expect(page.locator("#side-panel")).toHaveAccessibleName("Design");
    await capture("design-gallery");
    await page.getByRole("button", { name: "Close Design" }).click();
    const upgrade = page.getByRole("button", {
      name: "Upgrade",
      exact: true,
    });
    if (await upgrade.isVisible()) {
      await upgrade.click();
      await expect(
        page.getByRole("dialog", { name: "Subscription Pricing" }),
      ).toBeVisible();
      await capture("pricing-dialog");
      await page.getByRole("button", { name: "Close pricing dialog" }).click();
    }
    await editorTool(page, "Check");
    await page
      .getByRole("button", { name: "Role checklist", exact: true })
      .click();
    await capture("analyzer-confirmation");
    await page
      .getByRole("button", { name: "Review selected checklist" })
      .click();
    await capture("analyzer-role");
    await page.getByRole("button", { name: /Writing findings/ }).click();
    await capture("analyzer-findings");
    await page.getByRole("button", { name: "Document text view" }).click();
    await capture("analyzer-text");
    await page.getByRole("button", { name: "Close Check my CV" }).click();
    await editorTool(page, "Create practice example");
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture("practice-generator");
    await closeDialog();
    await openAndCapture(/Add section/, "add-section");
    await page.keyboard.press("?");
    await expect(
      page.getByRole("dialog", { name: "Keyboard Navigation & Actions" }),
    ).toBeVisible();
    await capture("keyboard-shortcuts");
    await closeDialog();
    await editorTool(page, "History");
    await capture("history-empty");
    await page.getByRole("button", { name: "+ Save Checkpoint" }).click();
    await expect(page.locator(".snapshots-list")).toBeVisible();
    await capture("history-saved");
    await closeDialog();
    await editorTool(page, "Match a job");
    await capture("tailor-input");
    await page.getByLabel("Target Job Title").fill("Product Designer");
    await page.getByLabel("Use this target role, seniority and language").check();
    await page
      .getByPlaceholder(
        "Paste the full job requirements and responsibilities here...",
      )
      .fill(
        "Requirements:\n- Experience with prototyping and Figma\n- Required: Kubernetes",
      );
    await page
      .getByRole("button", { name: /Analyze & Match Evidence/ })
      .click();
    await expect(page.getByRole("region", {name:"Requirement coverage"})).toBeVisible();
    await capture("tailor-results");
    await closeDialog();
    await editorTool(page, "Cover letter");
    await capture("letter-input");
    await page
      .getByRole("button", { name: /Generate Grounded Cover Letter/ })
      .click();
    await expect(
      page.getByRole("button", { name: "Adjust Inputs" }),
    ).toBeVisible();
    await capture("letter-review");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await editorTool(page, "Writing help");
    await capture("ai-signin-gate", true);
    await page.getByRole("button", { name: "Close AI Assistant" }).click();
    await page.locator(".export-menu summary").click();
    await capture("export-menu");
    await page.getByRole("button", { name: "Plain text (.txt)" }).click();
    await expect(
      page.getByRole("region", { name: "Account and storage" }),
    ).toBeVisible();
    await capture("export-signin", true);
    await page.getByRole("button", { name: "Close account settings" }).click();
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: /^My CVs/ }).click();
    await capture("library-populated", true);

    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await capture("profile-signin", true);
    await page.getByRole("button", { name: "Create account instead" }).click();
    await capture("profile-signup", true);
    await page.getByRole("button", { name: /Forgot password/ }).click();
    await capture("profile-recovery", true);
    const email = `baseline-${width}-${randomUUID()}@example.test`;
    const signup = await page.request.post("/api/auth", {
      headers: {
        origin: process.env.E2E_ORIGIN || "http://localhost:3100",
        "x-forwarded-for": `192.0.2.${width % 250}`,
      },
      data: {
        action: "signup",
        email,
        password: "Synthetic-baseline-password-42",
      },
    });
    expect(signup.status()).toBe(200);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Refresh verification status" }),
    ).toBeVisible();
    await capture("profile-unverified", true);
    await verifyTestEmail(page.request, email);
    await page
      .getByRole("button", { name: "Refresh verification status" })
      .click();
    await expect(
      page.getByText("Email verified.", { exact: true }),
    ).toBeVisible();
    await capture("profile-verified", true);
    await page.goto("/auth/complete");
    await expect(
      page.getByRole("heading", { name: "Email verified", exact: true }),
    ).toBeVisible();
    await capture("verification-complete", true);
    await page.goto("/upgrade");
    await capture("pricing", true);
    await page
      .getByRole("button", { name: "Upgrade to Job Hunter Pass ↗" })
      .click();
    await expect(page.locator(".upgrade-alert")).toContainText(
      /configured|unavailable/i,
    );
    await capture("checkout-unconfigured", true);
    await page.goto("/grader");
    await capture("reviewer-input", true);
    await page.getByRole("button", { name: "Load Sample" }).click();
    await page.getByRole("button", { name: "Review resume content" }).click();
    await expect(page.locator(".grader-report-card")).toBeVisible();
    await capture("reviewer-report", true);
    await page.goto("/auth/complete?error=expired");
    await expect(page.getByRole("heading")).toContainText("invalid or expired");
    await capture("verification-error", true);
    await page.goto("/auth/reset-password");
    await expect(page.locator(".account-panel")).toBeVisible();
    await capture("reset-missing-token", true);
    await page.goto("/auth/reset-password?token=synthetic-not-valid");
    await expect(
      page.getByLabel("New password", { exact: true }),
    ).toBeVisible();
    await capture("reset-form", true);
    await page.goto("/baseline-not-found");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await capture("not-found", true);
    await writeFile(
      `${directory}/manifest.json`,
      JSON.stringify({ width, height: 1000, records }, null, 2),
    );
    expect(
      records.filter(
        (record) =>
          record.overflow > 1 ||
          record.dialogOverflow > 1 ||
          record.clippedControls.length > 0,
      ),
      "Content should remain horizontally reachable at every captured state",
    ).toEqual([]);
  });
}
